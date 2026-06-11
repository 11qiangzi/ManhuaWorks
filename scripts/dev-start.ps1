# ============================================================
#  ManhuaWorks — Dev 启动脚本 (Windows PowerShell)
#  2026-06-09 梁总 L4-C 部署脚本
#
#  用途: 本地一键起 4 service + 4 portal, 全部后台跑
#
#  用法:
#    .\scripts\dev-start.ps1                # 正常启动
#    .\scripts\dev-start.ps1 -WhatIf        # 演练模式, 不真起, 只打要执行的命令
#    .\scripts\dev-start.ps1 -CheckOnly     # 只检查端口, 不启动
#    .\scripts\dev-start.ps1 -SkipPostgres  # 跳过 postgres 端口检查
#    .\scripts\dev-start.ps1 -SkipPortal    # 只起 service, 不起 vite
#
#  进程模型:
#    4 service  → 用 Start-Process 拉后台, 写 .pid 文件
#    4 portal   → 用 Start-Process 拉后台, 写 .pid 文件
#    关进程     → .\scripts\dev-stop.ps1
#    状态检查   → .\scripts\dev-start.ps1 -CheckOnly
#
#  PID 文件位置: .run/*.pid
#  日志位置:     logs/dev/*.log
# ============================================================

[CmdletBinding()]
param(
    [switch]$WhatIf,
    [switch]$CheckOnly,
    [switch]$SkipPostgres,
    [switch]$SkipPortal,
    [switch]$SkipService
)

$ErrorActionPreference = 'Stop'
# Set-Location 切到 D:\ManhuaWorks (脚本可能从任意位置调)
Set-Location D:\ManhuaWorks

# 颜色函数 (兼容老版 powershell 5.1)
function Write-Step  { param($m) Write-Host "[dev-start] ➜  $m" -ForegroundColor Cyan }
function Write-OK    { param($m) Write-Host "[dev-start] ✅ $m" -ForegroundColor Green }
function Write-Warn  { param($m) Write-Host "[dev-start] ⚠️  $m" -ForegroundColor Yellow }
function Write-Fail  { param($m) Write-Host "[dev-start] ❌ $m" -ForegroundColor Red }

# PID 和日志目录
$RunDir = '.run'
$LogDir = 'logs\dev'
$null = New-Item -Path $RunDir -ItemType Directory -Force
$null = New-Item -Path $LogDir -ItemType Directory -Force

# WhatIf handler
$WhatIfPref = $WhatIf.IsPresent

# ============================================================
#  0. 端口检查工具函数
#  Test-Port: 用 netstat 查端口, 返回 PID 列表 (空 = 没人)
# ============================================================
function Test-Port {
    param([int]$Port)
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) { return @() }
    return $conns | ForEach-Object { $_.OwningProcess }
}

# ============================================================
#  1. 检查 postgres 端口 (5432)
#  本地 dev 假设 postgres 跑在 5432 (用户自己装, 不在脚本里拉)
# ============================================================
if (-not $SkipPostgres -and -not $CheckOnly) {
    Write-Step "检查 postgres :5432 ..."
    $pgPids = Test-Port 5432
    if ($pgPids.Count -eq 0) {
        Write-Warn "postgres :5432 没监听, 先起 postgres 再跑 dev"
        Write-Warn "  Windows: net start postgresql-x64-16"
        Write-Warn "  Docker : docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16"
        if (-not $WhatIfPref) { exit 1 }
    } else {
        Write-OK "postgres :5432 OK (pid=$($pgPids -join ','))"
    }
}

# ============================================================
#  2. 进程定义
#  把 service / portal 全列出来, 后面循环起
#  name:     进程标识 (写 PID 文件用)
#  port:     监听端口
#  cmd:      启动命令
#  cwd:      工作目录
#  log:      日志文件
# ============================================================
$Services = @(
    [pscustomobject]@{ Name = 'user-service';    Port = 8088; Cmd = 'pnpm dev'; Cwd = 'services\user-service'    }
    [pscustomobject]@{ Name = 'project-service'; Port = 8089; Cmd = 'pnpm dev'; Cwd = 'services\project-service' }
    [pscustomobject]@{ Name = 'billing-service'; Port = 8090; Cmd = 'pnpm dev'; Cwd = 'services\billing-service' }
    [pscustomobject]@{ Name = 'collab-service';  Port = 8091; Cmd = 'pnpm dev'; Cwd = 'services\collab-service'  }
)

$Portals = @(
    [pscustomobject]@{ Name = 'web';         Port = 3000; Cmd = 'pnpm dev'; Cwd = 'apps\web'         }
    [pscustomobject]@{ Name = 'admin-portal'; Port = 5174; Cmd = 'pnpm dev'; Cwd = 'apps\admin-portal' }
    [pscustomobject]@{ Name = 'studio';      Port = 5175; Cmd = 'pnpm dev'; Cwd = 'apps\studio'      }
    [pscustomobject]@{ Name = 'user-portal'; Port = 5180; Cmd = 'pnpm dev'; Cwd = 'apps\user-portal' }
)

