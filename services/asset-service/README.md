# @manhuaworks/asset-service

ManhuaWorks 资产服务（asset-service）。

> W3 任务 1 — 项目空间 + 资产管理。
> 把 W2 已交付的 workflow-engine 产生的 Toonflow 资产（12 故事类型 + 11 艺术风格 + 4 prompt 库）落地为可被 API 调用的资产库。

## 职责

1. **项目空间（Projects）** — 作品/项目的 CRUD、详情、协作成员、版本锁定
2. **资产管理（Assets）** — 故事类型 / 艺术风格 / 上传 / 锁脸 / 版本 / 导出 / 货架
3. **Toonflow 资产落地** — 内置 12 套故事类型 + 11 套艺术风格 + 4 套 prompt 模板的静态资产
4. **多级货架** — 用户级 / 项目级 / 全局级 3 级资产分类

## 端口

`8085`

## 路由一览

```
GET  /health

# 项目空间
GET    /v1/projects                       列表（分页）
POST   /v1/projects                       创建
GET    /v1/projects/:id                   详情
PATCH  /v1/projects/:id                   更新
DELETE /v1/projects/:id                   删除

# 协作成员
GET    /v1/projects/:id/members           协作成员列表
POST   /v1/projects/:id/members           邀请协作成员
PATCH  /v1/projects/:id/members/:userId   更新成员权限
DELETE /v1/projects/:id/members/:userId   移除成员
POST   /v1/projects/:id/lock              锁定项目（版本锁定）
POST   /v1/projects/:id/unlock            解锁

# 资产元信息
GET    /v1/assets/story-types             12 套故事类型
GET    /v1/assets/art-styles              11 套艺术风格
GET    /v1/assets/prompts                 4 套 prompt 库

# 故事类型 CRUD（平台级 / 管理员）
GET    /v1/assets/story-types/:id
POST   /v1/assets/story-types
PATCH  /v1/assets/story-types/:id
DELETE /v1/assets/story-types/:id

# 艺术风格 CRUD
GET    /v1/assets/art-styles/:id
POST   /v1/assets/art-styles
PATCH  /v1/assets/art-styles/:id
DELETE /v1/assets/art-styles/:id

# 资产上传（S3 兼容）
POST   /v1/assets/upload                  上传图片/视频/音频
GET    /v1/assets/:id                     资产详情
DELETE /v1/assets/:id                     删除资产

# 角色锁脸
POST   /v1/assets/lock-face               锁定角色（4 角度头像）
GET    /v1/assets/lock-face/:characterId  获取锁定档案
PATCH  /v1/assets/lock-face/:characterId  更新角度

# 版本管理
POST   /v1/assets/:id/versions            创建快照
GET    /v1/assets/:id/versions           版本列表
GET    /v1/assets/:id/versions/:vNo      某版本详情
POST   /v1/assets/:id/versions/:vNo/diff 与当前版本 diff

# 导出
POST   /v1/assets/export/episode          单集 zip
POST   /v1/assets/export/season           整季 zip
POST   /v1/assets/export/srt              字幕 srt

# 货架
GET    /v1/shelf                          我的货架（用户级）
GET    /v1/shelf/project/:projectId      项目级货架
GET    /v1/shelf/global                   全局货架
```

## 架构

- **运行时**：Node 20 + Hono + @hono/node-server
- **数据库**：PostgreSQL（postgres-js 驱动）+ Drizzle ORM
- **存储**：S3 兼容对象存储（默认本地落盘，可切换 S3/MinIO）
- **鉴权**：API Key / JWT / None（与 workflow-engine 一致）
- **导出**：archiver 打包 zip，srt 字幕直接流式返回

## 启动

```bash
# 1. 安装依赖（workspace 根目录）
pnpm install

# 2. 执行数据库迁移
psql $DATABASE_URL -f services/asset-service/src/db/migrations/0003_projects.sql

# 3. 开发模式
pnpm --filter @manhuaworks/asset-service dev

# 4. 生产构建
pnpm --filter @manhuaworks/asset-service build
pnpm --filter @manhuaworks/asset-service start
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ASSET_PORT` / `PORT` | 8085 | HTTP 端口 |
| `DATABASE_URL` | postgresql://mhw:mhw_dev_only@localhost:5432/manhuaworks | Postgres 连接 |
| `AUTH_MODE` | api-key | api-key / jwt / none |
| `AUTH_API_KEY` | dev-asset-service-key | API Key 模式密钥 |
| `AUTH_JWT_SECRET` | dev-jwt-secret-change-me | JWT 模式密钥 |
| `S3_ENDPOINT` | - | S3 兼容存储端点（MinIO/阿里云/腾讯云） |
| `S3_BUCKET` | manhuaworks-assets | 存储桶 |
| `S3_ACCESS_KEY` | - | 访问密钥 |
| `S3_SECRET_KEY` | - | 私有密钥 |
| `S3_REGION` | us-east-1 | 区域 |
| `LOCAL_STORAGE_DIR` | /tmp/mhw-assets | 本地落盘目录（S3 不可用时） |
| `MAX_UPLOAD_MB` | 200 | 单文件最大 MB |
