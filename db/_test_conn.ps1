$env:PGPASSWORD = "mhw_dev_password_2026"
$psql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
& $psql -h "127.0.0.1" -p "5432" -U "mhw" -d "manhuaworks" -c "SELECT version();"
