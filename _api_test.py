# -*- coding: utf-8 -*-
"""路寒 - 后端 API 直测脚本
测试范围: user-service(8088) / project-service(8089) / billing-service(8090) / collab-service(8091) / ai-orchestrator(8087)
"""
import urllib.request, urllib.error, json, time, uuid

BASE = {
    "user":   "http://192.168.0.11:8088",
    "proj":   "http://192.168.0.11:8089",
    "bill":   "http://192.168.0.11:8090",
    "collab": "http://192.168.0.11:8091",
    "ai":     "http://192.168.0.11:8087",
}

results = []  # (tc, service, endpoint, method, status, body, severity)

def call(method, url, headers=None, body=None, timeout=8):
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8") if not isinstance(body, (bytes, str)) else body
    req = urllib.request.Request(url, method=method, headers=h, data=data)
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        return r.getcode(), r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        try:
            b = e.read().decode("utf-8", errors="replace")
        except Exception:
            b = ""
        return e.code, b
    except Exception as e:
        return 0, f"EXC: {type(e).__name__}: {e}"

def rec(tc, svc, ep, method, status, body, severity=""):
    body_short = body[:120].replace("\n", " ").replace("\r", " ")
    results.append((tc, svc, ep, method, status, body_short, severity))
    print(f"[{tc}] {method} {ep} -> {status} {severity} :: {body_short}")

# ===== 0. 登录拿 token =====
print("=" * 60)
print("[0] Login as tester-luhan")
print("=" * 60)
status, body = call("POST", f"{BASE['user']}/api/v1/auth/login",
                    body={"email": "tester-luhan@manhuaworks.local", "password": "Test1234!"})
rec("TC-API-LOGIN", "user", "/auth/login", "POST", status, body)
if status != 200:
    print("LOGIN FAILED, abort")
    raise SystemExit(1)
token_data = json.loads(body)["data"]
token = token_data["access_token"]
# 拿 user_id 从 token (payload 是 base64url)
import base64
def b64dec(s):
    s = s + "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s.encode()).decode()
payload = json.loads(b64dec(token.split(".")[1]))
user_id = payload["sub"]
print(f"user_id = {user_id}, role = {payload.get('role')}")

auth_h = {"Authorization": f"Bearer {token}", "x-mhw-user-id": user_id}

# ===== 1. user-service (8088) =====
print("\n" + "=" * 60)
print("[1] user-service (8088)")
print("=" * 60)

# TC-API-001 login OK (already)
# TC-API-002 login wrong pw -> 401
status, body = call("POST", f"{BASE['user']}/api/v1/auth/login",
                    body={"email": "tester-luhan@manhuaworks.local", "password": "WrongPw!"})
rec("TC-API-002", "user", "/auth/login (wrong pw)", "POST", status, body, "边界")

# TC-API-003 register new user
new_email = f"luhan-test-{uuid.uuid4().hex[:8]}@manhuaworks.local"
status, body = call("POST", f"{BASE['user']}/api/v1/auth/register",
                    body={"email": new_email, "password": "Test1234!", "username": "luhan_new"})
rec("TC-API-003", "user", "/auth/register", "POST", status, body)

# TC-API-004 users/me OK
status, body = call("GET", f"{BASE['user']}/api/v1/users/me", headers=auth_h)
rec("TC-API-004", "user", "/users/me", "GET", status, body)

# TC-API-005 users/me 无 token -> 401
status, body = call("GET", f"{BASE['user']}/api/v1/users/me")
rec("TC-API-005", "user", "/users/me (no token)", "GET", status, body, "边界")

# TC-API-006 users (admin)
status, body = call("GET", f"{BASE['user']}/api/v1/users", headers=auth_h)
rec("TC-API-006", "user", "/users (admin)", "GET", status, body)

# TC-API-007 api-keys POST
status, body = call("POST", f"{BASE['user']}/api/v1/api-keys", headers=auth_h,
                    body={"name": "luhan-test-key", "scopes": ["read"]})
rec("TC-API-007", "user", "/api-keys", "POST", status, body)
api_key_id = None
try:
    api_key_id = json.loads(body).get("data", {}).get("id") or json.loads(body).get("data", {}).get("key_id")
except Exception:
    pass

# TC-API-008 api-keys GET
status, body = call("GET", f"{BASE['user']}/api/v1/api-keys", headers=auth_h)
rec("TC-API-008", "user", "/api-keys", "GET", status, body)

# TC-API-009 api-keys DELETE
if api_key_id:
    status, body = call("DELETE", f"{BASE['user']}/api/v1/api-keys/{api_key_id}", headers=auth_h)
    rec("TC-API-009", "user", f"/api-keys/{api_key_id[:8]}…", "DELETE", status, body)
else:
    rec("TC-API-009", "user", "/api-keys/{id}", "DELETE", "skip", "no id created", "跳过")

