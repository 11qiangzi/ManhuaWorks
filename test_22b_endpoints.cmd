@echo off
setlocal enabledelayedexpansion

set "ADMIN_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJlbWFpbCI6ImFkbWluQG1hbmh1YXdvcmtzLmxvY2FsIiwicm9sZSI6NSwiZGlzcGxheU5hbWUiOiJBZG1pbiIsInR5cCI6ImFjY2VzcyIsImlhdCI6MTc4MTA3MDY2MSwiZXhwIjoxNzgxNjc1NDYxfQ.aUaN_0cwtnvLGikBXHuaheK6WgNUGwOWv7856QHP87U"
set "CREATOR_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMDIiLCJlbWFpbCI6ImRlbW8tY3JlYXRvckBtYW5odWF3b3Jrcy5sb2NhbCIsInJvbGUiOjIsImRpc3BsYXlOYW1lIjoiRGVtb0NyZWF0b3IiLCJ0eXAiOiJhY2Nlc3MiLCJpYXQiOjE3ODEwNzA2NjcsImV4cCI6MTc4MTY3NTQ2N30.y411zQrCdpSZCvWq5fGIEvTNhbUZj302Ed4NBhVTPA4"
set "PASS=0"
set "FAIL=0"

echo ==========================================
echo  谢擎 派单22B 端点 cURL 批量验证
echo ==========================================
echo.

:: ─── D3 Characters (project-service 8089) ───
echo [D3] project-service characters

curl.exe -s -o nul -w "  GET  characters?projectId=10000... %%{http_code}" http://127.0.0.1:8089/api/v1/characters?projectId=10000000-0000-0000-0000-000000000001 -H "Authorization: Bearer %CREATOR_TOKEN%"
echo.

curl.exe -s -o nul -w "  POST characters             %%{http_code}" -X POST http://127.0.0.1:8089/api/v1/characters -H "Authorization: Bearer %CREATOR_TOKEN%" -H "Content-Type: application/json" -d "{\"projectId\":\"10000000-0000-0000-0000-000000000001\",\"name\":\"test-char\",\"archetype\":\"hero\"}"
echo.

curl.exe -s -o nul -w "  No token -> 401             %%{http_code}" http://127.0.0.1:8089/api/v1/characters?projectId=10000000-0000-0000-0000-000000000001
echo.

echo.

:: ─── D4 Collab Teams (collab-service 8091) ───
echo [D4] collab-service teams

curl.exe -s -o nul -w "  POST /teams                  %%{http_code}" -X POST http://127.0.0.1:8091/api/v1/teams -H "Authorization: Bearer %CREATOR_TOKEN%" -H "Content-Type: application/json" -d "{\"name\":\"test-team\"}"
echo.

curl.exe -s -o nul -w "  GET  /teams                  %%{http_code}" http://127.0.0.1:8091/api/v1/teams -H "Authorization: Bearer %CREATOR_TOKEN%"
echo.

curl.exe -s -o nul -w "  No token teams -> 401        %%{http_code}" http://127.0.0.1:8091/api/v1/teams
echo.

echo.

:: ─── D4 Admin (user-service 8088) ───
echo [D4] user-service admin

curl.exe -s -o nul -w "  GET  /admin/stats            %%{http_code}" http://127.0.0.1:8088/api/v1/admin/stats -H "Authorization: Bearer %ADMIN_TOKEN%"
echo.

curl.exe -s -o nul -w "  GET  /admin/audit-logs       %%{http_code}" http://127.0.0.1:8088/api/v1/admin/audit-logs -H "Authorization: Bearer %ADMIN_TOKEN%"
echo.

curl.exe -s -o nul -w "  GET  /admin/settings         %%{http_code}" http://127.0.0.1:8088/api/v1/admin/settings -H "Authorization: Bearer %ADMIN_TOKEN%"
echo.

