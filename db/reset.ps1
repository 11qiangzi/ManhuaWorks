# ManhuaWorks DB reset script
# 2026-06-08 by Xie Qing
# WARNING: this script DROPs all tables in public schema
# Usage: powershell -ExecutionPolicy Bypass -File D:\ManhuaWorks\db\reset.ps1
#        or with -Force to skip confirm

param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$env:PGPASSWORD = 'mhw_dev_password_2026'
$psql = 'C:\Program Files\PostgreSQL\16\bin\psql.exe'
$db = 'manhuaworks'
$pgHost = '127.0.0.1'
$pgPort = 5432
$pgUser = 'mhw'

Write-Host 'WARN: ManhuaWorks DB reset' -ForegroundColor Yellow
Write-Host ('Target: ' + $db + ' @ ' + $pgHost + ':' + $pgPort)
Write-Host ''

if (-not $Force) {
    $confirm = Read-Host 'Confirm DROP all public tables? (yes/no)'
    if ($confirm -ne 'yes') { Write-Host 'cancelled'; exit 0 }
}

Write-Host ''
Write-Host '=== Drop public schema ===' -ForegroundColor Cyan
$dropSql = 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO ' + $pgUser + '; GRANT ALL ON SCHEMA public TO public;'
& $psql -h $pgHost -p $pgPort -U $pgUser -d $db -c $dropSql
if ($LASTEXITCODE -ne 0) { Write-Host 'ERR reset failed' -ForegroundColor Red; exit 1 }

Write-Host 'OK reset done' -ForegroundColor Green
Write-Host ''
Write-Host 'Next: run migrate.ps1 to recreate tables + seed data' -ForegroundColor Cyan
Write-Host '  powershell -ExecutionPolicy Bypass -File D:\ManhuaWorks\db\migrate.ps1' -ForegroundColor White
