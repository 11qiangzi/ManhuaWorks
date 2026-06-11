$env:PGPASSWORD = "mhw_dev_password_2026"
$psql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"

Write-Host "=== manhuaworks ===" -ForegroundColor Cyan
& $psql -h "127.0.0.1" -p "5432" -U "mhw" -d "manhuaworks" -c "\dt"

Write-Host "=== collab ===" -ForegroundColor Cyan
& $psql -h "127.0.0.1" -p "5432" -U "mhw" -d "collab" -c "\dt"

Write-Host "=== databases ===" -ForegroundColor Cyan
& $psql -h "127.0.0.1" -p "5432" -U "mhw" -d "postgres" -c "\l"
