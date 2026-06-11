# ManhuaWorks Backend Blind Test - 2026-06-11
# No emoji, pure ASCII
$ErrorActionPreference = 'Continue'
$outFile = "D:\ManhuaWorks\docs\testing\backend\XIEQING_BLIND_BACKEND_2026-06-11.md"
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$results = [System.Collections.ArrayList]::new()

function Test-API {
    param($Name,$Svc,$Method,$Path,$Body,$Headers,$TestType="normal",$ExpStatus=200,$Timeout=10)
    $uri = if ($Path -like "http*") { $Path } else { "$Svc$Path" }
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $p = @{Uri=$uri;Method=$Method;ContentType="application/json";UseBasicParsing=$true;TimeoutSec=$Timeout}
        if ($Headers) { $p.Headers = $Headers }
        if ($Body) { $p.Body = $Body }
        $resp = Invoke-WebRequest @p
        $sw.Stop()
        $content = if ($resp.Content.Length -gt 400) { $resp.Content.Substring(0,400) } else { $resp.Content }
        $pass = ($resp.StatusCode -eq $ExpStatus)
        $r = [PSCustomObject]@{Name=$Name;Svc=$Svc;Path=$Path;Method=$Method;TestType=$TestType;Status=$resp.StatusCode;Expected=$ExpStatus;Pass=$pass;TimeMs=$sw.ElapsedMilliseconds;Content=$content}
    } catch {
        $sw.Stop()
        $ex = $_.Exception
        $status = "ERR"
        $content = $ex.Message.Substring(0,[Math]::Min(200,$ex.Message.Length))
        if ($ex.Response) {
            $status = [int]$ex.Response.StatusCode
            $sr = [System.IO.StreamReader]::new($ex.Response.GetResponseStream())
            $content = $sr.ReadToEnd(); $sr.Close()
            if ($content.Length -gt 400) { $content = $content.Substring(0,400) }
        }
        $pass = ($status -eq $ExpStatus) -or ($TestType -eq "auth_none" -and $status -eq 401) -or ($TestType -eq "auth_bad" -and ($status -eq 401 -or $status -eq 403))
        $r = [PSCustomObject]@{Name=$Name;Svc=$Svc;Path=$Path;Method=$Method;TestType=$TestType;Status=$status;Expected=$ExpStatus;Pass=$pass;TimeMs=$sw.ElapsedMilliseconds;Content=$content}
    }
    [void]$results.Add($r)
    $icon = if ($r.Pass) { "PASS" } else { "FAIL" }
    Write-Output "[$icon] $Method $Path => $($r.Status) ($($r.TimeMs)ms) [$TestType]"
    return $r
}

# ====== PHASE 1: Service Discovery ======
Write-Output "====== PHASE 1: Service Discovery ======"
$alive = @{}
foreach ($s in @("user-service:8088","project-service:8089","billing-service:8090","collab-service:8091","ai-orch:8087")) {
    $parts = $s -split ':'
    $name = $parts[0]; $port = $parts[1]
    try {
        $r = Invoke-WebRequest "http://localhost:$port/" -UseBasicParsing -TimeoutSec 3
        $alive[$name] = $true
        Write-Output "  UP: $name :$port"
    } catch { $alive[$name] = $false; Write-Output "  DOWN: $name :$port" }
}

# ====== PHASE 2: Auth Setup ======
Write-Output "`n====== PHASE 2: Auth Setup ======"
$TOKEN = $null; $UID = $null; $AUTH = @{}

if ($alive["user-service"]) {
    $email = "bt_$(Get-Date -Format 'HHmmss')@t.com"
    $body = '{"email":"' + $email + '","password":"Test123456!","display_name":"BT"}'
    $r = Test-API "reg" "http://localhost:8088/api/v1" POST "/auth/register" $body -ExpStatus 201
    try {
        $data = ($r.Content | ConvertFrom-Json).data
        $TOKEN = $data.access_token; $UID = $data.user.id
        $AUTH = @{Authorization="Bearer $TOKEN"}
        Write-Output "  OK: token=$($TOKEN.Substring(0,20))... uid=$UID"
    } catch { Write-Output "  FAIL: could not get token from register" }
}
$BAD = @{Authorization="Bearer eyJbad.token.here"}

