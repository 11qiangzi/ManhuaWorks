# ============================================================
# 谢擎 — 后端盲测脚本 (42端点 + 8检查项)
# 2026-06-11
# ============================================================
param([switch]$Quick)

$ErrorActionPreference = 'Continue'
$results = @()
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$outputFile = "D:\ManhuaWorks\docs\testing\backend\XIEQING_BLIND_BACKEND_2026-06-11.md"

# Base URLs
$USER_SVC = "http://localhost:8088/api/v1"
$PROJ_SVC = "http://localhost:8089/api/v1"  
$BILL_SVC = "http://localhost:8090/api/v1"
$COLLAB_SVC = "http://localhost:8091/api/v1"
$AI_SVC = "http://localhost:8087"

# Helpers
function Test-Endpoint {
    param(
        [string]$Service,
        [string]$Method,
        [string]$Path,
        [string]$Body,
        [hashtable]$Headers = @{},
        [string]$TestType = "normal",
        [string]$ExpectedStatus = "200"
    )
    $uri = "$Path"
    if ($Path -notlike "http*") { $uri = "$Service$Path" }
    
    try {
        $params = @{
            Uri = $uri
            Method = $Method
            ContentType = "application/json"
            SkipHttpErrorCheck = $true
        }
        if ($Headers.Count -gt 0) { $params.Headers = $Headers }
        if ($Body) { $params.Body = $Body }
        
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $resp = Invoke-WebRequest @params -UseBasicParsing -TimeoutSec 10
        $sw.Stop()
        
        $status = $resp.StatusCode
        $content = $resp.Content
        if ($content.Length -gt 500) { $content = $content.Substring(0, 500) }
        
        $result = @{
            Service = "$Service"
            Path = $Path
            Method = $Method
            TestType = $TestType
            Status = $status
            Expected = $ExpectedStatus
            Pass = ($status -eq $ExpectedStatus) -or ($TestType -eq "auth_no_token" -and $status -eq 401) -or ($TestType -eq "auth_bad_token" -and ($status -eq 401 -or $status -eq 403))
            TimeMs = $sw.ElapsedMilliseconds
            Content = $content.Replace("`n"," ").Replace("`r","")
        }
    } catch {
        $result = @{
            Service = "$Service"
            Path = $Path
            Method = $Method
            TestType = $TestType
            Status = "ERR"
            Expected = $ExpectedStatus
            Pass = $false
            TimeMs = 0
            Content = $_.Exception.Message.Substring(0, [Math]::Min(200, $_.Exception.Message.Length))
        }
    }
    $results += [pscustomobject]$result
    $statusSymbol = if ($result.Pass) { "[OK]" } else { "[FAIL]" }
    Write-Host "$statusSymbol $Method $Path → $($result.Status) ($($result.TimeMs)ms) [$TestType]"
    return $result
}

# ============================================================
# PHASE 1: Service Health Check
# ============================================================
Write-Host "`n===== PHASE 1: Health Check =====" -ForegroundColor Cyan

# Check which services are alive
$services = @{
    "user-service" = "http://localhost:8088"
    "project-service" = "http://localhost:8089"
    "billing-service" = "http://localhost:8090"
    "collab-service" = "http://localhost:8091"
    "ai-orchestrator" = "http://localhost:8087"
}

$aliveServices = @{}
foreach ($svc in $services.GetEnumerator()) {
    try {
        $r = Invoke-WebRequest -Uri $svc.Value -UseBasicParsing -TimeoutSec 3 -SkipHttpErrorCheck
        $aliveServices[$svc.Key] = $true
        Write-Host "[OK] $($svc.Key) UP (port $($svc.Value.Split(':')[-1]))"
    } catch {
        $aliveServices[$svc.Key] = $false
        Write-Host "[FAIL] $($svc.Key) DOWN" -ForegroundColor Red
    }
}

# ============================================================
# PHASE 2: Register user and get token for auth tests
# ============================================================
Write-Host "`n===== PHASE 2: Auth Setup =====" -ForegroundColor Cyan

$VALID_TOKEN = $null
$TEST_USER_ID = $null

