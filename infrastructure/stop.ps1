# ManhuaWorks — 停栈 (PowerShell)
# 2026-06-08 谢擎 L2-task-12
[CmdletBinding()]
param(
    [switch]$Dev,
    [switch]$Prod,
    [switch]$Volumes
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

$profile = if ($Dev) { 'dev' } else { 'prod' }
$file = if ($Dev) { 'docker-compose.dev.yml' } else { 'docker-compose.yml' }
$volFlag = if ($Volumes) { ' -v' } else { '' }

Write-Host "[stop] 停 $profile 栈 ($file)..." -ForegroundColor Cyan
Invoke-Expression "docker compose -f $file down$volFlag"
Write-Host "[stop] ✅ 完成" -ForegroundColor Green