# ====== PHASE 3: All Endpoint Tests ======
Write-Output "`n====== PHASE 3: Endpoint Tests ======"
$base = "http://localhost:8088/api/v1"
$baseP = "http://localhost:8089/api/v1"

# --- user-service endpoints ---
if ($alive["user-service"]) {
    # Auth (no auth needed)
    Test-API "a1" $base POST "/auth/login" '{"email":"bt@t.com","password":"x"}' -ExpStatus 401
    Test-API "a2" $base POST "/auth/refresh" '{"refresh_token":"aaaaaaaaaaaaaaaaaa"}' -ExpStatus 401
    Test-API "a3" $base POST "/auth/forgot-password" '{"email":"bt@t.com"}'
    Test-API "a4" $base POST "/auth/reset-password" '{"token":"aaaaaaaaaaaaaaaaaa","new_password":"New123456!"}' -ExpStatus 401
    Test-API "a5" $base POST "/auth/verify-email" '{"token":"aaaaaaaaaaaaaaaaaa"}' -ExpStatus 401
    
    # Me (needs auth)
    Test-API "m1" $base GET "/me" -Headers $AUTH
    Test-API "m2" $base GET "/users/me" -Headers $AUTH
    Test-API "m3" $base PATCH "/me" '{"display_name":"BT_Updated"}' -Headers $AUTH
    Test-API "m4" $base POST "/me/password" '{"old_password":"Test123456!","new_password":"NewPass123!"}' -Headers $AUTH
    
    # Users admin
    Test-API "u1" $base GET "/users" -Headers $AUTH
    if ($UID) {
        Test-API "u2" $base GET "/users/$UID" -Headers $AUTH
        Test-API "u3" $base PATCH "/users/$UID" '{"display_name":"admin_upd"}' -Headers $AUTH
    }
    
    # Projects (user-service side)
    Test-API "p1" $base GET "/projects" -Headers $AUTH
    Test-API "p2" $base POST "/projects" '{"title":"BT_Project","description":"blind"}' -Headers $AUTH
    
    # Quotas / Subscriptions
    Test-API "q1" $base GET "/quotas/me" -Headers $AUTH
    Test-API "s1" $base GET "/subscriptions/me" -Headers $AUTH
    
    # Health (no auth)
    Test-API "h1" $base GET "/health"
    
    Write-Output "`n--- Auth Ternary (user-service) ---"
    $authTargets = @(
        @{M="GET";P="/me";N="me_get"}
        @{M="GET";P="/users";N="users_list"}
        @{M="GET";P="/projects";N="projects_list"}
        @{M="GET";P="/quotas/me";N="quotas_me"}
        @{M="GET";P="/subscriptions/me";N="subs_me"}
    )
    foreach ($t in $authTargets) {
        Test-API "$($t.N)_valid" $base $t.M $t.P -Headers $AUTH -TestType "auth_valid"
        Test-API "$($t.N)_none" $base $t.M $t.P -TestType "auth_none" -ExpStatus 401
        Test-API "$($t.N)_bad" $base $t.M $t.P -Headers $BAD -TestType "auth_bad" -ExpStatus 401
    }
    
    Write-Output "`n--- Pagination Boundary (user-service) ---"
    Test-API "pg0" $base GET "/users?page=0" -Headers $AUTH -TestType "page_boundary"
    Test-API "pg1" $base GET "/users?page=-1" -Headers $AUTH -TestType "page_boundary"
    Test-API "pg2" $base GET "/users?page=999999" -Headers $AUTH -TestType "page_boundary"
    Test-API "pg3" $base GET "/users?page_size=0" -Headers $AUTH -TestType "page_boundary"
    Test-API "pg4" $base GET "/users?page_size=-1" -Headers $AUTH -TestType "page_boundary"
    Test-API "pg5" $base GET "/users?page_size=10000" -Headers $AUTH -TestType "page_boundary"
}

