@echo off
REM ============================================================
REM ManhuaWorks Demo - 一键启动 Toonflow 1.1.7
REM 适用: ManhuaWorks W1 交付 / 漫改部本地验证
REM 端口: 10588 (与 Toonflow 原版一致)
REM ============================================================
setlocal

set DEMO_DIR=%~dp0
cd /d "%DEMO_DIR%"

REM 颜色 (cmd 风格)
echo.
echo ============================================================
echo   ManhuaWorks Demo - Toonflow 1.1.7
echo ============================================================
echo.

REM ---- 预检 ----
if not exist "toonflow-app\data\serve\app.js" (
  echo [ERROR] toonflow-app\data\serve\app.js 不存在！
  echo         请确认复制 D:\Toonflow\Toonflow-app 到本目录完成。
  pause
  exit /b 1
)

if not exist "toonflow-app\node_modules\better-sqlite3\build\Release\better_sqlite3.node" (
  echo [WARN] better-sqlite3 native binary 缺失
  echo        启动会失败，请先运行 setup-deps.bat
)

REM ---- 环境变量 ----
if "%PORT%"=="" set PORT=10588
set NODE_ENV=prod
set OSSURL=http://localhost:%PORT%/

echo [1/3] 配置：
echo       PORT   = %PORT%
echo       OSSURL = %OSSURL%
echo       CWD    = %DEMO_DIR%toonflow-app
echo.

REM ---- 检查 10588 端口占用 ----
echo [2/3] 检查端口 %PORT% ...
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo [WARN] 端口 %PORT% 已被占用，先 kill 占用进程...
  for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    echo        杀掉 PID %%P
    taskkill /pid %%P /F >nul 2>&1
  )
  timeout /t 2 >nul
)

REM ---- 启动 ----
echo [3/3] 启动 demo server (node src/server.ts)...
echo.
echo ============================================================
echo   访问地址: http://localhost:%PORT%/
echo   停止: Ctrl+C
echo ============================================================
echo.

REM 优先用 tsx；本地有 node_modules\.bin\tsx
if exist "node_modules\.bin\tsx.cmd" (
  call node_modules\.bin\tsx.cmd src\server.ts
) else (
  REM 回退: 用 node 直接跑 (需要预先编译或 --experimental-strip-types)
  echo [INFO] tsx 未安装, 试用 npx tsx ...
  call npx --yes tsx src\server.ts
)

endlocal
