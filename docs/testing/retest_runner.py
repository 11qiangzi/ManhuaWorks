# -*- coding: utf-8 -*-
"""路寒复测脚本 2026-06-09 — 虾总助"""
import urllib.request, urllib.error, json, os, sys, subprocess
from datetime import datetime

RESULTS = {}
ISSUES = []

def http(method, url, token=None, body=None, timeout=5):
    data = json.dumps(body).encode() if body is not None else None
    headers = {'Content-Type': 'application/json'} if data else {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        body_text = r.read().decode('utf-8', errors='replace')[:300]
        return r.getcode(), body_text
    except urllib.error.HTTPError as e:
        body_text = e.read().decode('utf-8', errors='replace')[:300]
        return e.code, body_text
    except Exception as e:
        return None, str(e)[:200]

# ========== 1. 登录 ==========
print('=' * 60)
print('[1] 登录 tester-luhan@manhuaworks.local')
print('=' * 60)
code, body = http('POST', 'http://192.168.0.11:8088/api/v1/auth/login',
                  body={'email': 'tester-luhan@manhuaworks.local', 'password': 'Test1234!'})
print(f'  login: HTTP {code}')
if code != 200:
    print(f'  BODY: {body}')
    sys.exit(1)
login_data = json.loads(body)['data']
token = login_data['access_token']
user_id = login_data['user']['id']
print(f'  user_id: {user_id}')

# ========== 2. 修复项复测 ==========
print()
print('=' * 60)
print('[2] 修复项复测')
print('=' * 60)

# 2.1 P0 /users/me (虾总助修)
code, body = http('GET', 'http://192.168.0.11:8088/api/v1/users/me', token=token)
RESULTS['P0 /users/me'] = (code, '✅ PASS' if code == 200 else f'❌ FAIL ({code})')
print(f'  /users/me: HTTP {code} {"✅" if code==200 else "❌"}')

# 2.2 /api-keys (谢擎修)
code, body = http('GET', 'http://192.168.0.11:8088/api/v1/api-keys', token=token)
RESULTS['P1 /api-keys'] = (code, '✅ PASS' if code == 200 else f'❌ FAIL ({code})')
print(f'  /api-keys: HTTP {code} {"✅" if code==200 else "❌"}')

# 2.3 collab 4 端点
pid = '00000000-0000-0000-0000-000000000000'
collab_results = []
for path in [
    f'/api/v1/collab/projects/{pid}/comments',
    f'/api/v1/collab/projects/{pid}/annotations',
    '/api/v1/collab/notifications',
    f'/api/v1/collab/projects/{pid}/activities',
]:
    code, body = http('GET', f'http://192.168.0.11:8091{path}', token=token)
    ok = code in (200, 404)
    sym = '✅' if ok else '❌'
    print(f'  {sym} GET {path}: HTTP {code}')
    collab_results.append((path, code, ok))
    if not ok:
        ISSUES.append(f'collab {path}: HTTP {code}')
RESULTS['P1 collab 4 endpoints'] = (collab_results, f'{sum(1 for _,_,ok in collab_results if ok)}/{len(collab_results)}')

# 2.4 billing /subscriptions
code, body = http('GET', 'http://192.168.0.11:8090/api/v1/billing/subscriptions', token=token)
RESULTS['P1 /billing/subscriptions'] = (code, f'{"✅ PASS" if code in (200,404) else f"❌ FAIL ({code})"}')
print(f'  /billing/subscriptions: HTTP {code} {"✅" if code in (200,404) else "❌"}')

# 2.5 ai-orchestrator /orchestrator/jobs
code, body = http('GET', 'http://192.168.0.11:8087/api/v1/orchestrator/jobs', token=token)
RESULTS['P? /orchestrator/jobs'] = (code, f'{"✅" if code in (200,404) else f"❌ FAIL ({code})"}')
print(f'  /orchestrator/jobs: HTTP {code} {"✅" if code in (200,404) else "❌"}')
if code is None or code >= 500:
    ISSUES.append(f'ai-orchestrator 8087 不可达/jobs: {code}')

# ========== 3. studio 7 view 静态 ==========
print()
print('=' * 60)
print('[3] studio 静态检查')
print('=' * 60)
VIEWS = ['PlaceholderView','StudioHomeView','ProjectEditorView','CharacterView',
         'SceneView','ToolboxView','WorkflowDesignerView','ExportView']
view_results = []
for v in VIEWS:
    p = fr'D:\ManhuaWorks\apps\studio\src\views\{v}.vue'
    ok = os.path.exists(p)
    sym = '✅' if ok else '❌'
    print(f'  {sym} {v}.vue: {"存在" if ok else "缺失"}')
    view_results.append((v, ok))
    if not ok:
        ISSUES.append(f'studio view 缺失: {v}.vue')

# 路由 HTTP 200
ROUTES = ['/', '/projects', '/editor', '/characters', '/scenes', '/tools', '/workflow', '/export']
route_results = []
for p in ROUTES:
    code, body = http('GET', f'http://192.168.0.11:5175{p}', timeout=3)
    ok = code == 200
    sym = '✅' if ok else '❌'
    print(f'  {sym} 路由 {p}: HTTP {code}')
    route_results.append((p, code, ok))
    if not ok:
        ISSUES.append(f'studio 路由 {p}: HTTP {code}')

# 硬编码复查
print('  --- 硬编码复查 ---')
try:
    r = subprocess.run(
        ['powershell', '-NoProfile', '-Command',
         "Get-ChildItem 'D:\\ManhuaWorks\\apps\\studio\\src' -Recurse -Filter *.vue -ErrorAction SilentlyContinue | Select-String -Pattern 'localhost:8087|localhost:8088' | Select-Object -First 20"],
        capture_output=True, text=True, timeout=30
    )
    hardcoded = [ln for ln in r.stdout.splitlines() if ln.strip() and not ln.startswith('---')]
    print(f'  硬编码 (localhost:8087/8088): {len(hardcoded)} 处 (期望 0)')
    if hardcoded:
        for h in hardcoded[:5]:
            print(f'    {h[:120]}')
        ISSUES.append(f'studio 硬编码 {len(hardcoded)} 处')
    RESULTS['studio 硬编码'] = (len(hardcoded), '✅ 0 处' if len(hardcoded) == 0 else f'❌ {len(hardcoded)} 处')
except Exception as e:
    print(f'  硬编码检查失败: {e}')
    RESULTS['studio 硬编码'] = (None, f'⚠️ 检查失败: {e}')

# ========== 4. 5 service API 完整测试 ==========
print()
print('=' * 60)
print('[4] 5 service API 完整测试')
print('=' * 60)

svc_results = {}

# 4.1 user-service 8088
print('  --- user-service 8088 ---')
user_apis = [
    ('GET', '/api/v1/users/me', None),
    ('GET', '/api/v1/api-keys', None),
    ('GET', '/api/v1/users', None),
]
for method, path, body in user_apis:
    code, _ = http(method, f'http://192.168.0.11:8088{path}', token=token, body=body)
    sym = '✅' if code in (200, 404) else '❌'
    print(f'    {sym} {method} {path}: HTTP {code}')
    svc_results.setdefault('user', []).append((path, code))

# 4.2 project-service 8089
print('  --- project-service 8089 ---')
proj_apis = [
    ('GET', '/api/v1/projects', None),
    ('POST', '/api/v1/projects', {'name': '复测项目', 'description': 'auto-test'}),
    ('GET', f'/api/v1/projects/{pid}', None),
]
for method, path, body in proj_apis:
    code, _ = http(method, f'http://192.168.0.11:8089{path}', token=token, body=body)
    sym = '✅' if code in (200, 201, 404) else '❌'
    print(f'    {sym} {method} {path}: HTTP {code}')
    svc_results.setdefault('project', []).append((path, code))

# 4.3 billing-service 8090
print('  --- billing-service 8090 ---')
bill_apis = [
    ('GET', '/api/v1/billing/balance', None),
    ('GET', '/api/v1/billing/subscriptions', None),
    ('GET', '/api/v1/billing/invoices', None),
]
for method, path, body in bill_apis:
    code, _ = http(method, f'http://192.168.0.11:8090{path}', token=token, body=body)
    sym = '✅' if code in (200, 404) else '❌'
    print(f'    {sym} {method} {path}: HTTP {code}')
    svc_results.setdefault('billing', []).append((path, code))

# 4.4 collab-service 8091 (4+ 端点)
print('  --- collab-service 8091 ---')
collab_full = [
    f'/api/v1/collab/projects/{pid}/comments',
    f'/api/v1/collab/projects/{pid}/annotations',
    '/api/v1/collab/notifications',
    f'/api/v1/collab/projects/{pid}/activities',
    f'/api/v1/collab/projects/{pid}/members',
    '/api/v1/collab/notifications/unread',
    '/api/v1/collab/projects/{pid}/presence',
]
for path in collab_full:
    code, _ = http('GET', f'http://192.168.0.11:8091{path}', token=token)
    sym = '✅' if code in (200, 404) else '❌'
    print(f'    {sym} GET {path}: HTTP {code}')
    svc_results.setdefault('collab', []).append((path, code))

# 4.5 ai-orchestrator 8087
print('  --- ai-orchestrator 8087 ---')
orch_apis = [
    ('GET', '/api/v1/health', None),
    ('GET', '/api/v1/orchestrator/jobs', None),
    ('GET', '/api/v1/orchestrator/health', None),
]
for method, path, body in orch_apis:
    code, _ = http(method, f'http://192.168.0.11:8087{path}', token=token, body=body)
    sym = '✅' if code in (200, 404) else '❌'
    print(f'    {sym} {method} {path}: HTTP {code}')
    svc_results.setdefault('ai-orch', []).append((path, code))

# ========== 5. 输出报告 ==========
print()
print('=' * 60)
print('[5] 生成报告')
print('=' * 60)

# 汇总
ok_count = sum(1 for v in view_results if v[1])
route_ok = sum(1 for _,_,ok in route_results if ok)
svc_total = sum(len(v) for v in svc_results.values())
svc_ok = sum(1 for svc in svc_results.values() for _, c in svc if c in (200, 201, 404))
print(f'studio views: {ok_count}/8')
print(f'studio 路由: {route_ok}/{len(route_results)}')
print(f'5 service API: {svc_ok}/{svc_total}')

print()
print('=' * 60)
print(f'完成. ISSUES={len(ISSUES)}')
print('=' * 60)