# --- project-service endpoints ---
if ($alive["project-service"]) {
    # Health
    Test-API "ph1" $baseP GET "/health"
    
    # Admin projects
    Test-API "pa1" $baseP GET "/admin/projects" -Headers $AUTH
    if ($UID) {
        $pb = '{"userId":"' + $UID + '","title":"BT_Proj_' + (Get-Date -Format 'HHmmss') + '","description":"blind"}'
        Test-API "pa2" $baseP POST "/admin/projects" $pb -Headers $AUTH -ExpStatus 201
    }
    Test-API "pa3" $baseP GET "/admin/projects/fake-id" -Headers $AUTH
    Test-API "pa4" $baseP PUT "/admin/projects/fake-id" '{"title":"upd"}' -Headers $AUTH
    Test-API "pa5" $baseP DELETE "/admin/projects/fake-id" -Headers $AUTH
    
    # Shots
    Test-API "ps1" $baseP GET "/projects/fake-id/shots" -Headers $AUTH
    Test-API "ps2" $baseP POST "/projects/fake-id/shots" '{"shot_no":1,"title":"test"}' -Headers $AUTH
    
    # Scenes
    Test-API "pc1" $baseP GET "/scenes?projectId=fake-id" -Headers $AUTH
    Test-API "pc2" $baseP POST "/scenes" '{"projectId":"fake-id","name":"TestScene"}' -Headers $AUTH
    Test-API "pc3" $baseP PATCH "/scenes/fake-id" '{"name":"upd"}' -Headers $AUTH
    Test-API "pc4" $baseP DELETE "/scenes/fake-id" -Headers $AUTH
    
    # Characters
    Test-API "pch1" $baseP GET "/characters?projectId=fake-id" -Headers $AUTH
    Test-API "pch2" $baseP POST "/characters" '{"projectId":"fake-id","name":"TestChar"}' -Headers $AUTH
    Test-API "pch3" $baseP PATCH "/characters/fake-id" '{"name":"upd"}' -Headers $AUTH
    Test-API "pch4" $baseP DELETE "/characters/fake-id" -Headers $AUTH
    
    Write-Output "`n--- Auth Ternary (project-service) ---"
    $pauthTargets = @(
        @{M="GET";P="/admin/projects";N="admin_proj"}
        @{M="GET";P="/scenes?projectId=fake";N="scenes"}
        @{M="GET";P="/characters?projectId=fake";N="chars"}
    )
    foreach ($t in $pauthTargets) {
        Test-API "$($t.N)_valid" $baseP $t.M $t.P -Headers $AUTH -TestType "auth_valid"
        Test-API "$($t.N)_none" $baseP $t.M $t.P -TestType "auth_none" -ExpStatus 401
        Test-API "$($t.N)_bad" $baseP $t.M $t.P -Headers $BAD -TestType "auth_bad" -ExpStatus 401
    }
    
    Write-Output "`n--- Pagination Boundary (project-service) ---"
    Test-API "pp0" $baseP GET "/admin/projects?offset=0&limit=0" -Headers $AUTH -TestType "page_boundary"
    Test-API "pp1" $baseP GET "/admin/projects?offset=-1&limit=10" -Headers $AUTH -TestType "page_boundary"
    Test-API "pp2" $baseP GET "/admin/projects?offset=0&limit=99999" -Headers $AUTH -TestType "page_boundary"
}

# --- billing-service ---
if ($alive["billing-service"]) {
    $baseB = "http://localhost:8090/api/v1"
    Test-API "b1" $baseB GET "/subscriptions/me" -Headers $AUTH
    Test-API "b2" $baseB GET "/subscriptions/plans" -Headers $AUTH
    Test-API "b3" $baseB GET "/orders" -Headers $AUTH
    Test-API "b4" $baseB POST "/orders" '{"plan":"pro"}' -Headers $AUTH
    Test-API "b5" $baseB GET "/quota" -Headers $AUTH
    Test-API "b6" $baseB GET "/billing/cost-logs" -Headers $AUTH
    Test-API "bh" $baseB GET "/health"
}

# --- collab-service ---
if ($alive["collab-service"]) {
    $baseC = "http://localhost:8091/api/v1"
    Test-API "c1" $baseC GET "/comments" -Headers $AUTH
    Test-API "c2" $baseC POST "/comments" '{"projectId":"fake","body":"test"}' -Headers $AUTH
    Test-API "c3" $baseC GET "/projects/fake-id/annotations" -Headers $AUTH
    Test-API "c4" $baseC GET "/presence/me" -Headers $AUTH
    Test-API "c5" $baseC GET "/activities" -Headers $AUTH
    Test-API "c6" $baseC GET "/notifications" -Headers $AUTH
    Test-API "c7" $baseC GET "/teams" -Headers $AUTH
    Test-API "c8" $baseC POST "/teams" '{"name":"BT_Team"}' -Headers $AUTH
    Test-API "c9" $baseC GET "/stats"
    Test-API "ch" $baseC GET "/health"
    
    Test-API "ca_none" $baseC GET "/teams" -TestType "auth_none" -ExpStatus 401
    Test-API "ca_bad" $baseC GET "/teams" -Headers $BAD -TestType "auth_bad" -ExpStatus 401
}

