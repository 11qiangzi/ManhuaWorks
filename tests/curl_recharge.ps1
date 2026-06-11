$ErrorActionPreference = "Continue"
Set-Location D:\ManhuaWorks

# 1) login → JWT (use smoke-2026 user from services/user-service/smoke.json)
$pw = 'SmokePwd!2026'
$body = (@{email='smoke-2026@mhw.test';password=$pw} | ConvertTo-Json)
$login = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8088/api/v1/auth/login' -ContentType 'application/json' -Body $body
$token = $login.data.access_token
$userId = $login.data.user.id
Write-Host "=== STEP 1: LOGIN ==="
Write-Host "userId: $userId"
Write-Host "email:  $($login.data.user.email)"
Write-Host "token:  $($token.Substring(0,40))..."
Write-Host ""

# 2) recharge - 跑 10 次直到成功（mock 95%）
Write-Host "=== STEP 2: RECHARGE (`$50 USD) ==="
$rechargeBody = (@{userId=$userId; amount=50; currency='USD'} | ConvertTo-Json)
$recharge = $null
$httpStatus = 0
for ($i = 0; $i -lt 10; $i++) {
  try {
    $r = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8090/api/v1/billing/recharge' `
      -Headers @{Authorization="Bearer $token"} -ContentType 'application/json' -Body $rechargeBody
    $httpStatus = 201
    if ($r.code -eq 0 -and $r.data.ok) {
      $recharge = $r
      Write-Host "SUCCESS on attempt $($i+1) (HTTP 201)"
      break
    } else {
      Write-Host "Attempt $($i+1): HTTP 402 (mock fail) code=$($r.code) ok=$($r.data.ok) reason=$($r.data.reason)"
      $httpStatus = 402
    }
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $httpStatus = [int]$resp.StatusCode
      $stream = $resp.GetResponseStream()
      $reader = New-Object System.IO.StreamReader($stream)
      $b = $reader.ReadToEnd()
      Write-Host "Attempt $($i+1) HTTP $httpStatus - $b"
    } else {
      Write-Host "Attempt $($i+1) exception: $($_.Exception.Message)"
    }
  }
}
Write-Host ""
Write-Host "FINAL RECHARGE HTTP STATUS: $httpStatus"
if ($recharge) {
  Write-Host "Recharge response (success):"
  $recharge | ConvertTo-Json -Depth 6
} else {
  Write-Host "(No successful recharge after 10 attempts; the last attempt status was $httpStatus)"
}
Write-Host ""

# 3) balance
Write-Host "=== STEP 3: BALANCE ==="
try {
  $bal = Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:8090/api/v1/billing/balance' `
    -Headers @{Authorization="Bearer $token"}
  Write-Host "HTTP 200"
  $bal | ConvertTo-Json -Depth 4
} catch {
  Write-Host "Balance error: $($_.Exception.Message)"
}
Write-Host ""

# 4) invoices
Write-Host "=== STEP 4: INVOICES (limit=5) ==="
try {
  $inv = Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:8090/api/v1/billing/invoices?limit=5&offset=0' `
    -Headers @{Authorization="Bearer $token"}
  Write-Host "HTTP 200"
  $inv | ConvertTo-Json -Depth 4
} catch {
  Write-Host "Invoices error: $($_.Exception.Message)"
}
