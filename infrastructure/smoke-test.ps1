# ManhuaWorks — 一键健康检查 (PowerShell)
# 2026-06-08 谢擎 L2-task-12
[CmdletBinding()]
param(
    [switch]$Verbose,
    [switch]$Container,
    [int]$Retries = 3,
    [int]$TimeoutSec = 5
)

$ErrorActionPreference = 'Continue'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

$Pass = 0
$Fail = 0
$Failures = @()

function Test-Http {
    param(
        [string]$Name,
        [string]$Url,
        [int]$Expected = 200
    )
    $script:PassOrFail = $true
    $code = 0
    for ($i = 0; $i -lt $Retries; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec $TimeoutSec -UseBasicParsing -ErrorAction Stop
            $code = [int]$resp.StatusCode
        } catch {
            if ($_.Exception.Response) {
                $code = [int]$_.Exception.Response.StatusCode
            } else {
                $code = 0
            }
        }
        if ($code -eq $Expected) {
            $script:PassOrFail = $true
            $script:PassOrFailCode = $code
            return
        }
        Start-Sleep -Seconds 2
    }
    $script:PassOrFail = $false
    $script:PassOrFailCode = $code
}

function Test-Tcp {
    param(
        [string]$Name,
        [string]$Host = 'localhost',
        [int]$Port
    )
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect($Host, $Port, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne(3000, $false)
        if ($ok -and $client.Connected) {
            $client.EndConnect($iar)
            $client.Close()
            $script:PassOrFail = $true
            return
        }
        $client.Close()
    } catch {}
    $script:PassOrFail = $false
}

# ============== 业务后端 ==============
Write-Host ""
Write-Host "═══ 业务后端 / API Gateway / Monitor ═══" -ForegroundColor Cyan
$backends = @(
    @{ Name = 'user-service';    Url = 'http://localhost:8088/health' },
    @{ Name = 'project-service'; Url = 'http://localhost:8089/health' },
    @{ Name = 'billing-service'; Url = 'http://localhost:8090/health' },
    @{ Name = 'collab-service';  Url = 'http://localhost:8091/health' },
    @{ Name = 'api-gateway';     Url = 'http://localhost:8080/health' },
    @{ Name = 'monitor';         Url = 'http://localhost:8092/health' }
)
foreach ($svc in $backends) {
    Test-Http -Name $svc.Name -Url $svc.Url
    if ($script:PassOrFail) {
        Write-Host "  ✅ $($svc.Name)" -ForegroundColor Green
        $script:Pass++
    } else {
        Write-Host "  ❌ $($svc.Name) -$($svc.Url) (got $($script:PassOrFailCode))" -ForegroundColor Red
        $script:Fail++
        $script:Failures += "$($svc.Name) $($svc.Url)"
    }
}

# ============== 可观测性 ==============
Write-Host ""
Write-Host "═══ 可观测性 (Prometheus / AlertManager / Grafana) ═══" -ForegroundColor Cyan
$obs = @(
    @{ Name = 'prometheus';         Url = 'http://localhost:9090/-/healthy' },
    @{ Name = 'prometheus-config';  Url = 'http://localhost:9090/api/v1/status/config' },
    @{ Name = 'alertmanager';       Url = 'http://localhost:9093/-/healthy' },
    @{ Name = 'grafana';            Url = 'http://localhost:3010/api/health' }
)
foreach ($svc in $obs) {
    Test-Http -Name $svc.Name -Url $svc.Url
    if ($script:PassOrFail) {
        Write-Host "  ✅ $($svc.Name)" -ForegroundColor Green
        $script:Pass++
    } else {
        Write-Host "  ❌ $($svc.Name) -$($svc.Url) (got $($script:PassOrFailCode))" -ForegroundColor Red
        $script:Fail++
        $script:Failures += "$($svc.Name) $($svc.Url)"
    }
}

# ============== 数据层 ==============
Write-Host ""
Write-Host "═══ 数据层 (Postgres / Redis) ═══" -ForegroundColor Cyan
if ($Container) {
    foreach ($pair in @(
        @{ Name = 'postgres'; Container = 'mhw-postgres'; Cmd = 'pg_isready -U mhw -d manhuaworks' },
        @{ Name = 'redis';    Container = 'mhw-redis';    Cmd = 'redis-cli ping' }
    )) {
        $out = docker exec $pair.Container sh -c $pair.Cmd 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ $($pair.Name)" -ForegroundColor Green
            $script:Pass++
        } else {
            Write-Host "  ❌ $($pair.Name) - $out" -ForegroundColor Red
            $script:Fail++
            $script:Failures += "$($pair.Name) container check"
        }
    }
} else {
    Test-Tcp -Name 'postgres' -Host 'localhost' -Port 5432
    if ($script:PassOrFail) {
        Write-Host "  ✅ postgres (tcp/5432)" -ForegroundColor Green
        $script:Pass++
    } else {
        Write-Host "  ❌ postgres (tcp/5432)" -ForegroundColor Red
        $script:Fail++
        $script:Failures += "postgres tcp"
    }
    Test-Tcp -Name 'redis' -Host 'localhost' -Port 6379
    if ($script:PassOrFail) {
        Write-Host "  ✅ redis (tcp/6379)" -ForegroundColor Green
        $script:Pass++
    } else {
        Write-Host "  ❌ redis (tcp/6379)" -ForegroundColor Red
        $script:Fail++
        $script:Failures += "redis tcp"
    }
}

# ============== 前端 ==============
Write-Host ""
Write-Host "═══ 前端 (Vue + Vite) ═══" -ForegroundColor Cyan
$frontends = @(
    @{ Name = 'web';          Url = 'http://localhost:3000/' },
    @{ Name = 'studio';       Url = 'http://localhost:3001/' },
    @{ Name = 'admin-portal'; Url = 'http://localhost:3002/' },
    @{ Name = 'user-portal';  Url = 'http://localhost:3003/' }
)
foreach ($svc in $frontends) {
    Test-Http -Name $svc.Name -Url $svc.Url
    if ($script:PassOrFail) {
        Write-Host "  ✅ $($svc.Name)" -ForegroundColor Green
        $script:Pass++
    } else {
        Write-Host "  ❌ $($svc.Name) -$($svc.Url) (got $($script:PassOrFailCode))" -ForegroundColor Red
        $script:Fail++
        $script:Failures += "$($svc.Name) $($svc.Url)"
    }
}

# ============== 总结 ==============
Write-Host ""
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
$total = $script:Pass + $script:Fail
if ($script:Fail -eq 0) {
    Write-Host "  🎉 全部通过: $($script:Pass) / $total" -ForegroundColor Green
    exit 0
} else {
    Write-Host "  ⚠️  通过 $($script:Pass) / $total, 失败 $($script:Fail)" -ForegroundColor Yellow
    foreach ($r in $script:Failures) {
        Write-Host "    - $r" -ForegroundColor Red
    }
    exit 1
}