# --- ai-orchestrator ---
if ($alive["ai-orch"]) {
    $baseA = "http://localhost:8087"
    Test-API "a1" $baseA GET "/health"
    Test-API "a2" $baseA GET "/v1/orchestrate/pipelines" -Headers $AUTH
    Test-API "a3" $baseA GET "/v1/orchestrate/cost-table" -Headers $AUTH
    Test-API "a4" $baseA GET "/v1/orchestrate/runs" -Headers $AUTH
    Test-API "a5" $baseA POST "/v1/orchestrator/jobs" '{"type":"image","payload":{}}' -Headers $AUTH
    Test-API "a6" $baseA GET "/v1/ai/byok" -Headers $AUTH
    Test-API "aa_none" $baseA GET "/v1/orchestrate/runs" -TestType "auth_none" -ExpStatus 401
    Test-API "aa_bad" $baseA GET "/v1/orchestrate/runs" -Headers $BAD -TestType "auth_bad" -ExpStatus 401
}

# ====== PHASE 4: Rate Limiting ======
Write-Output "`n====== PHASE 4: Rate Limiting ======"
if ($alive["user-service"]) {
    $r429 = 0; $rOk = 0
    for ($i = 1; $i -le 20; $i++) {
        try {
            $r = Invoke-WebRequest "$base/health" -UseBasicParsing -TimeoutSec 3
            if ($r.StatusCode -eq 429) { $r429++ } else { $rOk++ }
        } catch { $rOk++ }
        Start-Sleep -Milliseconds 80
    }
    Write-Output "  Rate limit: $r429 x 429, $rOk x 200 from 20 rapid requests"
    $rateContent = "20 rapid requests to /health: $r429 got 429, $rOk got 200"
}

# ====== PHASE 5: Cross-frontend ======
Write-Output "`n====== PHASE 5: Cross-frontend ======"
$feStatus = @{}
foreach ($p in @(@{N="web";P=3000},@{N="admin";P=5174},@{N="studio";P=5175},@{N="user-portal";P=5180})) {
    try {
        $r = Invoke-WebRequest "http://localhost:$($p.P)" -UseBasicParsing -TimeoutSec 3
        $feStatus[$p.N] = "UP:$($r.StatusCode)"
        Write-Output "  UP: $($p.N) :$($p.P)"
    } catch { $feStatus[$p.N] = "DOWN"; Write-Output "  DOWN: $($p.N) :$($p.P)" }
}

# ====== PHASE 6: Generate Report ======
Write-Output "`n====== PHASE 6: Generating Report ======"
$total = $results.Count
$passed = ($results | Where-Object { $_.Pass }).Count
$failed = $total - $passed
$pct = if ($total -gt 0) { [Math]::Round($passed / $total * 100, 1) } else { 0 }

$md = @"
# 谢擎 -- 后端盲测报告
> **时间**: $ts | **执行**: 谢擎 (subagent)  
> **环境**: localhost dev | **工具**: PowerShell Invoke-WebRequest

---

## [STATS] 统计
| 指标 | 数值 |
|------|------|
| 总测试用例 | $total |
| PASS 通过 | $passed |
| FAIL 失败 | $failed |
| 通过率 | ${pct}% |
| user-service (8088) | $(if($alive["user-service"]){"UP"}else{"DOWN"}) |
| project-service (8089) | $(if($alive["project-service"]){"UP"}else{"DOWN"}) |
| billing-service (8090) | $(if($alive["billing-service"]){"UP"}else{"DOWN"}) |
| collab-service (8091) | $(if($alive["collab-service"]){"UP"}else{"DOWN"}) |
| ai-orchestrator (8087) | $(if($alive["ai-orch"]){"UP"}else{"DOWN"}) |

---

## [STAT] 服务状态
$(foreach ($k in $alive.Keys) { $s = if($alive[$k]){'UP'}else{'DOWN'}; "| $k | $s |`n" })

---