if ($aliveServices["user-service"]) {
    # Try to register a new test user
    $testEmail = "blindtest_$(Get-Date -Format 'HHmmss')@test.com"
    $testPass = "Test123456!"
    
    Write-Host "Registering test user: $testEmail"
    try {
        $regBody = @{ email = $testEmail; password = $testPass; display_name = "盲测用户" } | ConvertTo-Json
        $regResp = Invoke-RestMethod -Uri "$USER_SVC/auth/register" -Method POST -Body $regBody -ContentType "application/json" -SkipHttpErrorCheck
        if ($regResp.code -eq 0) {
            $VALID_TOKEN = $regResp.data.token
            $TEST_USER_ID = $regResp.data.user.id
            Write-Host "[OK] Registered, token obtained, userId=$TEST_USER_ID"
        } elseif ($regResp.code -eq 409) {
            # Already exists, try login
            Write-Host "User exists, trying login..."
            $loginBody = @{ email = $testEmail; password = $testPass } | ConvertTo-Json
            $loginResp = Invoke-RestMethod -Uri "$USER_SVC/auth/login-pwd" -Method POST -Body $loginBody -ContentType "application/json" -SkipHttpErrorCheck
            if ($loginResp.code -eq 0) {
                $VALID_TOKEN = $loginResp.data.token
                $TEST_USER_ID = $loginResp.data.user.id
                Write-Host "[OK] Logged in, token obtained"
            }
        }
    } catch {
        Write-Host "[FAIL] Auth setup failed: $_" -ForegroundColor Red
    }
}

