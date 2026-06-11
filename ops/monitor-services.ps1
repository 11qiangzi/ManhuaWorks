# ============================================================
# ChengGou · 5-Service Monitor (Order 30)
# Created: 2026-06-10 17:04
# Ports: 8088(user) 8089(project) 8091(collab) 8090(billing) 8087(ai)
# Interval: 30s | Auto-restart | Log: monitor.log
# ============================================================

param(
    [ValidateSet("start", "stop", "status")]
    [string]$Command = "status"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir   = Split-Path -Parent $ScriptDir
$LogFile   = Join-Path $ScriptDir "monitor.log"
$PidFile   = Join-Path $ScriptDir "monitor-services.pid"

# ---- Service Definitions ----
$Services = @(
    @{ Name = "user-service";      Port = 8088; Dir = "$RootDir\services\user-service";      Cmd = "pnpm dev" }
    @{ Name = "project-service";   Port = 8089; Dir = "$RootDir\services\project-service";   Cmd = "pnpm dev" }
    @{ Name = "collab-service";    Port = 8091; Dir = "$RootDir\services\collab-service";     Cmd = "pnpm dev" }
    @{ Name = "billing-service";   Port = 8090; Dir = "$RootDir\services\billing-service";    Cmd = "pnpm dev" }
    @{ Name = "ai-orchestrator";   Port = 8087; Dir = "$RootDir\services\ai-orchestrator";    Cmd = "pnpm dev" }
)

# ---- Helpers ----
function Write-Log {
    param([string]$Message)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts $Message" | Out-File -Append -Encoding utf8 -FilePath $LogFile
}

function Test-Port {
    param([int]$Port)
    try {
        $tcp = New-Object Net.Sockets.TcpClient
        $result = $tcp.BeginConnect("127.0.0.1", $Port, $null, $null)
        $wait = $result.AsyncWaitHandle.WaitOne(2000, $false)
        if ($wait -and $tcp.Connected) { $tcp.Close(); return $true }
        $tcp.Close(); return $false
    } catch { return $false }
}

function Start-ServiceProc {
    param($Svc)
    Write-Log "ALERT: $($Svc.Name) (:$($Svc.Port)) DOWN - auto-restart..."
    try {
        Start-Process powershell `
            -ArgumentList "-NoExit", "-Command", "cd $($Svc.Dir); $($Svc.Cmd) 2>&1" `
            -WindowStyle Hidden
        Write-Log "STARTED: $($Svc.Name) launched (cd $($Svc.Dir); $($Svc.Cmd))"
    } catch {
        Write-Log "ERROR: $($Svc.Name) launch failed: $_"
    }
}

function Get-Status {
    Write-Host ""
    Write-Host "===== 5 Services Status ($(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) =====" -ForegroundColor Cyan
    foreach ($svc in $Services) {
        $up = Test-Port -Port $svc.Port
        $icon = if ($up) { "[UP]" } else { "[DOWN]" }
        $color = if ($up) { "Green" } else { "Red" }
        Write-Host "  $icon $($svc.Name.PadRight(20)) :$($svc.Port)" -ForegroundColor $color
    }
    Write-Host ""
    if (Test-Path $PidFile) {
        $pidVal = Get-Content $PidFile
        Write-Host "  Monitor daemon PID: $pidVal" -ForegroundColor Gray
    }
}

# ---- Command Dispatch ----
switch ($Command) {
    "status" {
        Get-Status
        break
    }

    "stop" {
        if (Test-Path $PidFile) {
            $pidVal = Get-Content $PidFile
            Write-Log "STOP: received stop command, killing PID=$pidVal"
            Stop-Process -Id $pidVal -Force -ErrorAction SilentlyContinue
            Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
            Write-Host "[OK] Monitor stopped (PID=$pidVal)"
        } else {
            Write-Host "[WARN] Monitor not running ($PidFile missing)"
        }
        break
    }

    "start" {
        if (Test-Path $PidFile) {
            $oldPid = Get-Content $PidFile
            try { $p = Get-Process -Id $oldPid -ErrorAction Stop; Write-Host "[WARN] Monitor already running (PID=$oldPid)"; break }
            catch { Remove-Item $PidFile -Force }
        }

        Write-Log "START: monitor daemon starting =========================="
        Write-Host "[START] Launching 5-service monitor (30s interval)..."

        $job = Start-Job -Name "monitor-services" -ScriptBlock {
            param($Svcs, $Log, $PidF)
            $pid | Out-File -FilePath $PidF -Encoding ascii

            function Write-LogJ {
                param([string]$Msg)
                "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Msg" | Out-File -Append -Encoding utf8 -FilePath $Log
            }
            function Test-PortJ {
                param([int]$P)
                try {
                    $t = New-Object Net.Sockets.TcpClient
                    $r = $t.BeginConnect("127.0.0.1", $P, $null, $null)
                    if ($r.AsyncWaitHandle.WaitOne(2000, $false) -and $t.Connected) { $t.Close(); return $true }
                    $t.Close(); return $false
                } catch { return $false }
            }

            Write-LogJ "INIT: monitor ready, checking 5 ports every 30s"

            while ($true) {
                foreach ($s in $Svcs) {
                    $up = Test-PortJ -Port $s.Port
                    if (-not $up) {
                        Write-LogJ "ALERT: $($s.Name) (:$($s.Port)) DOWN - auto-restart..."
                        Start-Process powershell `
                            -ArgumentList "-NoExit", "-Command", "cd $($s.Dir); $($s.Cmd) 2>&1" `
                            -WindowStyle Hidden
                        Write-LogJ "STARTED: $($s.Name) launched"
                    }
                }
                Start-Sleep -Seconds 30
            }
        } -ArgumentList $Services, $LogFile, $PidFile

        Start-Sleep -Seconds 1
        Write-Host "[OK] Monitor started (background Job: monitor-services)"
        Write-Host "  PID file : $PidFile"
        Write-Host "  Log file : $LogFile"
        Write-Log "DAEMON: monitor daemon started, interval=30s"
        break
    }
}
