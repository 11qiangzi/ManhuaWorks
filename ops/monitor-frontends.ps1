# ============================================================
# ChengGou · 5-Frontend Monitor (Order 30)
# Created: 2026-06-10 17:04
# Ports: 3000(web) 5175(studio) 5180(user-portal) 5174(admin) 5176(ops)
# Interval: 30s | Auto-restart | Log: monitor-fe.log
# Lesson (Order 24): use npx vite, not pnpm dev (PATH unreliable in child process)
# ============================================================

param(
    [ValidateSet("start", "stop", "status")]
    [string]$Command = "status"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir   = Split-Path -Parent $ScriptDir
$LogFile   = Join-Path $ScriptDir "monitor-fe.log"
$PidFile   = Join-Path $ScriptDir "monitor-frontends.pid"

# ---- Frontend Definitions (npx vite - Lesson from Order 24) ----
$Frontends = @(
    @{ Name = "web";           Port = 3000; Dir = "$RootDir\apps\web";           Cmd = "npx vite --port 3000 --host" }
    @{ Name = "studio";        Port = 5175; Dir = "$RootDir\apps\studio";        Cmd = "npx vite --port 5175 --host" }
    @{ Name = "user-portal";   Port = 5180; Dir = "$RootDir\apps\user-portal";   Cmd = "npx vite --port 5180 --host" }
    @{ Name = "admin-portal";  Port = 5174; Dir = "$RootDir\apps\admin-portal";  Cmd = "npx vite --port 5174 --host" }
    @{ Name = "ops-portal";    Port = 5176; Dir = "$RootDir\apps\ops-portal";    Cmd = "npx vite --port 5176 --host" }
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

function Start-FrontendProc {
    param($Fe)
    Write-Log "ALERT: $($Fe.Name) (:$($Fe.Port)) DOWN - auto-restart..."
    try {
        Start-Process powershell `
            -ArgumentList "-NoExit", "-Command", "cd $($Fe.Dir); $($Fe.Cmd) 2>&1" `
            -WindowStyle Hidden
        Write-Log "STARTED: $($Fe.Name) launched (cd $($Fe.Dir); $($Fe.Cmd))"
    } catch {
        Write-Log "ERROR: $($Fe.Name) launch failed: $_"
    }
}

function Get-Status {
    Write-Host ""
    Write-Host "===== 5 Frontends Status ($(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) =====" -ForegroundColor Magenta
    foreach ($fe in $Frontends) {
        $up = Test-Port -Port $fe.Port
        $icon = if ($up) { "[UP]" } else { "[DOWN]" }
        $color = if ($up) { "Green" } else { "Red" }
        Write-Host "  $icon $($fe.Name.PadRight(20)) :$($fe.Port)" -ForegroundColor $color
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
            Write-Host "[OK] Frontend monitor stopped (PID=$pidVal)"
        } else {
            Write-Host "[WARN] Frontend monitor not running ($PidFile missing)"
        }
        break
    }

    "start" {
        if (Test-Path $PidFile) {
            $oldPid = Get-Content $PidFile
            try { $p = Get-Process -Id $oldPid -ErrorAction Stop; Write-Host "[WARN] Frontend monitor already running (PID=$oldPid)"; break }
            catch { Remove-Item $PidFile -Force }
        }

        Write-Log "START: frontend monitor daemon starting =========================="
        Write-Host "[START] Launching 5-frontend monitor (30s interval)..."

        $job = Start-Job -Name "monitor-frontends" -ScriptBlock {
            param($Fes, $Log, $PidF)
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

            Write-LogJ "INIT: frontend monitor ready, checking 5 ports every 30s"

            while ($true) {
                foreach ($f in $Fes) {
                    $up = Test-PortJ -Port $f.Port
                    if (-not $up) {
                        Write-LogJ "ALERT: $($f.Name) (:$($f.Port)) DOWN - auto-restart..."
                        Start-Process powershell `
                            -ArgumentList "-NoExit", "-Command", "cd $($f.Dir); $($f.Cmd) 2>&1" `
                            -WindowStyle Hidden
                        Write-LogJ "STARTED: $($f.Name) launched"
                    }
                }
                Start-Sleep -Seconds 30
            }
        } -ArgumentList $Frontends, $LogFile, $PidFile

        Start-Sleep -Seconds 1
        Write-Host "[OK] Frontend monitor started (background Job: monitor-frontends)"
        Write-Host "  PID file : $PidFile"
        Write-Host "  Log file : $LogFile"
        Write-Log "DAEMON: frontend monitor daemon started, interval=30s"
        break
    }
}
