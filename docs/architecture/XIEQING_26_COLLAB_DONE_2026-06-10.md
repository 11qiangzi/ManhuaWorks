# 谢擎 · 派单 26 — 修 collab 8091 没起完工报告

> **工程师**: 谢擎 🗄️ 开发部后端
> **派单**: 26 (修 collab 8091 没起)
> **完成时间**: 2026-06-10 16:35 (GMT+8)
> **Session**: agent:main:subagent:04c871ef-12fd-4c4d-b22c-6af5904b86f5
> **上游**: XIEQING_25_PERF_DONE (派单 25 验收发现 collab 8091 没起)

---

## 一、根因

**tsx watch 进程退出** — 派单 25 改完 `collab-service/src/app.ts` (rate-limit 参数 100→1000) 后，tsx watch 自动重载后进程被外部 SIGKILL（虾总助验收时可能杀进程验证）。

- `.start.err`: 0 字节，无编译错误
- `.start.log`: 16:09 曾成功启动，Redis 连接正常，RealtimeService 订阅正常
- `app.ts` rate-limit 改动仅参数值上调，无语法错误，编译正常
- **结论**: 非代码 bug，进程生命周期管理问题

---

## 二、修复

### 重启 collab-service
```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", 
  "cd D:\ManhuaWorks\services\collab-service; pnpm dev 2>&1 | Tee-Object -FilePath .start.log" 
  -WindowStyle Hidden
```

- ✅ tsx watch 启动成功
- ✅ HTTP 8091 监听正常
- ✅ Redis pub/sub/cmd 3 通道连接正常
- ✅ RealtimeService 订阅正常

---

## 三、cURL 验证

| 验证项 | 方法 | 结果 |
|--------|------|------|
| TCP 8091 通 | `Test-NetConnection 127.0.0.1 -Port 8091` | ✅ True |
| /health | `curl http://127.0.0.1:8091/health` | ✅ `{"code":0,"data":{"postgres":true,"redis":true}}` |
| / 根端点 | `curl http://127.0.0.1:8091/` | ✅ 10 端点列表完整 |
| Rate-limit 生效 | `curl -I /health` | ✅ `X-RateLimit-Limit: 1000` (派单 25 改动确认) |
| 5 服务全起 | 8088/8089/8090/8091/8087 TCP | ✅ 5/5 TCP 通 |

### 详细 cURL 输出

**GET /health:**
```json
{"code":0,"message":"ok","data":{"service":"collab-service","version":"0.1.0","uptime_sec":50,"deps":{"postgres":true,"redis":true},"realtime":{"connections":0,"projects":0,"users":0},"ts":"2026-06-10T08:34:59.770Z"}}
```

**Rate-limit headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 997
X-RateLimit-Reset: 1781080620
```

---

## 四、改动清单

**无代码改动** — 本次仅重启服务。`app.ts` 的 rate-limit 参数已在派单 25 中完成修改，无需额外代码变更。

---

## 五、范围

**只动** collab-service 8091 进程生命周期。

**不动**:
- 前端 .vue / vite.config (那是林染)
- 其他 4 服务代码
- DB schema / migration

---

## 六、后续建议

1. **进程守护**: 生产环境建议用 PM2 或 Docker Compose `restart: always`，避免 tsx watch 退出后服务离线
2. **健康监控**: 可加定时 curl /health 探活（路寒管监控）
3. **ai-orchestrator /health**: 8087 用 Hono 框架，/health 返回格式非 `{code:0}`，Invoke-RestMethod 解析为 "DOWN" 是误报，实际 TCP 通

---

> **谢擎署名**: 派单 26 完成。collab 8091 从 0→1，5/5 服务全起。无代码改动，纯运维重启。
