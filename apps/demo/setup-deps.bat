@echo off
REM ============================================================
REM ManhuaWorks Demo - 补装依赖脚本
REM 触发场景: toonflow-app/node_modules 缺失或 better-sqlite3 binary 缺失
REM ============================================================
setlocal
set DEMO_DIR=%~dp0
cd /d "%DEMO_DIR%"

echo === Step 1: 安装 demo 自身依赖 (tsx) ===
call npm install --no-audit --no-fund
if errorlevel 1 goto :fail

echo.
echo === Step 2: 安装 Toonflow 运行时依赖 ===
cd /d "%DEMO_DIR%toonflow-app"
call npm install --omit=dev --legacy-peer-deps --ignore-scripts --no-audit --no-fund
if errorlevel 1 goto :fail

echo.
echo === Step 3: 拉取 better-sqlite3 预编译二进制 (Node ABI 127) ===
set BS3_VER=12.10.0
set NODE_VER=22.16.0
set BS3_URL=https://github.com/WiseLibs/better-sqlite3/releases/download/v%BS3_VER%/better-sqlite3-v%BS3_VER%-node-v127-win32-x64.tar.gz
set BS3_TMP=%TEMP%\bs3-prebuild.tar.gz

if exist "node_modules\better-sqlite3\build\Release\better_sqlite3.node" (
  echo [SKIP] better-sqlite3 binary 已存在
  goto :verify
)

echo 下载 %BS3_URL% ...
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri '%BS3_URL%' -OutFile '%BS3_TMP%' -TimeoutSec 90 -UseBasicParsing; Write-Host ('Downloaded: ' + (Get-Item '%BS3_TMP%').Length + ' bytes') } catch { Write-Host ('FAIL: ' + $_.Exception.Message); exit 1 }"
if errorlevel 1 goto :fail

echo 解压到 node_modules\better-sqlite3\build\Release\ ...
powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; $src='%BS3_TMP%'; $dst=Join-Path (Resolve-Path 'node_modules\better-sqlite3') 'build\Release'; New-Item -ItemType Directory -Force -Path $dst | Out-Null; $gz=[System.IO.Compression.GZipStream]::new([System.IO.File]::OpenRead($src),[System.IO.Compression.CompressionMode]::Decompress); $tar=New-Object System.IO.MemoryStream; $gz.CopyTo($tar); $gz.Close(); $tar.Position=0; [System.IO.Compression.GZipStream]::new($tar,[System.IO.Compression.CompressionMode]::Decompress).CopyTo([System.IO.MemoryStream]::new()); & tar -xf '%BS3_TMP%' -C (Join-Path (Resolve-Path 'node_modules\better-sqlite3') 'build\Release')"
if errorlevel 1 goto :fail

:verify
echo.
echo === 验证 better-sqlite3 可加载 ===
node -e "try { const db = require('better-sqlite3')(':memory:'); console.log('OK sqlite', db.prepare('SELECT sqlite_version() as v').get().v); db.close(); } catch(e) { console.error('FAIL:', e.message); process.exit(1); }"
if errorlevel 1 goto :fail

echo.
echo === 全部完成！运行 start.bat 启动 demo ===
exit /b 0

:fail
echo.
echo [FAIL] 补装失败, 详见上方日志
exit /b 1
endlocal
