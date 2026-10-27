# ManhuaWorks DB 工具箱

> 谢擎 · 2026-06-08

DB 运维脚本：迁移 / 重置 / 验证 / 种子数据。

## 文件清单

| 文件 | 类型 | 作用 |
|------|------|------|
| `001a_core.sql` | SQL | 6 张核心表：users / projects / subscriptions / quotas / api_keys / api_call_logs |
| `001b_vector.sql` | SQL | 角色向量表（需 pgvector 扩展） |
| `seed.sql` | SQL | 业务种子：5 用户（5 角色）+ 3 项目（3 场景）+ 订阅/配额/调用日志 |
| `migrate.ps1` | PowerShell | 一键迁移：检测 psql + 测连 + 跑 001a + seed + 验证 |
| `reset.ps1` | PowerShell | 清库重置（DROP public schema CASCADE） |
| `verify.ts` | TypeScript | 验证：连库 + 查每表 row count + 输出报表 + 退出码 |

## 库设计说明

7 张表，按功能分 3 组：

### 用户/账户组（4 张）
- **users** — 用户主表。`role` SMALLINT 1-5：普通/会员/客服/运营/管理员
- **subscriptions** — 订阅（plan: free/basic/pro/enterprise），1:1
- **quotas** — 配额（每月 token/image/video），1:1
- **api_keys** — BYOK 加密存储（`key_encrypted` BYTEA + `key_iv` BYTEA），1:N

### 业务组（2 张）
- **projects** — 用户项目，1:N
- **role_vectors** — 项目下角色一致性向量（embedding vector(384)），1:N

### 运营组（1 张）
- **api_call_logs** — 全量 API 调用 + 成本日志，BIGSERIAL 主键

## 关系图

```
users 1──┬─1 subscriptions
         ├─1 quotas
         ├─1:N projects ──1:N role_vectors
         ├─1:N api_keys
         └─1:N api_call_logs
                  │
                  └─N:1 projects (可空)
```

详细字段见 [../docs/database/ER.md](../docs/database/ER.md)。

## 快速使用

### 首次部署（从零）
```powershell
# 清库（如果之前有残留）
powershell -ExecutionPolicy Bypass -File D:\ManhuaWorks\db\reset.ps1 -Force

# 迁移
powershell -ExecutionPolicy Bypass -File D:\ManhuaWorks\db\migrate.ps1
```

### 验证
```powershell
# 简易（仅看行数）
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h 127.0.0.1 -U mhw -d manhuaworks -c "SELECT 'users', count(*) FROM users UNION ALL SELECT 'projects', count(*) FROM projects;"

# 详细（带断言 + 角色分布 + 项目场景）
npx tsx D:\ManhuaWorks\db\verify.ts
```

### 跑通证据（2026-06-08）

```
users           5
projects        3
subscriptions   5
quotas          5
api_keys        0
api_call_logs   1
role_vectors    0  (待 pgvector 扩展)
```

## 注意事项

1. **密码硬编码**：`mhw_dev_password_2026` 是开发环境密码，仅在 `migrate.ps1` / `reset.ps1` / `verify.ts` 里。生产环境改成 env var。
2. **pgvector 未装**：role_vectors 表建不了，需要系统级装 pgvector 扩展（详见 [../docs/database/migrations/README.md#pgvector](../docs/database/migrations/README.md)）。
3. **CHANGELOG**：以后改表，先在 `docs/database/migrations/` 加新文件（003_xxx.sql），不要改老文件。

## 依赖

- PostgreSQL 16（路径 `C:\Program Files\PostgreSQL\16\bin\psql.exe`）
- Node 20+ + `tsx`（跑 verify.ts）
- 项目已装 `pg` + `@types/pg`（verify.ts 依赖）