curl.exe -s -o nul -w "  PATCH /admin/settings        %%{http_code}" -X PATCH http://127.0.0.1:8088/api/v1/admin/settings -H "Authorization: Bearer %ADMIN_TOKEN%" -H "Content-Type: application/json" -d "{\"siteName\":\"test\"}"
echo.

curl.exe -s -o nul -w "  Non-admin -> 403            %%{http_code}" http://127.0.0.1:8088/api/v1/admin/stats -H "Authorization: Bearer %CREATOR_TOKEN%"
echo.

echo.

:: ─── D4 Ops (user-service 8088) ───
echo [D4] user-service ops

curl.exe -s -o nul -w "  GET  /ops/health             %%{http_code}" http://127.0.0.1:8088/api/v1/ops/health -H "Authorization: Bearer %ADMIN_TOKEN%"
echo.

curl.exe -s -o nul -w "  GET  /ops/metrics            %%{http_code}" http://127.0.0.1:8088/api/v1/ops/metrics -H "Authorization: Bearer %ADMIN_TOKEN%"
echo.

curl.exe -s -o nul -w "  GET  /ops/services           %%{http_code}" http://127.0.0.1:8088/api/v1/ops/services -H "Authorization: Bearer %ADMIN_TOKEN%"
echo.

echo.

:: ─── D5 Billing Admin (billing-service 8090) ───
echo [D5] billing-service admin

curl.exe -s -o nul -w "  GET  /billing/summary        %%{http_code}" http://127.0.0.1:8090/api/v1/admin/billing/summary -H "Authorization: Bearer %ADMIN_TOKEN%"
echo.

curl.exe -s -o nul -w "  GET  /billing/overview       %%{http_code}" http://127.0.0.1:8090/api/v1/admin/billing/overview -H "Authorization: Bearer %ADMIN_TOKEN%"
echo.

curl.exe -s -o nul -w "  GET  /refunds                %%{http_code}" http://127.0.0.1:8090/api/v1/admin/refunds -H "Authorization: Bearer %ADMIN_TOKEN%"
echo.

curl.exe -s -o nul -w "  Non-admin billing -> 403     %%{http_code}" http://127.0.0.1:8090/api/v1/admin/billing/summary -H "Authorization: Bearer %CREATOR_TOKEN%"
echo.

echo.

:: ─── D5 AI BYOK (ai-orchestrator 8087) ───
echo [D5] ai-orchestrator BYOK

curl.exe -s -o nul -w "  GET  /ai/byok                %%{http_code}" http://127.0.0.1:8087/api/v1/ai/byok -H "Authorization: Bearer %CREATOR_TOKEN%"
echo.

curl.exe -s -o nul -w "  GET  /ai/byok/quota          %%{http_code}" http://127.0.0.1:8087/api/v1/ai/byok/quota -H "Authorization: Bearer %CREATOR_TOKEN%"
echo.

echo.

:: ─── D6 Rate-limit (4 services) ───
echo [D6] Rate-limit headers

curl.exe -s -D - -o nul http://127.0.0.1:8088/health 2>nul | findstr /i "ratelimit x-ratelimit" >nul && echo "  user-service 8088: rate-limit headers OK" || echo "  user-service 8088: rate-limit headers MISSING"

curl.exe -s -D - -o nul http://127.0.0.1:8089/health 2>nul | findstr /i "ratelimit x-ratelimit" >nul && echo "  project-service 8089: rate-limit headers OK" || echo "  project-service 8089: rate-limit headers MISSING"

curl.exe -s -D - -o nul http://127.0.0.1:8091/health 2>nul | findstr /i "ratelimit x-ratelimit" >nul && echo "  collab-service 8091: rate-limit headers OK" || echo "  collab-service 8091: rate-limit headers MISSING"

curl.exe -s -D - -o nul http://127.0.0.1:8090/health 2>nul | findstr /i "ratelimit x-ratelimit" >nul && echo "  billing-service 8090: rate-limit headers OK" || echo "  billing-service 8090: rate-limit headers MISSING"

echo.
echo ==========================================
echo  验证完成
echo ==========================================
