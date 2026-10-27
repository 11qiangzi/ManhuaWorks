<#
.SYNOPSIS
  ManhuaWorks platform rename Q3B - switch domain + email FROM.

.DESCRIPTION
  Paidan 12B artifact: after Liang boss picks the new domain,
  call this script with -Domain and -FromEmail to do the swap.
  Scope: ONLY 4 file types - env files, nginx conf.
  Does NOT touch: package.json name, manhuaworks strings, database, routes, business code.

.PARAMETER Domain
  New platform domain (no protocol, no path). e.g. zaowuzhu.com

.PARAMETER FromEmail
  Email FROM address. e.g. noreply@zaowuzhu.com

.PARAMETER Production
  Real-write switch. Without it, runs in DRY-RUN (preview only).

.EXAMPLE
  # Preview first
  .\scripts\switch-domain.ps1 -Domain zaowuzhu.com -FromEmail noreply@zaowuzhu.com

.EXAMPLE
  # Actual switch (only after Paidan 13)
  .\scripts\switch-domain.ps1 -Domain zaowuzhu.com -FromEmail noreply@zaowuzhu.com -Production

.NOTES
  Author: Xie Qing (dev dept senior fullstack, paidan 12B)
  Date:   2026-06-16
  Scope:  Q3B - only domain + FROM, no manhuaworks string changes
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Domain,
    [Parameter(Mandatory = $true)][string]$FromEmail,
    [switch]$Production
)

$ErrorActionPreference = 'Stop'
$Root = 'D:\ManhuaWorks'
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'

# ---- 0. Backup (only in Production mode) ----
$backupDir = Join-Path $Root "scripts\.bak-l2t12b-$Timestamp"
if ($Production) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    Write-Host "[BACKUP] production backup -> $backupDir" -ForegroundColor Yellow
} else {
    Write-Host "[DRY-RUN] no writes, no backups" -ForegroundColor Cyan
}

# ---- Counters ----
$script:FilesTouched = @()
$script:FieldsChanged = 0

function Update-EnvFile {
    param(
        [string]$Path,
        [hashtable]$Map
    )
    if (-not (Test-Path $Path)) {
        Write-Host "  [SKIP] $Path not found" -ForegroundColor DarkGray
        return
    }
    $lines = Get-Content $Path
    $changed = 0
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ($line -match '^\s*#') { continue }
        if ($line -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$') {
            $key = $matches[1]
            if ($Map.ContainsKey($key)) {
                $newVal = $Map[$key]
                $oldVal = $matches[2]
                Write-Host "    $key : $oldVal  ->  $newVal"
                $lines[$i] = "$key=$newVal"
                $changed++
                $script:FieldsChanged++
            }
        }
    }
    if ($changed -gt 0) {
        $script:FilesTouched += $Path
        if ($Production) {
            $bakName = ([System.IO.Path]::GetFileName($Path) + '.bak')
            Copy-Item $Path (Join-Path $backupDir $bakName) -Force
            Set-Content -Path $Path -Value $lines -Encoding UTF8
            Write-Host "  [WRITE] $Path ($changed fields)" -ForegroundColor Green
        } else {
            Write-Host "  [DRY]   $Path ($changed fields, not written)" -ForegroundColor DarkCyan
        }
    } else {
        Write-Host "  [NOOP]  $Path no matching keys" -ForegroundColor DarkGray
    }
}

function Update-NginxServerName {
    param(
        [string]$Path,
        [string]$NewDomain
    )
    if (-not (Test-Path $Path)) {
        Write-Host "  [SKIP] $Path not found" -ForegroundColor DarkGray
        return
    }
    $content = Get-Content $Path -Raw
    $mainDomain = $NewDomain
    $wildcardDomain = "*.$NewDomain"
    $pattern = 'server_name\s+[^;]+;'
    $replacement = "server_name $mainDomain $wildcardDomain;"
    $newContent = [regex]::Replace($content, $pattern, $replacement)
    if ($newContent -ne $content) {
        $script:FilesTouched += $Path
        $script:FieldsChanged++
        Write-Host "    server_name -> $mainDomain $wildcardDomain"
        if ($Production) {
            $bakName = ([System.IO.Path]::GetFileName($Path) + '.bak')
            Copy-Item $Path (Join-Path $backupDir $bakName) -Force
            Set-Content -Path $Path -Value $newContent -Encoding UTF8
            Write-Host "  [WRITE] $Path" -ForegroundColor Green
        } else {
            Write-Host "  [DRY]   $Path (not written)" -ForegroundColor DarkCyan
        }
    } else {
        Write-Host "  [NOOP]  $Path no server_name match" -ForegroundColor DarkGray
    }
}

# ---- 1. user-service EMAIL_FROM ----
Write-Host "`n[1/4] user-service EMAIL_FROM" -ForegroundColor Magenta
$userEnv = @{ 'EMAIL_FROM' = $FromEmail }
Update-EnvFile -Path (Join-Path $Root 'services\user-service\.env') -Map $userEnv
Update-EnvFile -Path (Join-Path $Root 'services\user-service\.env.example') -Map $userEnv

# ---- 2. monitor SMTP + ALERT_EMAIL_TO ----
Write-Host "`n[2/4] monitor SMTP (alert email)" -ForegroundColor Magenta
$monitorEnv = @{
    'SMTP_HOST'      = 'smtpdm.aliyun.com'
    'SMTP_PORT'      = '465'
    'SMTP_USER'      = "noreply@$Domain"
    'SMTP_PASSWORD'  = '<fill from DirectMail console>'
    'ALERT_EMAIL_TO' = "ops@$Domain"
}
Update-EnvFile -Path (Join-Path $Root 'services\monitor\.env') -Map $monitorEnv

# ---- 3. apps/* frontend VITE_API_BASE_URL ----
Write-Host "`n[3/4] apps/* VITE_API_BASE_URL (dev files only)" -ForegroundColor Magenta
foreach ($app in @('admin-portal','ops-portal','studio','user-portal','web')) {
    $envPath = Join-Path $Root "apps\$app\.env.development"
    if (Test-Path $envPath) {
        Write-Host "  [SKIP] $envPath is dev, stays localhost" -ForegroundColor DarkGray
    }
}
Write-Host "  [NOTE]  future .env.production should set VITE_API_BASE_URL=https://api.$Domain" -ForegroundColor DarkCyan

# ---- 4. nginx server_name ----
Write-Host "`n[4/4] nginx server_name" -ForegroundColor Magenta
$nginxConf = Join-Path $Root 'infrastructure\nginx\conf.d\manhuaworks.conf'
Update-NginxServerName -Path $nginxConf -NewDomain $Domain

# ---- 5. Summary ----
Write-Host "`n============================================" -ForegroundColor White
Write-Host " Switch complete (Domain=$Domain, From=$FromEmail)" -ForegroundColor White
if ($Production) {
    Write-Host "   Mode: PRODUCTION (written, backed up to $backupDir)" -ForegroundColor Green
} else {
    Write-Host "   Mode: DRY-RUN    (preview only)" -ForegroundColor Cyan
}
Write-Host "   Files touched: $($script:FilesTouched.Count)" -ForegroundColor White
Write-Host "   Fields changed: $($script:FieldsChanged)" -ForegroundColor White
Write-Host "============================================" -ForegroundColor White
if (-not $Production) {
    Write-Host "`nRe-run with -Production to actually write." -ForegroundColor Yellow
}