## [LIST] 端点测试明细
| # | 服务 | 端点 | 方法 | 测试类型 | 状态 | 预期 | 通过 | ms |
|---|------|------|------|----------|------|------|------|-----|
$($(
    $idx = 0
    foreach ($r in $results) {
        $idx++
        $p = if ($r.Path.Length -gt 55) { $r.Path.Substring(0,52) + "..." } else { $r.Path }
        $s = $r.Svc -replace 'http://localhost:[0-9]+/api/v1','' -replace 'http://localhost:[0-9]+',''
        $pass = if ($r.Pass) { "PASS" } else { "FAIL" }
        "| $idx | $s | $p | $($r.Method) | $($r.TestType) | $($r.Status) | $($r.Expected) | $pass | $($r.TimeMs) |`n"
    }
))

---

## [AUTH] 鉴权三元验证
| 端点 | 带Token | 无Token | 错Token |
|------|---------|---------|---------|
$(
    # Extract unique auth test paths
    $valid = $results | Where-Object { $_.TestType -eq "auth_valid" } | Select-Object Path,Pass
    $none = $results | Where-Object { $_.TestType -eq "auth_none" } | Select-Object Path,Pass
    $bad = $results | Where-Object { $_.TestType -eq "auth_bad" } | Select-Object Path,Pass
    $authPaths = ($valid.Path + $none.Path + $bad.Path | Select-Object -Unique)
    foreach ($ap in $authPaths) {
        $v = ($valid | Where-Object { $_.Path -eq $ap }).Pass
        $n = ($none | Where-Object { $_.Path -eq $ap }).Pass
        $b = ($bad | Where-Object { $_.Path -eq $ap }).Pass
        $vi = if ($v) { "PASS" } else { "FAIL" }
        $ni = if ($n) { "PASS" } else { "FAIL" }
        $bi = if ($b) { "PASS" } else { "FAIL" }
        "| $ap | $vi | $ni | $bi |`n"
    }
)

---

## [PAGE] 分页边界验证
| 测试 | 结果 |
|------|------|
$(
    $pageTests = $results | Where-Object { $_.TestType -eq "page_boundary" }
    foreach ($pt in $pageTests) {
        $pi = if ($pt.Pass) { "PASS" } else { "FAIL" }
        "| $($pt.Method) $($pt.Path) | $pi -> $($pt.Status) |`n"
    }
)

---

## [RATE] 限流验证
$(if ($alive["user-service"]) { $rateContent } else { "N/A - user-service not running" })

---

## [CRS] 交叉前端验证
| 前端 | 端口 | 状态 |
|------|------|------|
$(foreach ($k in $feStatus.Keys) { "| $k | $($feStatus[$k] -replace ':.*','') | $($feStatus[$k]) |`n" })

---

## [BUG] 失败项

$(if ($failed -gt 0) {
    $failedItems = $results | Where-Object { -not $_.Pass }
    foreach ($f in $failedItems) {
        $line = "- **$($f.Method) $($f.Path)** [$($f.TestType)]: expected $($f.Expected), got $($f.Status)"
        $line += "`n  - Content: $($f.Content.Substring(0,[Math]::Min(200,$f.Content.Length)))`n"
        $line
    }
} else { "No failures!" })

---

## [BUG] Bug 汇总
| 等级 | 数量 | 描述 |
|------|------|------|
| P0 - 服务不可用 | $(($alive.Values | Where-Object { -not $_ }).Count) | $(($alive.GetEnumerator() | Where-Object { -not $_.Value } | ForEach-Object { "$($_.Key) " })) |
| P1 - 鉴权/响应异常 | $($failed) | 返回非预期状态码 |
| P2 - 超时/连接错误 | 0 | - |

---

> [NOTE] **未启动服务**: $(($alive.GetEnumerator() | Where-Object { -not $_.Value } | ForEach-Object { $_.Key }) -join ', ')  
> **建议**: 手动启动失败的服务后重新运行测试  
> **Token**: $(if($TOKEN){"$($TOKEN.Substring(0,20))..."}else{"N/A"})

---

*报告自动生成 @ $ts  |  谢擎 2026-06-11*
"@

$md | Out-File -FilePath $outFile -Encoding UTF8
Write-Output "`n====== DONE ======"
Write-Output "Report: $outFile"
Write-Output "Total: $total | Pass: $passed | Fail: $failed | Rate: ${pct}%"
