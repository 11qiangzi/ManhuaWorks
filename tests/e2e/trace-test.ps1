# ManhuaWorks L2 task 14 — 端到端 trace 验证 (Windows PowerShell)
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File tests/e2e/trace-test.ps1
#   或带 env 覆盖：
#     $env:GATEWAY="http://localhost:8080"; .\trace-test.ps1

[CmdletBinding()]
param(
    [string]$Gateway = $env:GATEWAY,
    [string]$JaegerApi = $env:JAEGER_API,
    [string]$Otlp = $env:OTLP
)

if (-not $Gateway) { $Gateway = 'http://localhost:8080' }
if (-not $JaegerApi) { $JaegerApi = 'http://localhost:16686' }
if (-not $Otlp) { $Otlp = 'http://localhost:4318' }

Write-Host '=== ManhuaWorks trace 端到端验证 (Windows) ===' -ForegroundColor Cyan
Write-Host "GATEWAY     = $Gateway"
Write-Host "JAEGER_API  = $JaegerApi"
Write-Host "OTLP        = $Otlp"
Write-Host ''

# 1) 健康检查
Write-Host '[1/5] 健康检查...' -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "$Gateway/health" -TimeoutSec 5 | Out-Null
    Write-Host '  ✓ gateway OK'
} catch {
    Write-Error "FAIL: gateway 不可达: $_"; exit 1
}
try {
    Invoke-WebRequest -Uri "$JaegerApi/" -UseBasicParsing -TimeoutSec 5 | Out-Null
    Write-Host '  ✓ jaeger UI OK'
} catch {
    Write-Warning "  ⚠ jaeger UI 不可达（不影响 trace 注入，只影响验证）"
}

# 2) 拿 token
Write-Host ''
Write-Host '[2/5] 拿 dev token...' -ForegroundColor Yellow
$tokenBody = '{"sub":"usr_e2e","role":"L3","ttlSec":3600}'
try {
    $tokenResp = Invoke-RestMethod -Method POST -Uri "$Gateway/dev/token" `
        -ContentType 'application/json' -Body $tokenBody -TimeoutSec 5
} catch {
    Write-Error "FAIL: 拿 token 失败: $_"; exit 1
}
$token = $tokenResp.token
if (-not $token) { Write-Error 'FAIL: token 字段为空'; exit 1 }
Write-Host "  ✓ token length = $($token.Length)"

# 3) 跑流程
Write-Host ''
Write-Host '[3/5] 跑 auth + project + collab 流程...' -ForegroundColor Yellow

$steps = @(
    @{ Label='auth.me';        Method='GET';  Path='/v1/users/me';          Body=$null }
    @{ Label='project.list';   Method='GET';  Path='/v1/projects';          Body=$null }
    @{ Label='project.create'; Method='POST'; Path='/v1/projects';          Body='{"name":"trace-test","description":"e2e"}' }
    @{ Label='collab.rooms';   Method='GET';  Path='/v1/collab/rooms';      Body=$null }
)

$traceIds = @()

foreach ($s in $steps) {
    $headers = @{ Authorization = "Bearer $token" }
    if ($s.Body) { $headers['Content-Type'] = 'application/json' }
    try {
        $resp = Invoke-WebRequest -Method $s.Method -Uri "$Gateway$($s.Path)" `
            -Headers $headers -Body $s.Body -UseBasicParsing -TimeoutSec 10
        $tid = $resp.Headers['X-Trace-Id'] -join ''
    } catch {
        $tid = ''
    }
    $traceIds += $tid
    if ($tid) {
        Write-Host "  ✓ $($s.Label)  traceId=$tid"
    } else {
        Write-Host "  ✗ $($s.Label)  (no X-Trace-Id)" -ForegroundColor Red
    }
}

# 4) 汇总
Write-Host ''
Write-Host '[4/5] 汇总 traceId...' -ForegroundColor Yellow
for ($i = 0; $i -lt $steps.Count; $i++) {
    Write-Host "  [$($steps[$i].Label)]  traceId=$($traceIds[$i])"
}

# 5) Jaeger 验证
Write-Host ''
Write-Host '[5/5] 从 Jaeger 拉 trace...' -ForegroundColor Yellow
Start-Sleep -Seconds 3
$ok = 0; $fail = 0
foreach ($tid in $traceIds) {
    if (-not $tid) { $fail++; continue }
    try {
        $resp = Invoke-RestMethod -Uri "$JaegerApi/api/traces/$tid" -TimeoutSec 5
        $count = ($resp.data | ForEach-Object { $_.spans.Count } | Measure-Object -Sum).Sum
        if ($count -gt 0) {
            Write-Host "  ✓ traceId=$tid : $count span(s)" -ForegroundColor Green
            $ok++
        } else {
            Write-Host "  ✗ traceId=$tid : NOT FOUND" -ForegroundColor Red
            $fail++
        }
    } catch {
        Write-Host "  ✗ traceId=$tid : Jaeger 查询失败: $_" -ForegroundColor Red
        $fail++
    }
}

Write-Host ''
Write-Host '=== 完成 ===' -ForegroundColor Cyan
Write-Host "OK=$ok  FAIL=$fail"
Write-Host "浏览器打开 $JaegerApi 看 trace UI"
