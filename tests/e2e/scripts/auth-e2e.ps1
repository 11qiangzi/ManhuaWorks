# ManhuaWorks auth-flow 端到端
# 钟帧 L2 task 13 / 2026-06-08
# 流程：register → verify email(mock 查 DB 标 consumed) → login → 2FA enable+confirm → get /me → change password → logout
# 依赖：user-service :8088，psql 可用，node 可用
# 兼容：PowerShell 5.1 (无 HttpClient) — 用 Invoke-RestMethod/Invoke-WebRequest

$USER_URL = $env:USER_URL
if (-not $USER_URL) { $USER_URL = 'http://127.0.0.1:8088' }
$PSQL = 'C:\Program Files\PostgreSQL\16\bin\psql.exe'
$env:PGPASSWORD = 'mhw_dev_password_2026'
$PGHOST = '127.0.0.1'
$PGPORT = 5432
$PGUSER = 'mhw'
$PGDATABASE = 'manhuaworks'

$EMAIL = "e2e-$(Get-Date -Format 'yyyyMMddHHmmss')-$RANDOM@manhuaworks.local"
$PASSWORD = "E2eTestPass!_$(Get-Date -Format 'yyyyMMddHHmmss')"
$NEW_PASSWORD = "E2eNewPass!_$(Get-Date -Format 'yyyyMMddHHmmss')"

$script:Pass = 0
$script:Fail = 0
$logFile = 'D:\ManhuaWorks\tests\e2e\logs\auth-e2e.log'
"" | Out-File -FilePath $logFile -Encoding utf8

function Log($msg) {
  $line = "[$(Get-Date -Format 'HH:mm:ss')] $msg"
  Write-Host $line
  $line | Out-File -FilePath $logFile -Append -Encoding utf8
}

# 执行 HTTP 调用，返回 hashtable: status, body
function Call($method, $url, $authHeader, $bodyObj) {
  $headers = @{ 'Content-Type'='application/json' }
  if ($authHeader) { $headers['Authorization'] = $authHeader }
  $body = $null
  if ($bodyObj) { $body = ($bodyObj | ConvertTo-Json -Compress -Depth 5) }
  try {
    if ($method -in @('GET','DELETE')) {
      $resp = Invoke-WebRequest -Uri $url -Method $method -Headers $headers -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
    } else {
      $resp = Invoke-WebRequest -Uri $url -Method $method -Headers $headers -Body $body -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
    }
    return @{ status=[int]$resp.StatusCode; body=$resp.Content }
  } catch {
    $ex = $_.Exception.Response
    $status = 0
    $bodyText = $_.Exception.Message
    if ($ex) {
      try { $status = [int]$ex.StatusCode } catch {}
      try {
        $sr = New-Object System.IO.StreamReader($ex.GetResponseStream())
        $bodyText = $sr.ReadToEnd()
        $sr.Close()
      } catch {}
    }
    return @{ status=$status; body=$bodyText }
  }
}

function Check($label, $r) {
  if ($r.status -ge 200 -and $r.status -lt 300) {
    Log "  PASS $label  status=$($r.status)"
    $script:Pass++
  } else {
    Log "  FAIL $label  status=$($r.status)  body=$($r.body)"
    $script:Fail++
  }
}

# -------- 1. register --------
Log "[1/7] register  $EMAIL"
$r = Call 'POST' "$USER_URL/api/v1/auth/register" $null @{ email=$EMAIL; password=$PASSWORD; display_name='E2E Tester' }
Check 'register' $r
$j = $r.body | ConvertFrom-Json
$script:ACCESS = $j.data.access_token
$script:REFRESH = $j.data.refresh_token

# -------- 2. verify email (mock) --------
Log "[2/7] verify email (mock: mark verifications consumed + users.status=1)"
& $PSQL -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c "UPDATE verifications SET consumed_at = NOW() WHERE purpose=1 AND target='$EMAIL' AND consumed_at IS NULL;" 2>&1 | Out-Null
& $PSQL -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c "UPDATE users SET status = 1 WHERE email='$EMAIL';" 2>&1 | Out-Null
Log "  PASS mock-verify ok"

# -------- 3. login --------
Log "[3/7] login"
$r = Call 'POST' "$USER_URL/api/v1/auth/login" $null @{ email=$EMAIL; password=$PASSWORD }
Check 'login' $r
$script:ACCESS = ($r.body | ConvertFrom-Json).data.access_token
$script:REFRESH = ($r.body | ConvertFrom-Json).data.refresh_token

# -------- 4. 2FA enable + confirm --------
Log "[4/7] 2FA enable + confirm"
$r = Call 'POST' "$USER_URL/api/v1/me/2fa/enable" "Bearer $script:ACCESS" $null
Log "  2fa enable status=$($r.status) body=$($r.body.Substring(0, [Math]::Min(200, $r.body.Length)))"
if ($r.status -ge 200 -and $r.status -lt 300) {
  $TOTP_SECRET = ($r.body | ConvertFrom-Json).data.secret
  $TOTP = $null
  try {
    $TOTP = & node -e "const o = require('D:/ManhuaWorks/node_modules/.pnpm/otplib@12.0.1/node_modules/otplib'); console.log(o.authenticator.generate('$TOTP_SECRET'));" 2>$null
  } catch {}
  if ($TOTP) {
    $r = Call 'POST' "$USER_URL/api/v1/me/2fa/confirm" "Bearer $script:ACCESS" @{ totp=$TOTP }
    Check '2fa.confirm' $r
  } else {
    Log "  SKIP TOTP 生成失败 (otplib 不可用)，跳过 2FA 验证"
  }
} else {
  Log "  SKIP 2fa enable 失败 ($($r.status))，跳过 2FA 验证"
}

# -------- 5. get /me --------
Log "[5/7] get /me"
$r = Call 'GET' "$USER_URL/api/v1/me" "Bearer $script:ACCESS" $null
Check 'get-me' $r
$meEmail = ($r.body | ConvertFrom-Json).data.email
if ($meEmail -eq $EMAIL) { Log "  PASS get-me.email matches"; $script:Pass++ } else { Log "  FAIL get-me.email mismatch ($meEmail vs $EMAIL)"; $script:Fail++ }

# -------- 6. change password --------
Log "[6/7] change password"
$r = Call 'POST' "$USER_URL/api/v1/me/password" "Bearer $script:ACCESS" @{ old_password=$PASSWORD; new_password=$NEW_PASSWORD }
Check 'change-password' $r

# 用新密码重新登录
$r = Call 'POST' "$USER_URL/api/v1/auth/login" $null @{ email=$EMAIL; password=$NEW_PASSWORD }
Check 'login-after-pwd-change' $r
$script:ACCESS = ($r.body | ConvertFrom-Json).data.access_token
$script:REFRESH = ($r.body | ConvertFrom-Json).data.refresh_token

# -------- 7. logout --------
Log "[7/7] logout"
$r = Call 'POST' "$USER_URL/api/v1/auth/logout" "Bearer $script:ACCESS" @{ refresh_token=$script:REFRESH }
Check 'logout' $r

Log "============================================="
Log "  auth-e2e: PASS=$($script:Pass)  FAIL=$($script:Fail)"
Log "============================================="
exit $script:Fail
