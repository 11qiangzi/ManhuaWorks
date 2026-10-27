# ============================================================
# 派单51: 六大模块P0后端API PowerShell测试脚本
# 谢擎 | 2026-06-25
#
# 前置条件: ai-orchestrator 8087 已启动
# ============================================================

param(
    [switch]$Full  # 全跑（10个端点，含AI调用）
)

$ErrorActionPreference = "Continue"
$BASE = "http://192.168.10.4:8087"
$AUTH_BASE = "http://192.168.10.4:8088"

Write-Host "====== 派单51 API cURL验证 ======" -ForegroundColor Cyan

# Step 0: 获取 token
Write-Host "`n[0] 获取 token..." -ForegroundColor Yellow
try {
    $loginResp = Invoke-RestMethod -Uri "$AUTH_BASE/api/v1/auth/login-pwd" `
        -Method Post `
        -ContentType "application/json" `
        -Body '{"email":"demo-creator@manhuaworks.com","password":"Test1234!"}' `
        -ErrorAction Stop
    $TOKEN = $loginResp.data.token
    Write-Host "  OK: token acquired (${TOKEN}".Substring(0, [Math]::Min(20, $TOKEN.Length)) + "...)" -ForegroundColor Green
} catch {
    Write-Host "  FAIL: cannot get token - $_" -ForegroundColor Red
    Write-Host "  Trying demo-creator@qianjigongfang.com..." -ForegroundColor Yellow
    try {
        $loginResp = Invoke-RestMethod -Uri "$AUTH_BASE/api/v1/auth/login-pwd" `
            -Method Post `
            -ContentType "application/json" `
            -Body '{"email":"demo-creator@qianjigongfang.com","password":"Test1234!"}' `
            -ErrorAction Stop
        $TOKEN = $loginResp.data.token
        Write-Host "  OK: token acquired" -ForegroundColor Green
    } catch {
        Write-Host "  FATAL: no token, aborting" -ForegroundColor Red
        exit 1
    }
}

$headers = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
}

# ==================== API-1: 故事创意灵感 ====================
Write-Host "`n[1] API-1: 故事创意灵感" -ForegroundColor Yellow
try {
    $r = Invoke-RestMethod -Uri "$BASE/v1/creative/story/inspiration" -Method Post -Headers $headers -Body '{}'
    $count = $r.data.inspirations.Count
    Write-Host "  OK: ${count} inspirations" -ForegroundColor Green
    if ($count -gt 0) {
        Write-Host "     #1: $($r.data.inspirations[0].title) - $($r.data.inspirations[0].logline.Substring(0, [Math]::Min(40, $r.data.inspirations[0].logline.Length)))..." -ForegroundColor Gray
    }
} catch {
    Write-Host "  FAIL: $_" -ForegroundColor Red
}

# API-1: 换一批
Write-Host "`n[2] API-1: 换一批灵感" -ForegroundColor Yellow
try {
    $r = Invoke-RestMethod -Uri "$BASE/v1/creative/story/inspiration" -Method Post -Headers $headers -Body '{"refresh":true}'
    Write-Host "  OK: refreshed=$($r.data.refreshed), count=$($r.data.inspirations.Count)" -ForegroundColor Green
} catch {
    Write-Host "  FAIL: $_" -ForegroundColor Red
}

# ==================== API-2: 故事模板 ====================
Write-Host "`n[3] API-2: 模板列表" -ForegroundColor Yellow
try {
    $r = Invoke-RestMethod -Uri "$BASE/v1/creative/story/templates" -Method Get -Headers $headers
    Write-Host "  OK: $($r.data.Count) templates" -ForegroundColor Green
    $r.data | ForEach-Object { Write-Host "     $($_.icon) $($_.name) ($($_.id))" -ForegroundColor Gray }
} catch {
    Write-Host "  FAIL: $_" -ForegroundColor Red
}

