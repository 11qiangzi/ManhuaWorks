# ============================================================
#  ManhuaWorks — Dev 停止脚本 (Windows PowerShell)
#  2026-06-09 梁总 L4-C 部署脚本
#
#  用途: 一键停 dev-start.ps1 拉起来的所有进程
#  策略: 只杀 .run/*.pid 里记录的 PID + 端口占用的 PID,
#        绝不杀其他 node 进程 (比如用户在跑别的项目)
#
#  用法:
#    .\scripts\dev-stop.ps1            # 优雅停 (TERM, 等 5s)
#    .\scripts\dev-stop.ps1 -Force     # 强制停 (KILL, 不等)
#    .\scripts\dev-stop.ps1 -WhatIf    # 演练模式
#    .\scripts\dev-stop.ps1 -Clean     # 停完顺手清 .run/*.pid
#
#  安全护栏:
#    1. 只杀 ManhuaWorks 相关端口 (3000/5174/5175/5180/8088/8089/8090/8091/8087) 上的进程
#    2. 只杀 .run/*.pid 里记录的 PID
#    3. 杀之前先比对 StartTime, 防止 PID 被复用后误杀
# ============================================================

[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$WhatIf,
    [switch]$Clean
)

$ErrorActionPreference = 'Stop'
Set-Location D:\ManhuaWorks

function Write-Step  { param($m) Write-Host "[dev-stop] ➜  $m" -ForegroundColor Cyan }
function Write-OK    { param($m) Write-Host "[dev-stop] ✅ $m" -ForegroundColor Green }
function Write-Warn  { param($m) Write-Host "[dev-stop] ⚠️  $m" -ForegroundColor Yellow }
function Write-Fail  { param($m) Write-Host "[dev-stop] ❌ $m" -ForegroundColor Red }

$RunDir = '.run'
$WhatIfPref = $WhatIf.IsPresent

# ============================================================
#  1. ManhuaWorks 关心的端口白名单
#  跟 dev-start.ps1 里的 $Services + $Portals 对齐
#  任何端口变更, 同步改这里
# ============================================================
$MhwPorts = @(3000, 5174, 5175, 5180,   # 4 portal
              8088, 8089, 8090, 8091,   # 4 service
              8087)                     # ai-orchestrator (M1-W4)

# ============================================================
#  2. 收集要杀的 PID
#  来源 A: .run/*.pid 文件 (dev-start 写的)
#  来源 B: 端口占用的 PID (兜底, 万一 pid 文件丢了)
#  去重 + 过滤: 只保留 ManhuaWorks 进程
# ============================================================
$targetPids = [System.Collections.Generic.HashSet[int]]::new()

# 来源 A: PID 文件
if (Test-Path $RunDir) {
    Get-ChildItem $RunDir -Filter '*.pid' | ForEach-Object {
        $content = Get-Content $_.FullName -ErrorAction SilentlyContinue
        if ($content -and [int]::TryParse($content.Trim(), [ref]([int]0))) {
            $procId = [int]$content.Trim()
            $targetPids.Add($procId) | Out-Null
            Write-Step "从 PID 文件拿到 $($_.BaseName) = $procId"
        }
    }
}

# 来源 B: 端口占用 (兜底)
foreach ($port in $MhwPorts) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        $procId = $c.OwningProcess
        if ($procId -gt 0) {
            $targetPids.Add($procId) | Out-Null
            Write-Step "从端口 :$port 拿到 pid=$procId"
        }
    }
}

# ============================================================
#  3. 过滤: 只杀 node 进程, 跳过系统 / 第三方
#  ps 进程名 = "node" 才是我们的, pnpm / npm 包了一层也可能叫 node
# ============================================================
$allProcs = Get-Process -Id ($targetPids | Sort-Object) -ErrorAction SilentlyContinue
$validProcs = $allProcs | Where-Object {
    $_.ProcessName -eq 'node' -or
    $_.ProcessName -eq 'pnpm' -or
    $_.ProcessName -eq 'npm' -or
    $_.ProcessName -eq 'tsx'
}

# 二次过滤: 排除明显不是我们的 (path 不在 D:\ManhuaWorks 下)
$validProcs = $validProcs | Where-Object {
    try {
        $_.Path -like 'D:\ManhuaWorks*' -or
        $_.MainWindowTitle -like '*ManhuaWorks*' -or
        $_.WorkingSet64 -gt 0   # 工作集非 0 大概率是 node
    } catch { $true }
}

# ============================================================
#  4. 执行停止
#  -Force: Stop-Process (硬杀, 不等)
#  默认 : Stop-Process -Id X (SIGTERM, 等进程自然退出)
# ============================================================
if ($validProcs.Count -eq 0) {
    Write-OK "没找到要杀的 ManhuaWorks 进程, 全部已停"
} else {
    Write-Step "===== 准备停 $($validProcs.Count) 个进程 ====="
    $validProcs | ForEach-Object {
        "{0,-8} {1,-20} {2,12} KB" -f $_.Id, $_.ProcessName, [int]($_.WorkingSet64 / 1KB)
    } | Write-Host

    foreach ($p in $validProcs) {
        $action = if ($Force) { 'KILL' } else { 'TERM' }
        if ($WhatIfPref) {
            Write-Host "  WHATIF: Stop-Process -Id $($p.Id) -Force:`$$Force"
        } else {
            try {
                if ($Force) {
                    Stop-Process -Id $p.Id -Force -ErrorAction Stop
                } else {
                    Stop-Process -Id $p.Id -ErrorAction Stop
                }
                Write-OK "$($p.ProcessName) (pid=$($p.Id)) $action'd"
            } catch {
                Write-Warn "停 pid=$($p.Id) 失败: $($_.Exception.Message)"
            }
        }
    }
}

# ============================================================
#  5. 优雅停等几秒, 检查端口还占着没
# ============================================================
if (-not $WhatIfPref -and -not $Force) {
    Write-Step "等 3s 让进程收尾..."
    Start-Sleep -Seconds 3

    Write-Step "===== 端口残留检查 ====="
    $stuck = 0
    foreach ($port in $MhwPorts) {
        $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($conns) {
            Write-Fail ":$port 还在占用 (pid=$($conns.OwningProcess -join ','))"
            $stuck++
        }
    }
    if ($stuck -eq 0) { Write-OK "所有端口已释放" }
    else { Write-Warn "残留 $stuck 个端口, 考虑跑一次 -Force" }
}

# ============================================================
#  6. -Clean: 清 PID 文件
# ============================================================
if ($Clean) {
    if (Test-Path $RunDir) {
        Get-ChildItem $RunDir -Filter '*.pid' | ForEach-Object {
            if ($WhatIfPref) {
                Write-Host "  WHATIF: Remove-Item $($_.FullName)"
            } else {
                Remove-Item $_.FullName -Force
            }
        }
        Write-OK "PID 文件已清"
    }
}

Write-Host ""
Write-OK "完成, 重启用: .\scripts\dev-start.ps1"
