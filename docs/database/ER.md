# ManhuaWorks PostgreSQL ER 设计

> 谢擎（W1-D1 6/7）

## 实体清单

### 1. users（用户）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| phone | VARCHAR(20) UNIQUE | 手机号 |
| email | VARCHAR(255) UNIQUE | 邮箱 |
| password_hash | VARCHAR(255) | 密码哈希 |
| display_name | VARCHAR(50) | 显示名 |
| avatar_url | TEXT | 头像 |
| role | SMALLINT | 角色 1=普通 2=会员 3=客服 4=运营 5=管理员 |
| status | SMALLINT | 0=禁用 1=正常 |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### 2. projects（项目/作品）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| user_id | UUID FK→users | 所有者 |
| title | VARCHAR(200) | 标题 |
| description | TEXT | 描述 |
| art_style | VARCHAR(50) | 艺术风格 |
| story_type | VARCHAR(50) | 故事类型 |
| cover_url | TEXT | 封面 |
| status | SMALLINT | 0=草稿 1=生成中 2=完成 3=失败 |
| created_at | TIMESTAMPTZ | |

### 3. subscriptions（订阅）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| user_id | UUID FK→users UNIQUE | |
| plan | VARCHAR(20) | free/pro/team |
| started_at | TIMESTAMPTZ | |
| expires_at | TIMESTAMPTZ | |
| auto_renew | BOOLEAN | |
| created_at | TIMESTAMPTZ | |

### 4. quotas（配额）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| user_id | UUID FK→users UNIQUE | |
| monthly_tokens | INTEGER | 每月 token 配额 |
| used_tokens | INTEGER | 已用 |
| monthly_images | INTEGER | 每月图片配额 |
| used_images | INTEGER | 已用 |
| monthly_videos | INTEGER | 每月视频配额 |
| used_videos | INTEGER | 已用 |
| reset_at | TIMESTAMPTZ | 下次重置时间 |

### 5. api_keys（用户 BYOK 加密存储）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| user_id | UUID FK→users | |
| provider | VARCHAR(50) | minimax/deepseek/zhipu/volcengine |
| key_alias | VARCHAR(50) | 用户起的别名 |
| key_encrypted | BYTEA | AES-256 加密 |
| key_iv | BYTEA | 初始向量 |
| last_used_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

### 6. api_call_logs（API 调用日志 + 成本）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL PK | |
| user_id | UUID FK→users | |
| project_id | UUID FK→projects NULL | |
| provider | VARCHAR(50) | |
| model | VARCHAR(100) | |
| call_type | VARCHAR(20) | text/image/video/embed |
| input_tokens | INTEGER | |
| output_tokens | INTEGER | |
| cost_usd | DECIMAL(10,6) | |
| latency_ms | INTEGER | |
| status | SMALLINT | 0=成功 1=失败 |
| error_msg | TEXT NULL | |
| created_at | TIMESTAMPTZ | |

### 7. role_vectors（角色一致性向量）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| project_id | UUID FK→projects | |
| role_name | VARCHAR(100) | 角色名 |
| embedding | vector(384) | all-MiniLM-L6-v2 向量 |
| reference_image_url | TEXT | 参考图 |
| created_at | TIMESTAMPTZ | |

## 索引

```sql
-- users
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- projects
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- api_call_logs（按时间分表，按月分区）
CREATE INDEX idx_api_logs_user_created ON api_call_logs(user_id, created_at DESC);
CREATE INDEX idx_api_logs_project ON api_call_logs(project_id);
CREATE INDEX idx_api_logs_status ON api_call_logs(status);

-- role_vectors（向量索引）
CREATE INDEX idx_role_vectors_embedding ON role_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- api_keys
CREATE UNIQUE INDEX idx_api_keys_user_provider_alias ON api_keys(user_id, provider, key_alias);
```

## 关系图

```
users 1──┬─1 subscriptions
         ├─1 quotas
         ├─1:N projects
         ├─1:N api_keys
         └─1:N api_call_logs
              │
              └─N:1 projects
projects 1──┬─N role_vectors
            └─N api_call_logs
```

## 扩展点（M2+）

- **teams**（团队）
- **share_links**（分享链接）
- **payments**（支付记录）
- **tickets**（客服工单）
- **audit_logs**（审计日志）
- **models_config**（平台预置模型配置）
- **providers_config**（供应商配置）
