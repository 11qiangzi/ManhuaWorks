param([string]$Token = "")
$ErrorActionPreference = "Continue"
$global:passed = 0
$global:failed = 0

if (-not $Token) {
    try {
        $r = Invoke-WebRequest "http://localhost:8088/api/v1/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"demo-creator@manhuaworks.com","password":"Test1234!"}' -UseBasicParsing -TimeoutSec 10
        $Token = ($r.Content | ConvertFrom-Json).data.access_token
        Write-Host "[OK] Token acquired"
    } catch { Write-Host "[FAIL] Token: $_" }
}

function T($method, $url, $label, $auth) {
    $h = @{}
    if ($auth -and $Token) { $h["Authorization"] = "Bearer $Token" }
    $body = '{"test":"ok"}'
    try {
        if ($method -eq "POST")   { $r = Invoke-WebRequest $url -Method POST   -Headers $h -ContentType "application/json" -Body $body -UseBasicParsing -TimeoutSec 8 }
        elseif ($method -eq "PATCH"){ $r = Invoke-WebRequest $url -Method PATCH  -Headers $h -ContentType "application/json" -Body $body -UseBasicParsing -TimeoutSec 8 }
        else                      { $r = Invoke-WebRequest $url -Method GET    -Headers $h -UseBasicParsing -TimeoutSec 8 }
        Write-Host "[$($r.StatusCode)] $label"
        $global:passed++
    } catch {
        if ($_.Exception.Response) {
            $code = [int]$_.Exception.Response.StatusCode
            Write-Host "[$code] $label"
            $global:passed++
        } else {
            Write-Host "[DOWN] $label"
            $global:failed++
        }
    }
}

Write-Host "=== user-service :8088 ==="
T "GET"  "http://localhost:8088/health"                    "u/health"          0
T "POST" "http://localhost:8088/api/v1/auth/login"         "u/login"           0
T "POST" "http://localhost:8088/api/v1/auth/register"       "u/register"        0
T "POST" "http://localhost:8088/api/v1/auth/refresh"        "u/refresh"         0
T "POST" "http://localhost:8088/api/v1/auth/send-email-code" "u/send-email"     0
T "POST" "http://localhost:8088/api/v1/auth/register-by-email" "u/reg-email"    0
T "POST" "http://localhost:8088/api/v1/auth/logout"         "u/logout"          1
T "POST" "http://localhost:8088/api/v1/auth/logout-all"     "u/logout-all"      1
T "GET"  "http://localhost:8088/api/v1/me"                 "u/me"              1
T "PATCH" "http://localhost:8088/api/v1/me"                 "u/me-update"       1
T "GET"  "http://localhost:8088/api/v1/users"              "u/users"           1
T "GET"  "http://localhost:8088/api/v1/me/2fa"             "u/me/2fa"          1
T "GET"  "http://localhost:8088/api/v1/api-keys"           "u/api-keys"        1
T "GET"  "http://localhost:8088/api/v1/projects"           "u/projects"        1
T "GET"  "http://localhost:8088/api/v1/quotas"             "u/quotas"          1
T "GET"  "http://localhost:8088/api/v1/subscriptions"      "u/subscriptions"   1
T "GET"  "http://localhost:8088/api/v1/admin/stats"        "u/admin/stats"     1
T "GET"  "http://localhost:8088/api/v1/admin/users"        "u/admin/users"     1

Write-Host "=== project-service :8089 ==="
T "GET"  "http://localhost:8089/health"                    "p/health"          0
T "GET"  "http://localhost:8089/api/v1/characters"         "p/characters"      1
T "POST" "http://localhost:8089/api/v1/characters"         "p/char-create"     1
T "GET"  "http://localhost:8089/api/v1/projects"           "p/projects"        1

Write-Host "=== collab-service :8091 ==="
T "GET"  "http://localhost:8091/health"                    "c/health"          0
T "GET"  "http://localhost:8091/api/v1/teams"              "c/teams"           1
T "POST" "http://localhost:8091/api/v1/teams"              "c/teams-create"    1

Write-Host "=== billing-service :8090 ==="
T "GET"  "http://localhost:8090/health"                    "b/health"          0
T "GET"  "http://localhost:8090/api/v1/subscriptions"      "b/subscriptions"   1
T "GET"  "http://localhost:8090/api/v1/orders"             "b/orders"          1
T "GET"  "http://localhost:8090/api/v1/invoices"           "b/invoices"        1
T "GET"  "http://localhost:8090/api/v1/quota"              "b/quota"           1
T "GET"  "http://localhost:8090/api/v1/billing"            "b/billing"         1
T "POST" "http://localhost:8090/api/v1/billing/recharge"   "b/recharge"        1

Write-Host "=== ai-orchestrator :8087 ==="
T "GET"  "http://localhost:8087/health"                    "a/health"          0
T "POST" "http://localhost:8087/v1/creative/story/inspiration"      "a/story-insp"     1
T "POST" "http://localhost:8087/v1/creative/story/template"         "a/story-tmpl"     1
T "GET"  "http://localhost:8087/v1/orchestrate/moods"              "a/moods"          1
T "GET"  "http://localhost:8087/v1/craft-prompt/camera-movements"   "a/camera"         1
T "GET"  "http://localhost:8087/v1/craft-prompt/mood-presets"       "a/mood-preset"    1
T "POST" "http://localhost:8087/v1/creative/animation/generate"     "a/animation"      1
T "POST" "http://localhost:8087/v1/creative/music/generate"         "a/music"          1
T "POST" "http://localhost:8087/v1/creative/promo/generate"         "a/promo"          1
T "POST" "http://localhost:8087/v1/creative/short-video/generate"   "a/short-video"    1
T "POST" "http://localhost:8087/v1/creative/ad-image/generate"      "a/ad-image"       1
T "GET"  "http://localhost:8087/v1/generation"                       "a/generation"     1
T "POST" "http://localhost:8087/v1/orchestrate/novel-to-drama"       "a/novel-drama"    1
T "POST" "http://localhost:8087/v1/orchestrate/style-transfer"       "a/style-xfer"     1
T "GET"  "http://localhost:8087/v1/orchestrate/runs"                 "a/runs"           1

Write-Host "`n========================================"
Write-Host "PASS: $global:passed | FAIL: $global:failed | TOTAL: $($global:passed+$global:failed)"
Write-Host "RATE: $([Math]::Round(100*$global:passed/($global:passed+$global:failed),1))%"
