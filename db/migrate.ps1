# ManhuaWorks DB migrate script
# 2026-06-08 by Xie Qing
# Usage: powershell -ExecutionPolicy Bypass -File D:\ManhuaWorks\db\migrate.ps1
# Detect local PostgreSQL + run 001a + seed + verify

$ErrorActionPreference = 'Stop'
$env:PGPASSWORD = 'mhw_dev_password_2026'
$psql = 'C:\Program Files\PostgreSQL\16\bin\psql.exe'
$db = 'manhuaworks'
$pgHost = '127.0.0.1'
$pgPort = 5432
$pgUser = 'mhw'

function Step($msg) { Write-Host ''; Write-Host "=== $msg ===" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "OK $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "WARN $msg" -ForegroundColor Yellow }
function Err($msg)  { Write-Host "ERR $msg" -ForegroundColor Red; exit 1 }

# Step 1: check psql
Step 'Step 1/6: detect psql'
if (-not (Test-Path $psql)) { Err "psql not found: $psql" }
& $psql --version
Ok 'psql OK'

# Step 2: test connection
Step 'Step 2/6: test connection'
$connTest = & $psql -h $pgHost -p $pgPort -U $pgUser -d $db -c 'SELECT 1 AS ok' 2>&1
if ($LASTEXITCODE -ne 0) { Err "connection failed: $connTest" }
Ok ('connected to ' + $db + ' @ ' + $pgHost + ':' + $pgPort)

# Step 3: check if tables exist
Step 'Step 3/6: check existing tables'
$exists = & $psql -h $pgHost -p $pgPort -U $pgUser -d $db -tA -c "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('users','projects')"
if ([int]$exists -ge 2) {
    Warn 'core tables already exist (users/projects). To re-run, use reset.ps1 first.'
} else {
    # Step 4: run 001a
    Step 'Step 4/6: run 001a_core.sql'
    & $psql -h $pgHost -p $pgPort -U $pgUser -d $db -v ON_ERROR_STOP=1 -f 'D:\ManhuaWorks\db\001a_core.sql'
    if ($LASTEXITCODE -ne 0) { Err '001a_core.sql failed' }
    Ok '001a_core.sql applied (6 core tables)'

    # Step 5: run seed
    Step 'Step 5/6: run seed.sql'
    & $psql -h $pgHost -p $pgPort -U $pgUser -d $db -v ON_ERROR_STOP=1 -f 'D:\ManhuaWorks\db\seed.sql'
    if ($LASTEXITCODE -ne 0) { Err 'seed.sql failed' }
    Ok 'seed.sql applied (5 users + 3 projects + subs/quotas/logs)'
}

# Step 6: verify (psql simple)
Step 'Step 6/6: verify row count'
$reportSql = @'
SELECT relname AS table_name, n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY relname;
'@
$report = & $psql -h $pgHost -p $pgPort -U $pgUser -d $db -c $reportSql 2>&1
$report | ForEach-Object { Write-Host $_ }

# Bonus: try verify.ts
$tsx = Get-Command tsx -ErrorAction SilentlyContinue
if ($tsx) {
    Step 'Bonus: run verify.ts'
    & tsx 'D:\ManhuaWorks\db\verify.ts'
} else {
    Warn 'tsx not in PATH. Manual: npx tsx D:\ManhuaWorks\db\verify.ts'
}

Ok 'migration done'
Write-Host ''
Write-Host 'Note: after installing pgvector extension, run db\001b_vector.sql to add role_vectors table.' -ForegroundColor Yellow
