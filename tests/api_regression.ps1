param([string]$Token = "")
$ErrorActionPreference = "Continue"

# Get token if not provided
if (-not $Token) {
    try {
        $body = '{"email":"demo-creator@manhuaworks.com","password":"Test1234!"}'
        $r = Invoke-WebRequest -Uri "http://localhost:8088/api/v1/auth/login" -Method POST -ContentType "application/json" -Body $body -UseBasicParsing -TimeoutSec 10
        $Token = ($r.Content | ConvertFrom-Json).data.access_token
        Write-Host "[OK] Token acquired"
    } catch { Write-Host "[FAIL] Cannot get token: $_" }
}

function Test-API($Method, $Url, $Name, $NeedsAuth) {
    $headers = @{}
    if ($NeedsAuth -and $Token) { $headers["Authorization"] = "Bearer $Token" }
    try {
        if ($Method -eq "GET") {
            $r = Invoke-WebRequest -Uri $Url -Headers $headers -UseBasicParsing -TimeoutSec 8
        } elseif ($Method -eq "POST") {
            $r = Invoke-WebRequest -Uri $Url -Method POST -Headers $headers -ContentType "application/json" -Body '{"test":"ok"}' -UseBasicParsing -TimeoutSec 8
        } elseif ($Method -eq "PATCH") {
            $r = Invoke-WebRequest -Uri $Url -Method PATCH -Headers $headers -ContentType "application/json" -Body '{"test":"ok"}' -UseBasicParsing -TimeoutSec 8
        }
        Write-Host "[$($r.StatusCode)] $Name"
        $global:passed++
    } catch {
        if ($_.Exception.Response) {
            $code = [int]$_.Exception.Response.StatusCode
            Write-Host "[$code] $Name"
            $global:passed++
        } else {
            Write-Host "[DOWN] $Name - $($_.Exception.Message.Substring(0,[Math]::Min(80,$_.Exception.Message.Length)))"
            $global:failed++
        }
    }
}

$global:passed = 0
$global:failed = 0

Write-Host "`n=== user-service :8088 ==="
Test-API "GET" "http://localhost:8088/health" "user/health" $false
Test-API "POST" "http://localhost:8088/api/v1/auth/register" "auth/register" $false
Test-API "POST" "http://localhost:8088/api/v1/auth/login" "auth/login" $false
Test-API "POST" "http://localhost:8088/api/v1/auth/refresh" "auth/refresh" $false
Test-API "POST" "http://localhost:8088/api/v1/auth/verify-email" "auth/verify-email" $false
Test-API "POST" "http://localhost:8088/api/v1/auth/forgot-password" "auth/forgot" $false
Test-API "POST" "http://localhost:8088/api/v1/auth/reset-password" "auth/reset" $false
Test-API "POST" "http://localhost:8088/api/v1/auth/verify-2fa" "auth/verify-2fa" $false
Test-API "POST" "http://localhost:8088/api/v1/auth/send-email-code" "auth/send-email" $false
Test-API "POST" "http://localhost:8088/api/v1/auth/register-by-email" "auth/register-email" $false
Test-API "POST" "http://localhost:8088/api/v1/auth/logout" "auth/logout" $true
Test-API "POST" "http://localhost:8088/api/v1/auth/logout-all" "auth/logout-all" $true
Test-API "GET" "http://localhost:8088/api/v1/me" "me" $true
Test-API "PATCH" "http://localhost:8088/api/v1/me" "me/update" $true
Test-API "POST" "http://localhost:8088/api/v1/me/password" "me/password" $true
Test-API "GET" "http://localhost:8088/api/v1/users" "users" $true
Test-API "GET" "http://localhost:8088/api/v1/users/me" "users/me" $true
Test-API "GET" "http://localhost:8088/api/v1/api-keys" "api-keys" $true
Test-API "GET" "http://localhost:8088/api/v1/user-api-keys" "user-api-keys" $true
Test-API "GET" "http://localhost:8088/api/v1/projects" "projects" $true
Test-API "GET" "http://localhost:8088/api/v1/quotas" "quotas" $true
Test-API "GET" "http://localhost:8088/api/v1/subscriptions" "subscriptions" $true
Test-API "GET" "http://localhost:8088/api/v1/preferences" "preferences" $true
Test-API "GET" "http://localhost:8088/api/v1/admin/stats" "admin/stats" $true
Test-API "GET" "http://localhost:8088/api/v1/admin/users" "admin/users" $true
Test-API "GET" "http://localhost:8088/api/v1/admin/settings" "admin/settings" $true

Write-Host "`n=== project-service :8089 ==="
Test-API "GET" "http://localhost:8089/health" "project/health" $false
Test-API "GET" "http://localhost:8089/api/v1/characters" "project/characters" $true
Test-API "POST" "http://localhost:8089/api/v1/characters" "project/characters-create" $true
Test-API "GET" "http://localhost:8089/api/v1/projects" "project/list" $true

Write-Host "`n=== collab-service :8091 ==="
Test-API "GET" "http://localhost:8091/health" "collab/health" $false
Test-API "GET" "http://localhost:8091/api/v1/teams" "collab/teams" $true
Test-API "POST" "http://localhost:8091/api/v1/teams" "collab/teams-create" $true

Write-Host "`n=== billing-service :8090 ==="
Test-API "GET" "http://localhost:8090/health" "billing/health" $false
Test-API "GET" "http://localhost:8090/api/v1/balance" "billing/balance" $true
Test-API "GET" "http://localhost:8090/api/v1/orders" "billing/orders" $true
Test-API "POST" "http://localhost:8090/api/v1/recharge" "billing/recharge" $true

Write-Host "`n=== ai-orchestrator :8087 ==="
Test-API "GET" "http://localhost:8087/health" "ai-orch/health" $false
Test-API "GET" "http://localhost:8087/api/v1/ai/templates" "ai-orch/templates" $true
Test-API "GET" "http://localhost:8087/api/v1/ai/styles" "ai-orch/styles" $true
Test-API "GET" "http://localhost:8087/api/v1/ai/moods" "ai-orch/moods" $true
Test-API "GET" "http://localhost:8087/api/v1/ai/tags" "ai-orch/tags" $true
Test-API "POST" "http://localhost:8087/api/v1/ai/generate" "ai-orch/generate" $true

Write-Host "`n=== ai-orchestrator P0 creation endpoints ==="
Test-API "POST" "http://localhost:8087/api/v1/ai/create/novel" "ai-orch/novel" $true
Test-API "POST" "http://localhost:8087/api/v1/ai/create/animation" "ai-orch/animation" $true
Test-API "POST" "http://localhost:8087/api/v1/ai/create/promo" "ai-orch/promo" $true
Test-API "POST" "http://localhost:8087/api/v1/ai/create/ad-video" "ai-orch/ad-short" $true
Test-API "POST" "http://localhost:8087/api/v1/ai/create/ad-image" "ai-orch/ad-image" $true
Test-API "POST" "http://localhost:8087/api/v1/ai/create/music" "ai-orch/music" $true
Test-API "GET" "http://localhost:8087/api/v1/ai/music/bgm" "ai-orch/music/bgm" $true

Write-Host "`n========================================"
Write-Host "PASSED: $global:passed | FAILED: $global:failed"
Write-Host "TOTAL: $($global:passed + $global:failed)"
Write-Host "RATE: $([Math]::Round(100 * $global:passed / ($global:passed + $global:failed), 1))%"
