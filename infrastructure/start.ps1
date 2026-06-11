# ManhuaWorks — 一键起 dev 栈 (Windows PowerShell)
# 2026-06-08 谢擎 L2-task-12
#
# 用法：
#   .\start.ps1                  起 dev compose
#   .\start.ps1 -Rebuild         强制重新 build
#   .\start.ps1 -Down            停 dev 栈
#   .\start.ps1 -Logs            看日志
#   .\start.ps1 -Smoke           起完跑 smoke test
#   .\start.ps1 -Status          看状态

[CmdletBinding()]
param(
    [switch]$Rebuild,
    [switch]$Down,
    [switch]$Stop,
    [switch]$Restart,
    [switch]$Logs,
    [switch]$Status,
    [switch]$Smoke,
    [switch]$NoDeps
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

$ComposeFile = "docker-compose.dev.yml"
$ComposeCmd = "docker compose -f $ComposeFile"

# ============== 检查 .env ==============
if (-not (Test-Path .env) -and -not $Down -and -not $Stop -and -not $Logs -and -not $Status) {
    if (Test-Path .env.example) {
        Copy-Item .env.example .env -Force
        Write-Host "[start] .env 不存在，已从 .env.example 复制。请按需修改。" -ForegroundColor Yellow
    }
}

# ============== 检查 docker ==============
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[start] ❌ docker 未安装或不在 PATH" -ForegroundColor Red
    exit 1
}

# ============== 执行 ==============
if ($Down) {
    Write-Host "[start] ⬇️  停 dev 栈（保留数据卷）..." -ForegroundColor Cyan
    Invoke-Expression "$ComposeCmd down"
    exit 0
}
if ($Stop) {
    Write-Host "[start] ⏸  暂停 dev 栈..." -ForegroundColor Cyan
    Invoke-Expression "$ComposeCmd stop"
    exit 0
}
if ($Restart) {
    Write-Host "[start] 🔄 重启 dev 栈..." -ForegroundColor Cyan
    Invoke-Expression "$ComposeCmd restart"
    exit 0
}
if ($Logs) {
    Invoke-Expression "$ComposeCmd logs -f --tail=100"
    exit 0
}
if ($Status) {
    Invoke-Expression "$ComposeCmd ps"
    exit 0
}

# 默认：up
$extra = ""
if ($Rebuild) { $extra += " --build" }
if ($NoDeps)  { $extra += " --no-deps" }

Write-Host "[start] 🚀 启动 dev 栈..." -ForegroundColor Green
Invoke-Expression "$ComposeCmd up -d $extra"

if ($Smoke) {
    Write-Host "[start] ⏳ 等待 10s 让服务就绪..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    & "$ScriptDir\smoke-test.ps1"
}

Write-Host ""
Write-Host "[start] ✅ 已启动。常用命令：" -ForegroundColor Green
Write-Host "  .\start.ps1 -Logs     # 跟踪日志"
Write-Host "  .\start.ps1 -Status   # 看状态"
Write-Host "  .\start.ps1 -Smoke    # 健康检查"
Write-Host "  .\start.ps1 -Down     # 停掉"
