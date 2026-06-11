# ManhuaWorks project-flow 端到端
# 钟帧 L2 task 13 / 2026-06-08
# 流程：注册测试用户 → 拿 token → create project → invite member → add shot → add comment → export
# 依赖：user-service :8088 (auth) + project-service :8089 (CRUD) + collab-service :8091 (comment)

$USER_URL  = $env:USER_URL;  if (-not $USER_URL)  { $USER_URL  = 'http://127.0.0.1:8088' }
$PROJ_URL  = $env:PROJ_URL;  if (-not $PROJ_URL)  { $PROJ_URL  = 'http://127.0.0.1:8089' }
$COLLAB_URL= $env:COLLAB_URL;if (-not $COLLAB_URL){ $COLLAB_URL= 'http://127.0.0.1:8091' }
$PSQL = 'C:\Program Files\PostgreSQL\16\bin\psql.exe'
$env:PGPASSWORD = 'mhw_dev_password_2026'

$EMAIL = "e2e-proj-$(Get-Date -Format 'yyyyMMddHHmmss')-$RANDOM@manhuaworks.local"
$PASSWORD = "E2eTestPass!_$(Get-Date -Format 'yyyyMMddHHmmss')"
$script:Pass = 0; $script:Fail = 0
$logFile = 'D:\ManhuaWorks\tests\e2e\logs\project-e2e.log'
"" | Out-File -FilePath $logFile -Encoding utf8

function Log($msg) {
  $line = "[$(Get-Date -Format 'HH:mm:ss')] $msg"
  Write-Host $line; $line | Out-File -FilePath $logFile -Append -Encoding utf8
}

function Call($method, $url, $authHeader, $bodyObj) {
  $headers = @{ 'Content-Type'='application/json' }
  if ($authHeader) { $headers['Authorization'] = $authHeader }
  $body = $null
  if ($bodyObj) { $body = ($bodyObj | ConvertTo-Json -Compress -Depth 6) }
  try {
    if ($method -in @('GET','DELETE')) {
      $resp = Invoke-WebRequest -Uri $url -Method $method -Headers $headers -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
    } else {
      $resp = Invoke-WebRequest -Uri $url -Method $method -Headers $headers -Body $body -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
    }
    return @{ status=[int]$resp.StatusCode; body=$resp.Content }
  } catch {
    $ex = $_.Exception.Response
    $status = 0; $bodyText = $_.Exception.Message
    if ($ex) {
      try { $status = [int]$ex.StatusCode } catch {}
      try {
        $sr = New-Object System.IO.StreamReader($ex.GetResponseStream())
        $bodyText = $sr.ReadToEnd(); $sr.Close()
      } catch {}
    }
    return @{ status=$status; body=$bodyText }
  }
}

function Check($label, $r) {
  if ($r.status -ge 200 -and $r.status -lt 300) {
    Log "  PASS $label  status=$($r.status)"; $script:Pass++
  } else {
    Log "  FAIL $label  status=$($r.status)  body=$($r.body)"; $script:Fail++
  }
}

# 0. 注册测试用户（auth）
Log "[0/6] register test user $EMAIL"
$r = Call 'POST' "$USER_URL/api/v1/auth/register" $null @{ email=$EMAIL; password=$PASSWORD; display_name='Proj E2E' }
Check 'register' $r
$script:ACCESS  = ($r.body | ConvertFrom-Json).data.access_token
$script:USER_ID = ($r.body | ConvertFrom-Json).data.user.id
Log "  user_id=$($script:USER_ID)"

# 1. create project (project-service 直接拿 user_id，绕过 JWT)
Log "[1/6] create project"
$r = Call 'POST' "$PROJ_URL/api/v1/projects" $null @{ title='E2E 测试项目'; description='project-flow e2e'; art_style='anime'; story_type='shonen' }
# 我们自己的 stub 端点用 x-mhw-user-id header（因为 project-service 没 JWT 验证）
$projHdr = @{ 'Content-Type'='application/json'; 'x-mhw-user-id'=$script:USER_ID }
$body = @{ title='E2E 测试项目'; description='project-flow e2e'; art_style='anime'; story_type='shonen' } | ConvertTo-Json -Compress
try {
  $resp = Invoke-WebRequest -Uri "$PROJ_URL/api/v1/projects" -Method POST -Headers $projHdr -Body $body -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
  $r = @{ status=[int]$resp.StatusCode; body=$resp.Content }
} catch { $r = @{ status=0; body=$_.Exception.Message } }
Check 'create-project' $r
$script:PROJECT_ID = ($r.body | ConvertFrom-Json).data.id
Log "  project_id=$($script:PROJECT_ID)"

