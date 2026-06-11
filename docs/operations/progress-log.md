# ManhuaWorks 进度表（飞书 OAuth 失效期间本地权威版）

> 飞书 bitable 同步状态：OAuth 过期（need_user_authorization），等大哥重新授权后批量同步
> 同步脚本：sync-feishu-bitable.py（待 OAuth 恢复后跑）

## M1: W1-W4 漫改工坊 v1 全部完成

| 周次 | 任务 | 员工 | 文件数 | 验证 | 状态 |
|------|------|------|--------|------|------|
| W1 | 基础架构 | 全组 | 50+ | pnpm build 0 错 | ✅ |
| W2 | 漫改核心 6 模块 | 6 员工 | 60+ | tsc 0 错 | ✅ |
| W3 | 服务细化 + 文档 | 6 员工 | 117 | tsc 0 错 | ✅ |
| W4 | 用户后台 + 协作 + 联调 + 评审 | 6 员工 | 122 | tsc 0 错 + vitest 117/123 | ✅ |

## W3 详细（6/8 04:30）

| 任务 | 员工 | 文件 | tsc | 备注 |
|------|------|------|-----|------|
| asset-service | 钟帧 | 19 | ✅ 0 错 | 端口 8085，HTTP 200 |
| studio-refine | 林染 | 25 | ✅ | vite build 1.84s |
| workflow-refine | 莫言画 | 29 | ✅ | 5 .refined + run-storyboard |
| docs | 陈远枢 | 13 | ✅ | 接力 3 文件 |
| orchestrator | 程构 | 21 | ✅ 0 错 | 主会话修 5 处类型错 |
| ai-helper | 陆流光 | 17 | ✅ 0 错 | |

W3 接力抢救统计：5/6 主任务子 agent 失联 → 4 接力补完 + 1 主会话接力修类型错 + 1 主任务没失联

## W4 详细（6/8 08:08）

| 任务 | 员工 | 文件 | 验证 | 端口 |
|------|------|------|------|------|
| user-portal | 林染 | 33 | ✅ | 5180 |
| collab-service | 谢擎 | 25 | tsc 0 错 | 8088 |
| review-materials | 赵千影 | 10 | ✅ | - |
| docs-integration-tests | 陆流光 | 16 | vitest 117/123 | - |
| beta-execution | 陈远枢 | 10 | ✅ | - |
| e2e-integration | 程构 | 13 | tsc 0 错 | - |

W4 教训兑现：2 批 3 并行 → 失联率 0%（W3 是 80%+）

## 总览

- 服务总数：10（ai-router/ai-keys/workflow-engine/asset-service/ai-helper/ai-orchestrator/collab-service/api-gateway/billing-service/project-service/user-service）
- 前端：web/admin-portal/studio/user-portal/dev-portal/ops-portal/demo/installer
- 数据库：8 表（init migration + 后续迁移）
- 文档：50+（架构/API/集成/运营/计划/评审）

## 待办（飞书 OAuth 恢复后批量同步）

- 51 条 bitable 记录状态更新（W3 6 条 + W4 6 条）
- 大哥重新授权（飞书 bitable 读权限）
