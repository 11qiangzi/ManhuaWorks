# ManhuaWorks 数据库迁移

> 谢擎 · 2026-06-08 更新

## 目录

```
docs/database/
├── ER.md                          # ER 设计图（实体清单 + 关系）
└── migrations/
    ├── README.md                  # 本文件
    ├── 001_init.sql               # 原始全量（pgvector 未拆版本，仅作参考）
    └── 002_seed.sql               # seed 转发（→ db/seed.sql）
```

## 状态（截至 2026-06-08）

| 迁移 | 状态 | 备注 |
|------|------|------|
| 001a_core.sql（核心 6 表） | ✅ 已跑 | 6 张表：users / projects / subscriptions / quotas / api_keys / api_call_logs |
| 001b_vector.sql（向量表） | ⏳ 待跑 | 等 pgvector 扩展装上后跑，建 role_vectors 表 |
| 002_seed.sql | ✅ 已跑 | 5 用户（覆盖 5 角色）+ 3 项目（3 场景）+ 订阅/配额/调用日志 |

## 怎么跑

**首次（从零）**：
```powershell
# 1. 跑核心表（pgvector 扩展缺失时会跳 vector 那部分）
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h 127.0.0.1 -U mhw -d manhuaworks -v ON_ERROR_STOP=1 -f "D:\ManhuaWorks\db\001a_core.sql"

# 2. 跑 seed
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h 127.0.0.1 -U mhw -d manhuaworks -v ON_ERROR_STOP=1 -f "D:\ManhuaWorks\db\seed.sql"

# 3. 验证
npx tsx D:\ManhuaWorks\db\verify.ts
```

**一键（推荐）**：
```powershell
powershell -ExecutionPolicy Bypass -File D:\ManhuaWorks\db\migrate.ps1
```

## 怎么回滚

```powershell
# 全清（警告：删全部 public 表）
powershell -ExecutionPolicy Bypass -File D:\ManhuaWorks\db\reset.ps1 -Force

# 之后再跑 migrate.ps1
powershell -ExecutionPolicy Bypass -File D:\ManhuaWorks\db\migrate.ps1
```

**单表回滚**（举例：只清 api_call_logs）：
```sql
TRUNCATE api_call_logs RESTART IDENTITY;
```

## 已知问题

### pgvector 扩展未安装

本机 PostgreSQL 16 没装 pgvector 扩展。`pg_available_extensions` 只列了：
- `pg_trgm` 1.6
- `pgcrypto` 1.3 ✅
- `uuid-ossp` 1.1 ✅

**影响**：`role_vectors` 表无法建（要用 `vector(384)` 类型）。

**解决方案**：
1. 用 Stack Builder 或从 https://github.com/pgvector/pgvector/releases 下载对应 PG16 的 windows 版本
2. 把 `vector.dll` 放进 `C:\Program Files\PostgreSQL\16\lib\`（如果没自动放）
3. 重启 PostgreSQL 服务
4. 跑 `db\001b_vector.sql`

**临时替代**：可以把 `role_vectors.embedding` 改成 `float[]`（384 个浮点）— 但会失去向量索引能力。**不推荐**，等扩展装上再补。

## 表清单

| # | 表名 | 用途 | 记录数（seed 后） |
|---|------|------|------------------|
| 1 | users | 用户 | 5 |
| 2 | projects | 项目/作品 | 3 |
| 3 | subscriptions | 订阅 | 5 |
| 4 | quotas | 配额 | 5 |
| 5 | api_keys | BYOK 加密 | 0 |
| 6 | api_call_logs | API 调用日志 | 1 |
| 7 | role_vectors | 角色一致性向量 | 0（待 pgvector） |

详细字段见 [ER.md](../ER.md)。