# ===== 2. project-service (8089) =====
print("\n" + "=" * 60)
print("[2] project-service (8089)")
print("=" * 60)

# TC-API-010 GET projects
status, body = call("GET", f"{BASE['proj']}/api/v1/projects", headers=auth_h)
rec("TC-API-010", "proj", "/projects", "GET", status, body)

# TC-API-011 POST projects
proj_name = f"luhan-test-{uuid.uuid4().hex[:8]}"
status, body = call("POST", f"{BASE['proj']}/api/v1/projects", headers=auth_h,
                    body={"name": proj_name, "type": "manga", "description": "luhan api test"})
rec("TC-API-011", "proj", "/projects", "POST", status, body)
proj_id = None
try:
    proj_id = json.loads(body).get("data", {}).get("id") or json.loads(body).get("data", {}).get("project_id")
except Exception:
    pass
print(f"project_id = {proj_id}")

# TC-API-012 GET /projects/{id}
if proj_id:
    status, body = call("GET", f"{BASE['proj']}/api/v1/projects/{proj_id}", headers=auth_h)
    rec("TC-API-012", "proj", f"/projects/{proj_id[:8]}…", "GET", status, body)
else:
    rec("TC-API-012", "proj", "/projects/{id}", "GET", "skip", "no id", "跳过")

# TC-API-013 GET /projects/{not-exist} -> 404
status, body = call("GET", f"{BASE['proj']}/api/v1/projects/00000000-0000-0000-0000-000000000000", headers=auth_h)
rec("TC-API-013", "proj", "/projects/000… (404)", "GET", status, body, "边界")

# TC-API-014 PATCH /projects/{id}
if proj_id:
    status, body = call("PATCH", f"{BASE['proj']}/api/v1/projects/{proj_id}", headers=auth_h,
                        body={"description": "luhan updated"})
    rec("TC-API-014", "proj", f"/projects/{proj_id[:8]}…", "PATCH", status, body)
else:
    rec("TC-API-014", "proj", "/projects/{id}", "PATCH", "skip", "no id", "跳过")

# TC-API-015 GET assets
status, body = call("GET", f"{BASE['proj']}/api/v1/assets", headers=auth_h)
rec("TC-API-015", "proj", "/assets", "GET", status, body)

# TC-API-016 POST scenes
if proj_id:
    status, body = call("POST", f"{BASE['proj']}/api/v1/scenes", headers=auth_h,
                        body={"project_id": proj_id, "title": "luhan scene 1", "description": "test"})
    rec("TC-API-016", "proj", "/scenes", "POST", status, body)
else:
    rec("TC-API-016", "proj", "/scenes", "POST", "skip", "no proj_id", "跳过")

# TC-API-017 DELETE /projects/{id} (放最后)
if proj_id:
    status, body = call("DELETE", f"{BASE['proj']}/api/v1/projects/{proj_id}", headers=auth_h)
    rec("TC-API-017", "proj", f"/projects/{proj_id[:8]}…", "DELETE", status, body)
else:
    rec("TC-API-017", "proj", "/projects/{id}", "DELETE", "skip", "no id", "跳过")

# ===== 3. billing-service (8090) =====
print("\n" + "=" * 60)
print("[3] billing-service (8090)")
print("=" * 60)

status, body = call("GET", f"{BASE['bill']}/api/v1/billing/balance", headers=auth_h)
rec("TC-API-020", "bill", "/billing/balance", "GET", status, body)

status, body = call("POST", f"{BASE['bill']}/api/v1/billing/recharge", headers=auth_h,
                    body={"amount": 100, "currency": "CNY", "method": "test"})
rec("TC-API-021", "bill", "/billing/recharge", "POST", status, body)

status, body = call("GET", f"{BASE['bill']}/api/v1/billing/subscriptions", headers=auth_h)
rec("TC-API-022", "bill", "/billing/subscriptions", "GET", status, body)

status, body = call("GET", f"{BASE['bill']}/api/v1/billing/invoices", headers=auth_h)
rec("TC-API-023", "bill", "/billing/invoices", "GET", status, body)

status, body = call("GET", f"{BASE['bill']}/api/v1/billing/usage", headers=auth_h)
rec("TC-API-024", "bill", "/billing/usage", "GET", status, body)

# 边界: billing 无 token -> 401
status, body = call("GET", f"{BASE['bill']}/api/v1/billing/balance")
rec("TC-API-025", "bill", "/billing/balance (no auth)", "GET", status, body, "边界")

# ===== 4. collab-service (8091) =====
print("\n" + "=" * 60)
print("[4] collab-service (8091)")
print("=" * 60)

# collab 需要 proj_id, 用一个 fake 也试
fake_pid = "11111111-1111-1111-1111-111111111111"
status, body = call("GET", f"{BASE['collab']}/api/v1/collab/projects/{fake_pid}/comments", headers=auth_h)
rec("TC-API-030", "collab", f"/projects/{fake_pid[:8]}/comments", "GET", status, body)

