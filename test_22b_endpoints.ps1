# test_22b_endpoints.ps1 — PowerShell 5 compatible
$adminToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJlbWFpbCI6ImFkbWluQG1hbmh1YXdvcmtzLmxvY2FsIiwicm9sZSI6NSwiZGlzcGxheU5hbWUiOiJBZG1pbiIsInR5cCI6ImFjY2VzcyIsImlhdCI6MTc4MTA3MDY2MSwiZXhwIjoxNzgxNjc1NDYxfQ.aUaN_0cwtnvLGikBXHuaheK6WgNUGwOWv7856QHP87U"
$creatorToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMDIiLCJlbWFpbCI6ImRlbW8tY3JlYXRvckBtYW5odWF3b3Jrcy5sb2NhbCIsInJvbGUiOjIsImRpc3BsYXlOYW1lIjoiRGVtb0NyZWF0b3IiLCJ0eXAiOiJhY2Nlc3MiLCJpYXQiOjE3ODEwNzA2NjcsImV4cCI6MTc4MTY3NTQ2N30.y411zQrCdpSZCvWq5fGIEvTNhbUZj302Ed4NBhVTPA4"

function Test-Endpoint {
    param($Method, $Url, $Token, $Body, $Desc, $ExpectCode = 200)
    $headers = @{}
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    try {
        $params = @{ Uri = $Url; Method = $Method; Headers = $headers }
        if ($Body) { $params["ContentType"] = "application/json"; $params["Body"] = $Body }
        $r = Invoke-WebRequest @params
        $code = $r.StatusCode
        if ($code -eq $ExpectCode) { $ok = "OK" } else { $ok = "FAIL(expected $ExpectCode)" }
        Write-Host "  $desc : $code $ok"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq $ExpectCode) { $ok = "OK" } else { $ok = "FAIL(expected $ExpectCode)" }
        Write-Host "  $desc : $code $ok"
    }
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 谢擎 派单22B 端点 cURL 批量验证" -ForegroundColor Cyan
Write-Host "=========================================="
Write-Host ""

# ─── D3 Characters (project-service 8089) ───
Write-Host "[D3] project-service characters" -ForegroundColor Yellow
Test-Endpoint -Method GET -Url "http://127.0.0.1:8089/api/v1/characters?projectId=10000000-0000-0000-0000-000000000001" -Token $creatorToken -Desc "GET characters list"
Test-Endpoint -Method POST -Url "http://127.0.0.1:8089/api/v1/characters" -Token $creatorToken -Desc "POST characters create" -Body '{"projectId":"10000000-0000-0000-0000-000000000001","name":"test-char-22c","archetype":"hero"}' -ExpectCode 201
Test-Endpoint -Method GET -Url "http://127.0.0.1:8089/api/v1/characters?projectId=10000000-0000-0000-0000-000000000001" -Token $null -Desc "No token => 401" -ExpectCode 401
Write-Host ""

# ─── D4 Collab Teams (collab-service 8091) ───
Write-Host "[D4] collab-service teams" -ForegroundColor Yellow
Test-Endpoint -Method POST -Url "http://127.0.0.1:8091/api/v1/teams" -Token $creatorToken -Desc "POST /teams create" -Body '{"name":"test-team-22c"}' -ExpectCode 201
Test-Endpoint -Method GET -Url "http://127.0.0.1:8091/api/v1/teams" -Token $creatorToken -Desc "GET /teams list"
Test-Endpoint -Method GET -Url "http://127.0.0.1:8091/api/v1/teams" -Token $null -Desc "No token => 401" -ExpectCode 401
Write-Host ""

# ─── D4 Admin (user-service 8088) ───
Write-Host "[D4] user-service admin" -ForegroundColor Yellow
Test-Endpoint -Method GET -Url "http://127.0.0.1:8088/api/v1/admin/stats" -Token $adminToken -Desc "GET /admin/stats"
Test-Endpoint -Method GET -Url "http://127.0.0.1:8088/api/v1/admin/audit-logs" -Token $adminToken -Desc "GET /admin/audit-logs"
Test-Endpoint -Method GET -Url "http://127.0.0.1:8088/api/v1/admin/settings" -Token $adminToken -Desc "GET /admin/settings"
Test-Endpoint -Method PATCH -Url "http://127.0.0.1:8088/api/v1/admin/settings" -Token $adminToken -Desc "PATCH /admin/settings" -Body '{"siteName":"test22c"}'
Test-Endpoint -Method GET -Url "http://127.0.0.1:8088/api/v1/admin/stats" -Token $creatorToken -Desc "Non-admin => 403" -ExpectCode 403
Write-Host ""

# ─── D4 Ops (user-service 8088) ───
Write-Host "[D4] user-service ops" -ForegroundColor Yellow
Test-Endpoint -Method GET -Url "http://127.0.0.1:8088/api/v1/ops/health" -Token $adminToken -Desc "GET /ops/health"
Test-Endpoint -Method GET -Url "http://127.0.0.1:8088/api/v1/ops/metrics" -Token $adminToken -Desc "GET /ops/metrics"
Test-Endpoint -Method GET -Url "http://127.0.0.1:8088/api/v1/ops/services" -Token $adminToken -Desc "GET /ops/services"
Write-Host ""

# ─── D5 Billing Admin (billing-service 8090) ───
Write-Host "[D5] billing-service admin" -ForegroundColor Yellow
Test-Endpoint -Method GET -Url "http://127.0.0.1:8090/api/v1/admin/billing/summary" -Token $adminToken -Desc "GET /admin/billing/summary"
Test-Endpoint -Method GET -Url "http://127.0.0.1:8090/api/v1/admin/billing/overview" -Token $adminToken -Desc "GET /admin/billing/overview"
Test-Endpoint -Method GET -Url "http://127.0.0.1:8090/api/v1/admin/refunds" -Token $adminToken -Desc "GET /admin/refunds"
Test-Endpoint -Method GET -Url "http://127.0.0.1:8090/api/v1/admin/billing/summary" -Token $creatorToken -Desc "Non-admin billing => 403" -ExpectCode 403
Write-Host ""

# ─── D5 AI BYOK (ai-orchestrator 8087) ───
Write-Host "[D5] ai-orchestrator BYOK" -ForegroundColor Yellow
Test-Endpoint -Method GET -Url "http://127.0.0.1:8087/api/v1/ai/byok" -Token $creatorToken -Desc "GET /ai/byok"
Test-Endpoint -Method GET -Url "http://127.0.0.1:8087/api/v1/ai/byok/quota" -Token $creatorToken -Desc "GET /ai/byok/quota"
Write-Host ""

# ─── D6 Rate-limit (4 services) ───
Write-Host "[D6] Rate-limit headers" -ForegroundColor Yellow
foreach ($svc in @("user", "project", "collab", "billing")) {
    $ports = @{user=8088; project=8089; collab=8091; billing=8090}
    $port = $ports[$svc]
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/health" -UseBasicParsing
        $rl = "MISSING"
        if ($r.Headers["X-RateLimit-Limit"]) { $rl = $r.Headers["X-RateLimit-Limit"] }
        elseif ($r.Headers["ratelimit-limit"]) { $rl = $r.Headers["ratelimit-limit"] }
        Write-Host "  $svc-service ($port): rate-limit=$rl"
    } catch {
        Write-Host "  $svc-service ($port): FAILED"
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 验证完成" -ForegroundColor Cyan
Write-Host "=========================================="