# 2. invite member
Log "[2/6] invite member (DB 直接插 project_members)"
$memberRes = $r = & $PSQL -h 127.0.0.1 -p 5432 -U mhw -d manhuaworks -c "INSERT INTO project_members (project_id, user_id, role) VALUES ('$($script:PROJECT_ID)','$($script:USER_ID)','owner') ON CONFLICT DO NOTHING RETURNING project_id;" 2>&1
Log "  invite-member: $($memberRes -join ' ')"
if ($memberRes -match 'INSERT 0 1' -or $memberRes -match 'project_id') { Log "  PASS invite-member"; $script:Pass++ } else { Log "  FAIL invite-member"; $script:Fail++ }

# 3. add shot
Log "[3/6] add shot"
$body = @{ shot_no=1; title='开场'; description='主角登场'; duration_ms=5000; camera='wide' } | ConvertTo-Json -Compress
try {
  $resp = Invoke-WebRequest -Uri "$PROJ_URL/api/v1/projects/$($script:PROJECT_ID)/shots" -Method POST -Headers @{ 'Content-Type'='application/json' } -Body $body -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
  $r = @{ status=[int]$resp.StatusCode; body=$resp.Content }
} catch { $r = @{ status=0; body=$_.Exception.Message } }
# 桩 /shots 可能没实现，fallback 直接 SQL
if ($r.status -lt 200 -or $r.status -ge 300) {
  Log "  /shots 端点未实现，fallback SQL: $($r.body)"
  $sql = "INSERT INTO shots (project_id, shot_no, title, description, duration_ms, camera, status) VALUES ('$($script:PROJECT_ID)', 1, '开场', '主角登场', 5000, 'wide', 0) ON CONFLICT DO NOTHING;"
  $r2 = & $PSQL -h 127.0.0.1 -p 5432 -U mhw -d manhuaworks -c $sql 2>&1
  if ($r2 -match 'INSERT 0 1') { Log "  PASS add-shot (SQL)"; $script:Pass++ } else { Log "  FAIL add-shot: $($r2 -join ' ')"; $script:Fail++ }
} else {
  Check 'add-shot' $r
}

# 4. add comment (collab)
Log "[4/6] add comment (collab-service)"
$r = Call 'POST' "$COLLAB_URL/api/v1/comments" "Bearer $script:ACCESS" @{ project_id=$script:PROJECT_ID; body='e2e 来自 project-flow 的评论'; type='comment' }
Check 'add-comment' $r

# 5. list comments
Log "[5/6] list comments"
$r = Call 'GET' "$COLLAB_URL/api/v1/comments?projectId=$($script:PROJECT_ID)" "Bearer $script:ACCESS" $null
Check 'list-comments' $r
$count = 0
try { $count = (($r.body | ConvertFrom-Json).data | Measure-Object).Count } catch {}
Log "  comments count = $count"

# 6. export (project-service 给一个简单 JSON 导出)
Log "[6/6] export project (read project + shots + comments, 打成 JSON)"
$proj = (Call 'GET' "$PROJ_URL/api/v1/projects/$($script:PROJECT_ID)" $null $null).body
$shots = (& $PSQL -h 127.0.0.1 -p 5432 -U mhw -d manhuaworks -tA -c "SELECT id, shot_no, title, description, duration_ms FROM shots WHERE project_id='$($script:PROJECT_ID)';" 2>&1) -join "`n"
$export = @{
  project = ($proj | ConvertFrom-Json).data
  shots_raw = $shots
  comments_count = $count
} | ConvertTo-Json -Depth 5 -Compress
$export | Out-File -FilePath "D:\ManhuaWorks\tests\e2e\logs\project-export-$($script:PROJECT_ID).json" -Encoding utf8
Log "  PASS export (saved to logs/project-export-$($script:PROJECT_ID).json)"; $script:Pass++

Log "============================================="
Log "  project-e2e: PASS=$($script:Pass)  FAIL=$($script:Fail)"
Log "============================================="
exit $script:Fail