status, body = call("POST", f"{BASE['collab']}/api/v1/collab/projects/{fake_pid}/comments", headers=auth_h,
                    body={"content": "luhan test comment"})
rec("TC-API-031", "collab", f"/projects/{fake_pid[:8]}/comments", "POST", status, body)

status, body = call("GET", f"{BASE['collab']}/api/v1/collab/projects/{fake_pid}/annotations", headers=auth_h)
rec("TC-API-032", "collab", f"/projects/{fake_pid[:8]}/annotations", "GET", status, body)

status, body = call("POST", f"{BASE['collab']}/api/v1/collab/projects/{fake_pid}/annotations", headers=auth_h,
                    body={"x": 100, "y": 200, "text": "luhan anno"})
rec("TC-API-033", "collab", f"/projects/{fake_pid[:8]}/annotations", "POST", status, body)

# ===== 5. ai-orchestrator (8087) =====
print("\n" + "=" * 60)
print("[5] ai-orchestrator (8087)")
print("=" * 60)

status, body = call("GET", f"{BASE['ai']}/health")
rec("TC-API-040", "ai", "/health", "GET", status, body)

status, body = call("POST", f"{BASE['ai']}/api/v1/orchestrator/jobs", headers=auth_h,
                    body={"type": "test", "payload": {"x": 1}})
rec("TC-API-041", "ai", "/orchestrator/jobs", "POST", status, body)

status, body = call("GET", f"{BASE['ai']}/api/v1/orchestrator/jobs", headers=auth_h)
rec("TC-API-042", "ai", "/orchestrator/jobs", "GET", status, body)

status, body = call("GET", f"{BASE['ai']}/api/v1/orchestrator/pipelines", headers=auth_h)
rec("TC-API-043", "ai", "/orchestrator/pipelines", "GET", status, body)

# ===== 写报告 =====
print("\n" + "=" * 60)
print("Saving report...")
print("=" * 60)

# 统计
total = len(results)
def _st(r):
    s = r[4]
    return s if isinstance(s, int) else 0
passed = sum(1 for r in results if 200 <= _st(r) < 300)
failed = sum(1 for r in results if _st(r) == 0 or _st(r) >= 400)
boundary = sum(1 for r in results if r[6] == "边界")
skip = sum(1 for r in results if r[6] == "跳过")

# 按 service 分组
from collections import defaultdict
by_svc = defaultdict(list)
for r in results:
    by_svc[r[1]].append(r)

lines = []
lines.append("# 路寒 API 测试报告 (2026-06-09)")
lines.append("")
lines.append(f"- 测试员: tester-luhan (开发部测试组)")
lines.append(f"- 测试账号: tester-luhan@manhuaworks.local")
lines.append(f"- 测试时间: 2026-06-09 15:06 CST")
lines.append(f"- 测试方式: 直连 service API (内网 192.168.0.11)")
lines.append("")

for svc in ["user", "proj", "bill", "collab", "ai"]:
    if svc not in by_svc:
        continue
    port = {"user": "8088", "proj": "8089", "bill": "8090", "collab": "8091", "ai": "8087"}[svc]
    name = {"user": "user-service", "proj": "project-service", "bill": "billing-service",
            "collab": "collab-service", "ai": "ai-orchestrator"}[svc]
    lines.append(f"## {name} ({port})")
    lines.append("")
    lines.append("| TC | Endpoint | 方法 | 状态 | 响应摘要 | 备注 |")
    lines.append("|----|----------|------|------|----------|------|")
    for tc, _, ep, method, status, body_short, sev in by_svc[svc]:
        sev_str = sev if sev else ""
        if isinstance(status, int):
            if 200 <= status < 300:
                sev_str = sev_str or "✅"
            elif status >= 400:
                sev_str = sev_str or "❌"
        lines.append(f"| {tc} | `{ep}` | {method} | {status} | {body_short} | {sev_str} |")
    lines.append("")

lines.append("## 总览")
lines.append("")
lines.append(f"- 总用例: **{total}**")
lines.append(f"- 通过 (2xx): **{passed}**")
lines.append(f"- 失败 (4xx/5xx/异常): **{failed}**")
lines.append(f"- 边界用例 (401/403/400/404): **{boundary}**")
lines.append(f"- 跳过 (依赖失败): **{skip}**")
lines.append("")
lines.append("## 备注")
lines.append("- 所有请求均通过本地 192.168.0.11 内网直连, 未走 gateway")
lines.append("- 401/403/400/404 视为预期边界, 不计入'失败'")
lines.append("- 严重度: 5xx 视为严重, 4xx 视情况 (业务预期则降级)")

with open(r"D:\ManhuaWorks\docs\testing\report_luhan_api_2026-06-09.md", "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"OK: {total} cases, {passed} pass, {failed} fail, {boundary} boundary")
print(f"Report: D:\\ManhuaWorks\\docs\\testing\\report_luhan_api_2026-06-09.md")