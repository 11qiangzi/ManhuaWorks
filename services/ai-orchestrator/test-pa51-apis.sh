@echo off
REM ============================================================
REM 派单51: 六大模块P0后端API cURL测试脚本
REM 谢擎 | 2026-06-25
REM 
REM 前置条件: ai-orchestrator 8087 已启动
REM 测试 token: 从 user-service 8088 登录获取
REM ============================================================

set BASE=http://192.168.10.4:8087
set TOKEN=

REM --- 步骤0: 获取测试 token ---
echo [0/10] 获取 token...
for /f "usebackq tokens=*" %%i in (`curl -s -X POST http://192.168.10.4:8088/api/v1/auth/login-pwd -H "Content-Type: application/json" -d "{\"email\":\"demo-creator@manhuaworks.com\",\"password\":\"Test1234!\"}" 2^>NUL ^| jq -r ".data.token"`) do set TOKEN=%%i

if "%TOKEN%"=="" (
  echo 无法获取 token，尝试用 Invoke-RestMethod...
  powershell -Command "$r = Invoke-RestMethod -Uri 'http://192.168.10.4:8088/api/v1/auth/login-pwd' -Method Post -ContentType 'application/json' -Body '{\"email\":\"demo-creator@manhuaworks.com\",\"password\":\"Test1234!\"}'; Write-Output $r.data.token"
  goto :end
)
echo Token: %TOKEN:~0,20%...

REM --- API-1: 故事创意灵感 ---
echo.
echo [1/10] API-1: 故事创意灵感
curl -s -X POST %BASE%/v1/creative/story/inspiration ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{}" | jq ".data.inspirations | length"

REM API-1: 换一批
echo.
echo [2/10] API-1: 换一批灵感
curl -s -X POST %BASE%/v1/creative/story/inspiration ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{\"refresh\":true}" | jq ".data.refreshed"

REM --- API-2: 故事模板列表 ---
echo.
echo [3/10] API-2: 模板列表
curl -s %BASE%/v1/creative/story/templates ^
  -H "Authorization: Bearer %TOKEN%" | jq ".data | length"

REM API-2: 模板大纲生成
echo.
echo [4/10] API-2: 模板大纲生成 (wuxia_xianxia)
curl -s -X POST %BASE%/v1/creative/story/template ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{\"templateId\":\"wuxia_xianxia\",\"userInput\":\"一个凡人少年意外获得上古剑灵传承\"}" | jq ".data.templateId, .data.title"

REM --- API-3: 世界观提取 ---
echo.
echo [5/10] API-3: 世界观提取
curl -s -X POST %BASE%/v1/creative/story/worldview/extract ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{\"outlineText\":\"在灵气复苏的现代都市，主角林启在考古现场发现了一扇通往星空的青铜门。从此他踏上了一条从考古助理到星际文明奠基人的道路。灵气等级分九重，每提升一重寿命延长。\"}" | jq ".data.overallScore"

REM API-3: 世界观完善
echo.
echo [6/10] API-3: 世界观完善 (powerSystem)
curl -s -X POST %BASE%/v1/creative/story/worldview/enrich ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{\"dimension\":\"powerSystem\",\"currentText\":\"灵气等级分九重，每重提升后寿命延长\"}" | jq ".data.dimension, .data.additions | length"

REM --- API-5: 动画分析 (blank) ---
echo.
echo [7/10] API-5: 动画分析 (blank模式)
curl -s -X POST %BASE%/v1/creative/animation/analyze ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{\"mode\":\"blank\"}" | jq ".data.summary.totalCharacters, .data.summary.totalShots"

REM --- API-6: 智能Brief ---
echo.
echo [8/10] API-6: 智能Brief生成
curl -s -X POST %BASE%/v1/creative/promo/brief ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{\"brandName\":\"千机工坊\",\"targetAudience\":\"独立创作者和中小品牌方\",\"sellingPoints\":\"AI一站式创作平台，小说/动画/宣传片/短视频/广告图/配乐六大模块\"}" | jq ".data.brandName, .data.productPositioning"

REM --- API-8: 商品解析 ---
echo.
echo [9/10] API-8: 商品链接解析 (mock)
curl -s -X POST %BASE%/v1/creative/short-video/product-parse ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{\"platform\":\"taobao\",\"url\":\"https://item.taobao.com/example\",\"rawContent\":\"商品标题：2024新款无线降噪蓝牙耳机 价格：¥299.00 月销1000+ 卖点：主动降噪/40小时续航/Type-C快充/IPX5防水\"}" | jq ".data.platform, .data.productTitle"

REM --- API-10: 音乐需求翻译 ---
echo.
echo [10/10] API-10: 音乐需求翻译
curl -s -X POST %BASE%/v1/creative/music/translate ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{\"description\":\"给我一首热血沸腾的BGM，要有史诗感，适合做预告片\",\"duration\":60}" | jq ".data.interpretedMood, .data.parameters.bpm"

echo.
echo ========== 10/10 完成 ==========

:end
