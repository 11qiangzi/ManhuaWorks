# ManhuaWorks — 看日志 (PowerShell)
# 2026-06-08 谢擎 L2-task-12
[CmdletBinding()]
param(
    [switch]$Dev,
    [switch]$Prod,
    [switch]$NoFollow,
    [int]$Tail = 100,
    [string]$Service = "",
    [string]$Since = ""
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

$profile = if ($Dev) { 'dev' } else { 'prod' }
$file = if ($Dev) { 'docker-compose.dev.yml' } else { 'docker-compose.yml' }
$follow = if ($NoFollow) { '' } else { '-f' }
$tailArg = "--tail=$Tail"
$sinceArg = if ($Since) { "--since $Since" } else { '' }
$svcArg = if ($Service) { $Service } else { '' }

Write-Host "[logs] 跟踪 $profile 栈..." -ForegroundColor Cyan
Invoke-Expression "docker compose -f $file logs $follow $tailArg $sinceArg $svcArg"