Write-Host "`n[4] API-2: 模板大纲生成 (wuxia_xianxia)" -ForegroundColor Yellow
if ($Full) {
    try {
        $r = Invoke-RestMethod -Uri "$BASE/v1/creative/story/template" -Method Post -Headers $headers `
            -Body '{"templateId":"wuxia_xianxia","userInput":"一个凡人少年意外获得上古剑灵传承"}'
        Write-Host "  OK: template=$($r.data.templateId), title=$($r.data.title)" -ForegroundColor Green
    } catch {
        Write-Host "  FAIL: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  SKIP (use -Full to run AI calls)" -ForegroundColor Gray
}

# ==================== API-3: 世界观提取 ====================
Write-Host "`n[5] API-3: 世界观提取" -ForegroundColor Yellow
if ($Full) {
    try {
        $body = @{
            outlineText = "在灵气复苏的现代都市，主角林启在考古现场发现了一扇通往星空的青铜门。"
        } | ConvertTo-Json
        $r = Invoke-RestMethod -Uri "$BASE/v1/creative/story/worldview/extract" -Method Post -Headers $headers -Body $body
        Write-Host "  OK: overallScore=$($r.data.overallScore)" -ForegroundColor Green
    } catch {
        Write-Host "  FAIL: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  SKIP (use -Full to run AI calls)" -ForegroundColor Gray
}

Write-Host "`n[6] API-3: 世界观完善 (powerSystem)" -ForegroundColor Yellow
if ($Full) {
    try {
        $body = @{
            dimension = "powerSystem"
            currentText = "灵气等级分九重"
        } | ConvertTo-Json
        $r = Invoke-RestMethod -Uri "$BASE/v1/creative/story/worldview/enrich" -Method Post -Headers $headers -Body $body
        Write-Host "  OK: dimension=$($r.data.dimension), additions=$($r.data.additions.Count)" -ForegroundColor Green
    } catch {
        Write-Host "  FAIL: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  SKIP (use -Full to run AI calls)" -ForegroundColor Gray
}

# ==================== API-5: 动画多模式分析 ====================
Write-Host "`n[7] API-5: 动画分析 (blank模式)" -ForegroundColor Yellow
if ($Full) {
    try {
        $r = Invoke-RestMethod -Uri "$BASE/v1/creative/animation/analyze" -Method Post -Headers $headers -Body '{"mode":"blank"}'
        Write-Host "  OK: chars=$($r.data.summary.totalCharacters), shots=$($r.data.summary.totalShots)" -ForegroundColor Green
    } catch {
        Write-Host "  FAIL: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  SKIP (use -Full to run AI calls)" -ForegroundColor Gray
}

# ==================== API-6: 智能Brief ====================
Write-Host "`n[8] API-6: 智能Brief生成" -ForegroundColor Yellow
if ($Full) {
    try {
        $body = @{
            brandName = "千机工坊"
            targetAudience = "独立创作者和中小品牌方"
            sellingPoints = "AI一站式创作平台"
        } | ConvertTo-Json
        $r = Invoke-RestMethod -Uri "$BASE/v1/creative/promo/brief" -Method Post -Headers $headers -Body $body
        Write-Host "  OK: brand=$($r.data.brandName), positioning=$($r.data.productPositioning.Substring(0, [Math]::Min(60, $r.data.productPositioning.Length)))..." -ForegroundColor Green
    } catch {
        Write-Host "  FAIL: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  SKIP (use -Full to run AI calls)" -ForegroundColor Gray
}

# ==================== API-8: 商品链接解析 ====================
Write-Host "`n[9] API-8: 商品链接解析 (mock数据)" -ForegroundColor Yellow
if ($Full) {
    try {
        $body = @{
            platform = "taobao"
            url = "https://item.taobao.com/example"
            rawContent = "商品标题：2024新款无线降噪蓝牙耳机 价格：¥299.00 月销1000+ 卖点：主动降噪/40小时续航/Type-C快充/IPX5防水"
        } | ConvertTo-Json
        $r = Invoke-RestMethod -Uri "$BASE/v1/creative/short-video/product-parse" -Method Post -Headers $headers -Body $body
        Write-Host "  OK: platform=$($r.data.platform), title=$($r.data.productTitle)" -ForegroundColor Green
    } catch {
        Write-Host "  FAIL: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  SKIP (use -Full to run AI calls)" -ForegroundColor Gray
}

# ==================== API-10: 音乐需求翻译 ====================
Write-Host "`n[10] API-10: 音乐需求翻译" -ForegroundColor Yellow
if ($Full) {
    try {
        $body = @{
            description = "给我一首热血沸腾的BGM，要有史诗感，适合做预告片"
            duration = 60
        } | ConvertTo-Json
        $r = Invoke-RestMethod -Uri "$BASE/v1/creative/music/translate" -Method Post -Headers $headers -Body $body
        Write-Host "  OK: mood=$($r.data.interpretedMood), bpm=$($r.data.parameters.bpm)" -ForegroundColor Green
    } catch {
        Write-Host "  FAIL: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  SKIP (use -Full to run AI calls)" -ForegroundColor Gray
}

# ==================== 鉴权测试 ====================
Write-Host "`n[Auth] 无token→401测试" -ForegroundColor Yellow
try {
    $r = Invoke-RestMethod -Uri "$BASE/v1/creative/story/inspiration" -Method Post `
        -ContentType "application/json" -Body '{}' `
        -ErrorAction Stop
    Write-Host "  FAIL: should have returned 401 but got 200" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "  OK: 401 as expected" -ForegroundColor Green
    } else {
        Write-Host "  WARN: got $statusCode, expected 401" -ForegroundColor Yellow
    }
}

# ==================== 情绪参考速查 (无AI) ====================
Write-Host "`n[Extra] API-10: 情绪参考速查" -ForegroundColor Yellow
try {
    $r = Invoke-RestMethod -Uri "$BASE/v1/creative/music/mood-reference" -Method Get -Headers $headers
    $moods = ($r.data | Get-Member -MemberType NoteProperty).Count
    Write-Host "  OK: ${moods} moods mapped" -ForegroundColor Green
} catch {
    Write-Host "  FAIL: $_" -ForegroundColor Red
}

Write-Host "`n====== 测试完成 ======" -ForegroundColor Cyan
Write-Host "所有无AI端点（模板列表/情绪参考）应在不依赖Full模式下通过。"
Write-Host "用 -Full 参数跑完整10个AI端点。"