# ============================================================
#  3. 启动函数
#  Start-Process 跑后台:
#    -NoNewWindow: 不弹新窗口 (CI 友好)
#    -RedirectStandard*: 重定向 stdout/stderr 到 log
#    -PassThru: 返回 Process 对象, 拿 PID
# ============================================================
function Start-Backend {
    param($Proc)
    $pidFile = Join-Path $RunDir "$($Proc.Name).pid"
    $logFile = Join-Path $LogDir "$($Proc.Name).log"

    # 已经起过了? 查 PID 文件 + 端口
    $existingPids = Test-Port $Proc.Port
    if ($existingPids.Count -gt 0) {
        Write-OK "$($Proc.Name) :$($Proc.Port) 已在跑 (pid=$($existingPids -join ','))"
        return
    }

    Write-Step "起 $($Proc.Name) :$($Proc.Port)  (cwd=$($Proc.Cwd))"
    if ($WhatIfPref) {
        Write-Host "  WHATIF:  Set-Location $($Proc.Cwd); $((Get-Location).Path); Start-Process -FilePath 'pnpm' -ArgumentList 'dev' -WorkingDirectory '$($Proc.Cwd)' -RedirectStandardOutput '$logFile' -RedirectStandardError '$logFile.err' -NoNewWindow -PassThru | ForEach-Object { \$_.Id > '$pidFile' }"
        return
    }

    $proc = Start-Process -FilePath 'pnpm' -ArgumentList 'dev' `
        -WorkingDirectory $Proc.Cwd `
        -RedirectStandardOutput $logFile `
        -RedirectStandardError "$logFile.err" `
        -NoNewWindow -PassThru

    # 写 PID 文件
    $proc.Id | Out-File -FilePath $pidFile -Encoding ASCII
    Write-OK "$($Proc.Name) 启动中 pid=$($proc.Id), 日志 $logFile"
}

# ============================================================
#  4. 启动 service (后台)
# ============================================================
if (-not $SkipService) {
    Write-Step "===== 启动 4 service ====="
    foreach ($s in $Services) { Start-Backend $s }
}

# ============================================================
#  5. 启动 portal (后台)
# ============================================================
if (-not $SkipPortal) {
    Write-Step "===== 启动 4 portal (vite dev) ====="
    foreach ($p in $Portals) { Start-Backend $p }
}

# ============================================================
#  6. CheckOnly: 只检查端口监听, 不动进程
# ============================================================
if ($CheckOnly) {
    Write-Step "===== 端口监听状态 ====="
    $all = $Services + $Portals
    foreach ($x in $all) {
        $pids = Test-Port $x.Port
        if ($pids.Count -gt 0) {
            Write-OK ("{0,-18} :{1,-5} UP   pid={2}" -f $x.Name, $x.Port, ($pids -join ','))
        } else {
            Write-Warn ("{0,-18} :{1,-5} DOWN" -f $x.Name, $x.Port)
        }
    }
    return
}

# ============================================================
#  7. 等几秒, 跑一次端口自检
#  vite dev 冷启动 5-10s, service 起来快, 给 8s
# ============================================================
if (-not $WhatIfPref) {
    Write-Step "等 8s 让服务就绪..."
    Start-Sleep -Seconds 8
    Write-Step "===== 启动后自检 ====="
    $all = $Services + $Portals
    $failed = 0
    foreach ($x in $all) {
        $pids = Test-Port $x.Port
        if ($pids.Count -gt 0) {
            Write-OK ("{0,-18} :{1,-5} UP   pid={2}" -f $x.Name, $x.Port, ($pids -join ','))
        } else {
            Write-Fail ("{0,-18} :{1,-5} DOWN" -f $x.Name, $x.Port)
            Write-Host "  查日志: Get-Content $LogDir\$($x.Name).log -Tail 50"
            $failed++
        }
    }
}

# ============================================================
#  8. 打印访问入口
# ============================================================
Write-Host ""
Write-Step "===== 访问入口 ====="
Write-Host "  Web 主站        : http://localhost:3000"
Write-Host "  Admin 后台      : http://localhost:5174"
Write-Host "  Studio 工作台   : http://localhost:5175"
Write-Host "  User Portal     : http://localhost:5180"
Write-Host ""
Write-Host "  user-service    : http://localhost:8088  (auth/users/audit)"
Write-Host "  project-service : http://localhost:8089"
Write-Host "  billing-service : http://localhost:8090"
Write-Host "  collab-service  : http://localhost:8089  (ws /ws)"
Write-Host ""
Write-OK "全部就绪, 常用命令:"
Write-Host "  Get-Process -Name node | Format-Table Id, StartTime        # 看进程"
Write-Host "  Get-Content $LogDir\*.log -Tail 30                        # 实时日志"
Write-Host "  .\scripts\dev-stop.ps1                                     # 一键全停"