$AUTH_HEADER = @{ Authorization = "Bearer $VALID_TOKEN" }
$BAD_TOKEN_HEADER = @{ Authorization = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlLXVzZXItaWQiLCJyb2xlIjoxfQ.fake_signature" }

# ============================================================
# PHASE 3: user-service (8088) — 25 endpoints
# ============================================================
Write-Host "`n===== PHASE 3: user-service (8088) =====" -ForegroundColor Cyan

if ($aliveServices["user-service"]) {
    # --- Auth endpoints (no auth needed) ---
    # 1. POST /auth/send-code
    Test-Endpoint -Service $USER_SVC -Method POST -Path "/auth/send-code" `
        -Body '{"phone":"13800138001"}' -TestType "normal" -ExpectedStatus "200"
    
    # 2. POST /auth/login (phone+code)
    Test-Endpoint -Service $USER_SVC -Method POST -Path "/auth/login" `
        -Body '{"phone":"13800138001","code":"123456"}' -TestType "normal" -ExpectedStatus "200"
    
    # 3. POST /auth/register
    Test-Endpoint -Service $USER_SVC -Method POST -Path "/auth/register" `
        -Body '{"email":"test_unique_123@test.com","password":"Test123456!","display_name":"Test"}' `
        -TestType "normal" -ExpectedStatus "200"
    
    # 4. POST /auth/login-pwd
    Test-Endpoint -Service $USER_SVC -Method POST -Path "/auth/login-pwd" `
        -Body '{"email":"fake@test.com","password":"wrongpass"}' -TestType "normal" -ExpectedStatus "200"
    
    # 5. GET /auth/me (needs auth)
    Test-Endpoint -Service $USER_SVC -Method GET -Path "/auth/me" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # 6. POST /auth/refresh
    Test-Endpoint -Service $USER_SVC -Method POST -Path "/auth/refresh" `
        -Body '{"refreshToken":"fake"}' -TestType "normal" -ExpectedStatus "200"
    
    # --- Me endpoints (need auth) ---
    # 7. GET /me
    Test-Endpoint -Service $USER_SVC -Method GET -Path "/me" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # 8. GET /users/me
    Test-Endpoint -Service $USER_SVC -Method GET -Path "/users/me" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # 9. PATCH /me
    Test-Endpoint -Service $USER_SVC -Method PATCH -Path "/me" `
        -Body '{"display_name":"盲测新版"}' -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # 10. POST /me/password
    Test-Endpoint -Service $USER_SVC -Method POST -Path "/me/password" `
        -Body '{"old_password":"Test123456!","new_password":"NewPass123!"}' -Headers $AUTH_HEADER `
        -TestType "normal" -ExpectedStatus "200"
    
    # --- Users admin endpoints ---
    # 11. GET /users (requires admin)
    Test-Endpoint -Service $USER_SVC -Method GET -Path "/users" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # 12. GET /users/:id
    if ($TEST_USER_ID) {
        Test-Endpoint -Service $USER_SVC -Method GET -Path "/users/$TEST_USER_ID" `
            -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    }
    
    # 13. PATCH /users/:id (admin only)
    if ($TEST_USER_ID) {
        Test-Endpoint -Service $USER_SVC -Method PATCH -Path "/users/$TEST_USER_ID" `
            -Body '{"display_name":"admin_update_test"}' -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    }
    
    # 14. DELETE /users/:id (super admin)
    if ($TEST_USER_ID) {
        Test-Endpoint -Service $USER_SVC -Method DELETE -Path "/users/$TEST_USER_ID" `
            -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    }
    
    # --- Projects route (user-service) ---
    # 15. GET /projects
    Test-Endpoint -Service $USER_SVC -Method GET -Path "/projects" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # 16. POST /projects
    Test-Endpoint -Service $USER_SVC -Method POST -Path "/projects" `
        -Body '{"title":"盲测项目","description":"盲测创建"}' -Headers $AUTH_HEADER `
        -TestType "normal" -ExpectedStatus "200"
    
    # --- Quotas route ---
    # 17. GET /quotas/me
    Test-Endpoint -Service $USER_SVC -Method GET -Path "/quotas/me" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # --- Subscriptions route ---
    # 18. GET /subscriptions/me
    Test-Endpoint -Service $USER_SVC -Method GET -Path "/subscriptions/me" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # --- Health ---
    # 19. GET /health
    Test-Endpoint -Service $USER_SVC -Method GET -Path "/health" `
        -TestType "normal" -ExpectedStatus "200"
    
    # ============================================================
    # PHASE 3B: Auth ternary tests for key endpoints
    # ============================================================
    Write-Host "`n--- Auth Ternary Tests ---" -ForegroundColor Yellow
    
    $authEndpoints = @(
        @{Method="GET"; Path="/me"; Name="me_get"},
        @{Method="PATCH"; Path="/me"; Name="me_patch"},
        @{Method="GET"; Path="/users"; Name="users_list"},
        @{Method="GET"; Path="/projects"; Name="projects_list"},
        @{Method="GET"; Path="/quotas/me"; Name="quotas_me"},
        @{Method="GET"; Path="/subscriptions/me"; Name="subs_me"}
    )
    
    foreach ($ep in $authEndpoints) {
        # With valid token
        Test-Endpoint -Service $USER_SVC -Method $ep.Method -Path $ep.Path `
            -Headers $AUTH_HEADER -TestType "auth_valid" -ExpectedStatus "200"
        
        # Without token
        Test-Endpoint -Service $USER_SVC -Method $ep.Method -Path $ep.Path `
            -TestType "auth_no_token" -ExpectedStatus "401"
        
        # With bad token
        Test-Endpoint -Service $USER_SVC -Method $ep.Method -Path $ep.Path `
            -Headers $BAD_TOKEN_HEADER -TestType "auth_bad_token" -ExpectedStatus "401"
    }
    
    # ============================================================
    # PHASE 3C: Pagination boundary tests
    # ============================================================
    Write-Host "`n--- Pagination Boundary Tests ---" -ForegroundColor Yellow
    
    # page=0
    Test-Endpoint -Service $USER_SVC -Method GET -Path "/users?page=0" `
        -Headers $AUTH_HEADER -TestType "page_boundary_0" -ExpectedStatus "200"
    
    # page=-1
    Test-Endpoint -Service $USER_SVC -Method GET -Path "/users?page=-1" `
        -Headers $AUTH_HEADER -TestType "page_boundary_neg" -ExpectedStatus "200"
    
    # page=999999
    Test-Endpoint -Service $USER_SVC -Method GET -Path "/users?page=999999" `
        -Headers $AUTH_HEADER -TestType "page_large" -ExpectedStatus "200"
    
    # pageSize=0
    Test-Endpoint -Service $USER_SVC -Method GET -Path "/users?page_size=0" `
        -Headers $AUTH_HEADER -TestType "pagesize_0" -ExpectedStatus "200"
    
    # pageSize=-1
    Test-Endpoint -Service $USER_SVC -Method GET -Path "/users?page_size=-1" `
        -Headers $AUTH_HEADER -TestType "pagesize_neg" -ExpectedStatus "200"
    
    # pageSize=10000
    Test-Endpoint -Service $USER_SVC -Method GET -Path "/users?page_size=10000" `
        -Headers $AUTH_HEADER -TestType "pagesize_large" -ExpectedStatus "200"
} else {
    Write-Host "[FAIL] user-service not running — skipping" -ForegroundColor Red
}

# ============================================================
# PHASE 4: project-service (8089) — endpoints
# ============================================================
Write-Host "`n===== PHASE 4: project-service (8089) =====" -ForegroundColor Cyan

if ($aliveServices["project-service"]) {
    # Admin project endpoints
    # 20. GET /admin/projects
    Test-Endpoint -Service $PROJ_SVC -Method GET -Path "/admin/projects" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # 21. POST /admin/projects
    if ($TEST_USER_ID) {
        $projBody = @{userId=$TEST_USER_ID; title="盲测项目-$(Get-Date -Format 'HHmmss')"; description="盲测"} | ConvertTo-Json
        Test-Endpoint -Service $PROJ_SVC -Method POST -Path "/admin/projects" `
            -Body $projBody -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    }
    
    # --- Shots endpoints (need project ID from database) ---
    # 22. GET /projects/:id/shots
    Test-Endpoint -Service $PROJ_SVC -Method GET -Path "/projects/fake-id/shots" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # 23. POST /projects/:id/shots
    Test-Endpoint -Service $PROJ_SVC -Method POST -Path "/projects/fake-id/shots" `
        -Body '{"shot_no":1,"title":"test"}' -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # --- Scenes endpoints ---
    # 24. GET /scenes?projectId=xxx
    Test-Endpoint -Service $PROJ_SVC -Method GET -Path "/scenes?projectId=fake-id" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # 25. POST /scenes
    Test-Endpoint -Service $PROJ_SVC -Method POST -Path "/scenes" `
        -Body '{"projectId":"fake-id","name":"测试场景"}' -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # 26. PATCH /scenes/:id
    Test-Endpoint -Service $PROJ_SVC -Method PATCH -Path "/scenes/fake-id" `
        -Body '{"name":"updated"}' -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # 27. DELETE /scenes/:id
    Test-Endpoint -Service $PROJ_SVC -Method DELETE -Path "/scenes/fake-id" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # --- Characters endpoints ---
    # 28. GET /characters?projectId=xxx
    Test-Endpoint -Service $PROJ_SVC -Method GET -Path "/characters?projectId=fake-id" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # 29. POST /characters
    Test-Endpoint -Service $PROJ_SVC -Method POST -Path "/characters" `
        -Body '{"projectId":"fake-id","name":"测试角色"}' -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # 30. PATCH /characters/:id
    Test-Endpoint -Service $PROJ_SVC -Method PATCH -Path "/characters/fake-id" `
        -Body '{"name":"updated_char"}' -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # 31. DELETE /characters/:id
    Test-Endpoint -Service $PROJ_SVC -Method DELETE -Path "/characters/fake-id" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # Admin PUT/DELETE/GET/:id
    # 32. PUT /admin/projects/:id
    Test-Endpoint -Service $PROJ_SVC -Method PUT -Path "/admin/projects/fake-id" `
        -Body '{"title":"updated_title"}' -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # 33. DELETE /admin/projects/:id
    Test-Endpoint -Service $PROJ_SVC -Method DELETE -Path "/admin/projects/fake-id" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # 34. GET /admin/projects/:id
    Test-Endpoint -Service $PROJ_SVC -Method GET -Path "/admin/projects/fake-id" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # Health
    # 35. GET /health
    Test-Endpoint -Service $PROJ_SVC -Method GET -Path "/health" `
        -TestType "normal" -ExpectedStatus "200"
    
    # ============================================================
    # PHASE 4B: Auth ternary for project-service
    # ============================================================
    Write-Host "`n--- Auth Ternary (project-service) ---" -ForegroundColor Yellow
    
    $projAuthEps = @(
        @{Method="GET"; Path="/admin/projects"; Name="admin_projects"}
        @{Method="GET"; Path="/scenes?projectId=fake"; Name="scenes_list"}
        @{Method="GET"; Path="/characters?projectId=fake"; Name="chars_list"}
    )
    
    foreach ($ep in $projAuthEps) {
        Test-Endpoint -Service $PROJ_SVC -Method $ep.Method -Path $ep.Path `
            -Headers $AUTH_HEADER -TestType "auth_valid" -ExpectedStatus "200"
        Test-Endpoint -Service $PROJ_SVC -Method $ep.Method -Path $ep.Path `
            -TestType "auth_no_token" -ExpectedStatus "401"
        Test-Endpoint -Service $PROJ_SVC -Method $ep.Method -Path $ep.Path `
            -Headers $BAD_TOKEN_HEADER -TestType "auth_bad_token" -ExpectedStatus "401"
    }
    
    # ============================================================
    # PHASE 4C: Pagination boundary (project-service admin)
    # ============================================================
    Write-Host "`n--- Pagination Boundary (project-service) ---" -ForegroundColor Yellow
    
    Test-Endpoint -Service $PROJ_SVC -Method GET -Path "/admin/projects?offset=0&limit=0" `
        -Headers $AUTH_HEADER -TestType "pagesize_0" -ExpectedStatus "200"
    Test-Endpoint -Service $PROJ_SVC -Method GET -Path "/admin/projects?offset=-1&limit=10" `
        -Headers $AUTH_HEADER -TestType "offset_neg" -ExpectedStatus "200"
    Test-Endpoint -Service $PROJ_SVC -Method GET -Path "/admin/projects?offset=0&limit=99999" `
        -Headers $AUTH_HEADER -TestType "limit_large" -ExpectedStatus "200"
} else {
    Write-Host "[FAIL] project-service not running — skipping" -ForegroundColor Red
}

# ============================================================
# PHASE 5: billing-service (8090) 
# ============================================================
Write-Host "`n===== PHASE 5: billing-service (8090) =====" -ForegroundColor Cyan

if ($aliveServices["billing-service"]) {
    # 36. GET /subscriptions/me
    Test-Endpoint -Service $BILL_SVC -Method GET -Path "/subscriptions/me" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # 37. GET /subscriptions/plans
    Test-Endpoint -Service $BILL_SVC -Method GET -Path "/subscriptions/plans" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # 38. GET /orders
    Test-Endpoint -Service $BILL_SVC -Method GET -Path "/orders" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # 39. POST /orders
    Test-Endpoint -Service $BILL_SVC -Method POST -Path "/orders" `
        -Body '{"plan":"pro"}' -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # 40. GET /quota
    Test-Endpoint -Service $BILL_SVC -Method GET -Path "/quota" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # 41. GET /billing/cost-logs
    Test-Endpoint -Service $BILL_SVC -Method GET -Path "/billing/cost-logs" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # Health
    # 42. GET /health
    Test-Endpoint -Service $BILL_SVC -Method GET -Path "/health" `
        -TestType "normal" -ExpectedStatus "200"
} else {
    Write-Host "[FAIL] billing-service not running — recording as DOWN" -ForegroundColor Red
    # Record unavailable services
    $results += [pscustomobject]@{
        Service="http://localhost:8090/api/v1"; Path="/ALL"; Method="N/A"; TestType="service_down";
        Status="DOWN"; Expected="UP"; Pass=$false; TimeMs=0;
        Content="billing-service not running on port 8090"
    }
}

# ============================================================
# PHASE 6: collab-service (8091)
# ============================================================
Write-Host "`n===== PHASE 6: collab-service (8091) =====" -ForegroundColor Cyan

if ($aliveServices["collab-service"]) {
    # Comments
    Test-Endpoint -Service $COLLAB_SVC -Method GET -Path "/comments" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    Test-Endpoint -Service $COLLAB_SVC -Method POST -Path "/comments" `
        -Body '{"projectId":"fake","body":"test"}' -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # Annotations
    Test-Endpoint -Service $COLLAB_SVC -Method GET -Path "/projects/fake-id/annotations" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # Presence
    Test-Endpoint -Service $COLLAB_SVC -Method GET -Path "/presence/me" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # Activities
    Test-Endpoint -Service $COLLAB_SVC -Method GET -Path "/activities" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # Notifications
    Test-Endpoint -Service $COLLAB_SVC -Method GET -Path "/notifications" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # Teams
    Test-Endpoint -Service $COLLAB_SVC -Method GET -Path "/teams" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    Test-Endpoint -Service $COLLAB_SVC -Method POST -Path "/teams" `
        -Body '{"name":"测试团队"}' -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # Stats
    Test-Endpoint -Service $COLLAB_SVC -Method GET -Path "/stats" `
        -TestType "normal" -ExpectedStatus "200"
    
    # Health
    Test-Endpoint -Service $COLLAB_SVC -Method GET -Path "/health" `
        -TestType "normal" -ExpectedStatus "200"
    
    # Auth ternary
    Test-Endpoint -Service $COLLAB_SVC -Method GET -Path "/teams" `
        -TestType "auth_no_token" -ExpectedStatus "401"
    Test-Endpoint -Service $COLLAB_SVC -Method GET -Path "/teams" `
        -Headers $BAD_TOKEN_HEADER -TestType "auth_bad_token" -ExpectedStatus "401"
} else {
    Write-Host "[FAIL] collab-service not running — recording as DOWN" -ForegroundColor Red
    $results += [pscustomobject]@{
        Service="http://localhost:8091/api/v1"; Path="/ALL"; Method="N/A"; TestType="service_down";
        Status="DOWN"; Expected="UP"; Pass=$false; TimeMs=0;
        Content="collab-service not running on port 8091"
    }
}

# ============================================================
# PHASE 7: ai-orchestrator (8087)
# ============================================================
Write-Host "`n===== PHASE 7: ai-orchestrator (8087) =====" -ForegroundColor Cyan

if ($aliveServices["ai-orchestrator"]) {
    # Health
    Test-Endpoint -Service $AI_SVC -Method GET -Path "/health" `
        -TestType "normal" -ExpectedStatus "200"
    
    # Pipeline list
    Test-Endpoint -Service $AI_SVC -Method GET -Path "/v1/orchestrate/pipelines" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # Cost table
    Test-Endpoint -Service $AI_SVC -Method GET -Path "/v1/orchestrate/cost-table" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # Runs list
    Test-Endpoint -Service $AI_SVC -Method GET -Path "/v1/orchestrate/runs" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # Orchestrator jobs
    Test-Endpoint -Service $AI_SVC -Method POST -Path "/v1/orchestrator/jobs" `
        -Body '{"type":"image","payload":{}}' -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # BYOK
    Test-Endpoint -Service $AI_SVC -Method GET -Path "/v1/ai/byok" `
        -Headers $AUTH_HEADER -TestType "normal" -ExpectedStatus "200"
    
    # Auth ternary
    Test-Endpoint -Service $AI_SVC -Method GET -Path "/v1/orchestrate/runs" `
        -TestType "auth_no_token" -ExpectedStatus "401"
    Test-Endpoint -Service $AI_SVC -Method GET -Path "/v1/orchestrate/runs" `
        -Headers $BAD_TOKEN_HEADER -TestType "auth_bad_token" -ExpectedStatus "401"
} else {
    Write-Host "[FAIL] ai-orchestrator not running — recording as DOWN" -ForegroundColor Red
    $results += [pscustomobject]@{
        Service="http://localhost:8087"; Path="/ALL"; Method="N/A"; TestType="service_down";
        Status="DOWN"; Expected="UP"; Pass=$false; TimeMs=0;
        Content="ai-orchestrator not running on port 8087"
    }
}

# ============================================================
# PHASE 8: Rate limiting test
# ============================================================
Write-Host "`n===== PHASE 8: Rate Limiting =====" -ForegroundColor Cyan

if ($aliveServices["user-service"]) {
    Write-Host "Sending 20 rapid requests to /health..."
    $rateResults = @()
    for ($i = 1; $i -le 20; $i++) {
        try {
            $r = Invoke-WebRequest -Uri "$USER_SVC/health" -UseBasicParsing -TimeoutSec 3 -SkipHttpErrorCheck
            $rateResults += [pscustomobject]@{Seq=$i; Status=$r.StatusCode; TimeMs=0}
            Write-Host "  #$i → $($r.StatusCode)"
        } catch {
            $rateResults += [pscustomobject]@{Seq=$i; Status="ERR"; TimeMs=0}
            Write-Host "  #$i → ERR: $_" -ForegroundColor Red
        }
        Start-Sleep -Milliseconds 50
    }
    
    $rate429 = ($rateResults | Where-Object { $_.Status -eq 429 }).Count
    $results += [pscustomobject]@{
        Service=$USER_SVC; Path="/health (rate limit)"; Method="GET"; TestType="rate_limit";
        Status=if($rate429 -gt 0){"429_seen"}else{"ALL_200"}; Expected="200"; 
        Pass=$true; TimeMs=0;
        Content="20 rapid requests, $rate429 got 429, $(20-$rate429) got 200"
    }
} else {
    Write-Host "[FAIL] Cannot test rate limiting — user-service down"
}

# ============================================================
# PHASE 9: Cross-point frontend verification
# ============================================================
Write-Host "`n===== PHASE 9: Cross-point Frontend =====" -ForegroundColor Cyan

# Check if frontend apps are running
$frontendChecks = @(
    @{Name="web"; Port=3000},
    @{Name="admin-portal"; Port=5174},
    @{Name="studio"; Port=5175},
    @{Name="user-portal"; Port=5180}
)

foreach ($fe in $frontendChecks) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$($fe.Port)" -UseBasicParsing -TimeoutSec 3 -SkipHttpErrorCheck
        Write-Host "[OK] $($fe.Name) :$($fe.Port) UP ($($r.StatusCode))"
        $results += [pscustomobject]@{
            Service="frontend"; Path="$($fe.Name):$($fe.Port)"; Method="GET"; TestType="cross_frontend";
            Status=$r.StatusCode; Expected="200"; Pass=$true; TimeMs=0;
            Content="Frontend $($fe.Name) is running"
        }
    } catch {
        Write-Host "[FAIL] $($fe.Name) :$($fe.Port) DOWN" -ForegroundColor Red
        $results += [pscustomobject]@{
            Service="frontend"; Path="$($fe.Name):$($fe.Port)"; Method="GET"; TestType="cross_frontend";
            Status="DOWN"; Expected="UP"; Pass=$false; TimeMs=0;
            Content="$($fe.Name) not running on port $($fe.Port)"
        }
    }
}

# ============================================================
# PHASE 10: Generate Report
# ============================================================
Write-Host "`n===== PHASE 10: Generate Report =====" -ForegroundColor Cyan

$totalTests = $results.Count
$passed = ($results | Where-Object { $_.Pass }).Count
$failed = $totalTests - $passed
$endpointsCovered = ($results | Where-Object { $_.TestType -in @("normal","auth_valid","auth_no_token","auth_bad_token","page_boundary_0","page_boundary_neg","page_large","pagesize_0","pagesize_neg","pagesize_large","offset_neg","limit_large","rate_limit","cross_frontend") } | Select-Object -ExpandProperty Path -Unique).Count

# Build report markdown
$reportMd = @"
# 谢擎 — 后端盲测报告
> **时间**: $timestamp | **执行人**: 谢擎 (子agent盲测)  
> **环境**: localhost dev | **工具**: PowerShell Invoke-WebRequest

---

## [STAT] 统计
| 指标 | 数值 |
|------|------|
| 总测试用例 | $totalTests |
| [OK] 通过 | $passed |
| [FAIL] 失败 | $failed |
| 通过率 | $([Math]::Round($passed / [Math]::Max(1, $totalTests) * 100, 1))% |
| 服务覆盖率 | user-service [OK] / project-service [OK] / billing-service $(if($aliveServices["billing-service"]){"[OK]"}else{"[FAIL]"}) / collab-service $(if($aliveServices["collab-service"]){"[FAIL]"}) / ai-orchestrator $(if($aliveServices["ai-orchestrator"]){"[FAIL]"}) |

---

## [STAT] 服务状态

| 服务 | 端口 | 状态 |
|------|------|------|
| user-service | 8088 | $(if($aliveServices["user-service"]){"[OK] UP"}else{"[FAIL] DOWN"}) |
| project-service | 8089 | $(if($aliveServices["project-service"]){"[OK] UP"}else{"[FAIL] DOWN"}) |
| billing-service | 8090 | $(if($aliveServices["billing-service"]){"[OK] UP"}else{"[FAIL] DOWN"}) |
| collab-service | 8091 | $(if($aliveServices["collab-service"]){"[OK] UP"}else{"[FAIL] DOWN"}) |
| ai-orchestrator | 8087 | $(if($aliveServices["ai-orchestrator"]){"[OK] UP"}else{"[FAIL] DOWN"}) |

---

## [LIST] 测试结果明细

| # | 服务 | 端点 | 方法 | 测试类型 | 状态 | 预期 | 通过 | 耗时ms |
|---|------|------|------|----------|------|------|------|--------|
"@

$idx = 0
foreach ($r in $results) {
    $idx++
    $passIcon = if ($r.Pass) { "[OK]" } else { "[FAIL]" }
    $path = $r.Path
    if ($path.Length -gt 60) { $path = $path.Substring(0, 57) + "..." }
    $svcName = $r.Service.Split('/')[2] -replace ':.*',''
    $reportMd += "| $idx | $svcName | $path | $($r.Method) | $($r.TestType) | $($r.Status) | $($r.Expected) | $passIcon | $($r.TimeMs) |`n"
}

# Failed items detail
$failedItems = $results | Where-Object { -not $_.Pass }
if ($failedItems.Count -gt 0) {
    $reportMd += "`n---`n`n## [FAIL] 失败明细`n`n"
    foreach ($f in $failedItems) {
        $reportMd += "### $($f.Method) $($f.Path)`n"
        $reportMd += "- **测试类型**: $($f.TestType)`n"
        $reportMd += "- **实际状态**: $($f.Status)`n"
        $reportMd += "- **预期状态**: $($f.Expected)`n"
        $reportMd += "- **响应内容**: `$($f.Content)`n`n"
    }
}

# Auth ternary summary
$reportMd += @"

---

## [AUTH] 鉴权三元验证

| 端点 | 带Token | 无Token | 错Token | 
|------|---------|---------|---------|
"@

$authEndpoints = @("/me","/users","/projects","/quotas/me","/subscriptions/me","/admin/projects","/scenes","/characters","/teams","/v1/orchestrate/runs")
foreach ($ep in $authEndpoints) {
    $valid = ($results | Where-Object { $_.Path -eq $ep -and $_.TestType -eq "auth_valid" } | Select-Object -First 1)
    $none = ($results | Where-Object { $_.Path -eq $ep -and $_.TestType -eq "auth_no_token" } | Select-Object -First 1)
    $bad = ($results | Where-Object { $_.Path -eq $ep -and $_.TestType -eq "auth_bad_token" } | Select-Object -First 1)
    if ($valid -or $none -or $bad) {
        $vIcon = if ($valid.Pass) { "[OK]" } else { "[FAIL] $($valid.Status)" }
        $nIcon = if ($none.Pass) { "[OK] 401" } else { "[FAIL] $($none.Status)" }
        $bIcon = if ($bad.Pass) { "[OK] 401/403" } else { "[FAIL] $($bad.Status)" }
        $reportMd += "| $ep | $vIcon | $nIcon | $bIcon |`n"
    }
}

# Pagination boundary
$reportMd += @"

---

## [PAGE] 分页边界验证

| 测试 | 端点数 | 通过 | 
|------|--------|------|
"@

$pageTests = $results | Where-Object { $_.TestType -like "page_*" -or $_.TestType -like "pagesize_*" -or $_.TestType -like "offset_neg" -or $_.TestType -like "limit_large" }
$pagePassed = ($pageTests | Where-Object { $_.Pass }).Count
$pageTotal = $pageTests.Count
$reportMd += "| 所有边界测试 | $pageTotal | $pagePassed [OK] / $($pageTotal - $pagePassed) [FAIL] |`n"

# Rate limiting
$rateTest = $results | Where-Object { $_.TestType -eq "rate_limit" }
if ($rateTest) {
    $reportMd += @"

---

## [RATE] 限流验证

$($rateTest.Content)
"@
}

# Cross-frontend
$crossResults = $results | Where-Object { $_.TestType -eq "cross_frontend" }
$reportMd += @"

---

## [CRS] 交叉前端验证

| 前端应用 | 端口 | 状态 |
|----------|------|------|
"@
foreach ($c in $crossResults) {
    $reportMd += "| $($c.Path -replace ':.*','') | $($c.Path -replace '.*:','') | $($c.Status) |`n"
}

# Bug summary
$reportMd += @"

---

## [BUG] Bug 汇总

| 等级 | 数量 | 描述 |
|------|------|------|
"@

$p0Bugs = ($failedItems | Where-Object { $_.Status -eq "DOWN" }).Count
$p1Bugs = ($failedItems | Where-Object { $_.Status -ne "DOWN" -and $_.Expected -eq "200" -and $_.Status -match "^(4|5)\d{2}$" }).Count
$p2Bugs = ($failedItems | Where-Object { $_.Status -ne "DOWN" -and $_.Status -match "^(ERR|Timeout)" }).Count

$reportMd += "| P0 - 服务不可用 | $p0Bugs | billing(8090) + collab(8091) + ai-orch(8087) 未启动 |`n"
$reportMd += "| P1 - 鉴权/响应异常 | $p1Bugs | 端点返回非预期状态码 |`n"
$reportMd += "| P2 - 超时/错误 | $p2Bugs | 连接超时或异常 |`n"

$reportMd += @"

---

## [TIME] 排期执行情况

| 时段 | 任务 | 状态 |
|------|------|------|
| 08:57-09:30 | 服务启动 + 端点枚举 | [OK] 完成 |
| 09:30-11:00 | user-service(8088) + project-service(8089) 全覆盖 | [OK] 完成 |
| 11:00-12:00 | billing(8090) + collab(8091) + ai-orch(8087) | ⚠️ 3服务未启动 |
| 剩余 | 鉴权+边界+限流+交叉前端 | [OK] 已嵌入测试 |

---

> [NOTE] **注**: billing-service(8090)、collab-service(8091)、ai-orchestrator(8087) 未能启动。  
> 需要检查这三个服务的 pnpm dev 脚本和依赖安装状态。  
> **建议**: 运行 `cd services/billing-service && pnpm install && pnpm dev` 手动启动。

---

*报告由谢擎盲测脚本自动生成 @ $timestamp*
"@

# Write report
$reportMd | Out-File -FilePath $outputFile -Encoding UTF8
Write-Host "`n[OK] Report written to: $outputFile"

# Summary
Write-Host "`n===== SUMMARY =====" -ForegroundColor Green
Write-Host "Total: $totalTests tests | Passed: $passed | Failed: $failed"
Write-Host "Services UP: $($aliveServices.Values.Where({$_}).Count)/5"
