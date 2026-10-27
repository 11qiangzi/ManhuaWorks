# 千机工坊 品牌配置 (派单 13)

> 主名: **千机工坊**
> 域名: `qianjigongfang.com` (主) + `qianjigongfang.cn` (备, 已注册)
> 拍板时间: 2026-06-16
> 拍板人: 梁总
> 落地派单: 13 (谢擎 改域名 + 6 子名配置)
> 关联: 派单 12A 林知行 brainstorm / 派单 12B 谢擎 switch-domain 脚本 / 派单 14 谢擎 DirectMail

---

## 1. 主名

| 项 | 值 |
|----|----|
| 中文 | **千机工坊** |
| 拼音 | `qianji gongfang` |
| 英文 (域名用) | `qianjigongfang` |
| 域名 (主) | `qianjigongfang.com` |
| 域名 (备) | `qianjigongfang.cn` |
| 域名 (子域 - 暂未配) | `api.qianjigongfang.com` / `studio.qianjigongfang.com` |

**含义解释:**
- 千 = 千变万化 / 千锤百炼 / 千行代码
- 机 = 机关 / 机能 / 智能 AI / 灵机一动
- 工坊 = 工匠精神的工作室 (对标 Figma / Canva / Notion 的"Works / Lab" 范式)
- 整体叙事: "千种机关, 一坊打尽" — 6 子功能并行, 一站式 AI 内容工坊

---

## 2. 6 子功能子名 (梁总拍板, Q1A 决议)

| # | 功能 | 子名 | 拼音 (slug) | 英文 (path) | 子域名建议 |
|---|------|------|-------------|-------------|-----------|
| 1 | 漫改 | **千机·漫** | `qianji-manhua` | `manhua` | `manhua.qianjigongfang.com` |
| 2 | 小说 | **千机·书** | `qianji-novel` | `novel` | `novel.qianjigongfang.com` |
| 3 | 音乐 | **千机·曲** | `qianji-music` | `music` | `music.qianjigongfang.com` |
| 4 | 宣传片 | **千机·片** | `qianji-promo` | `promo` | `promo.qianjigongfang.com` |
| 5 | 广告图 | **千机·图** | `qianji-ad` | `ad` | `ad.qianjigongfang.com` |
| 6 | 广告视频 | **千机·影** | `qianji-video` | `video` | `video.qianjigongfang.com` |

**命名逻辑:**
- 共用前缀「千机·」 — 一套记忆点 + 视觉识别强
- 后缀单字, 调性统一 (漫 / 书 / 曲 / 片 / 图 / 影)
- 覆盖梁总业务六艺 — 漫画改编 / 网络小说 / AI 作曲 / 宣传片 / 广告图 / 广告视频
- 子域名 .com 形式简洁, 内部路由走 path 即可 (`qianjigongfang.com/manhua`)

---

## 3. 品牌调性

| 项 | 描述 |
|----|------|
| 调性关键词 | **东方智造 · 一机万象** |
| 风格 | 东方美学 + 科技工具 (区别于纯文艺向的"墨境" / 纯 SaaS 的"一创") |
| 目标用户 | 中小企业主 / 内容创作者 / 跨境电商 / 自媒体团队 |
| 类似参考 | Figma (工具感) + Canva (一站式) + 阿里妈妈 (东方叙事) |
| 视觉方向 | 朱红 + 玄黑 + 烫金 (待设计师出稿, logo 占位见 §5) |
| 品牌口号 | "一站式 AI 内容工坊 — 漫/书/曲/片/图/影 六艺并行" |

---

## 4. 配置落地清单 (派单 13 成果)

### 4.1 后端 env 配置 (`services/user-service/.env`)

```
# 千机工坊 6 子名 (派单 13 - 梁总拍板 qianjigongfang.com + .cn)
SUB_NAME_MANHUA=千机·漫
SUB_NAME_NOVEL=千机·书
SUB_NAME_MUSIC=千机·曲
SUB_NAME_PROMO=千机·片
SUB_NAME_AD=千机·图
SUB_NAME_VIDEO=千机·影

# 千机工坊品牌元数据
BRAND_NAME_CN=千机工坊
BRAND_NAME_PY=qianjigongfang
BRAND_DOMAIN_PRIMARY=qianjigongfang.com
BRAND_DOMAIN_SECONDARY=qianjigongfang.cn
BRAND_FROM_PRIMARY=noreply@qianjigongfang.com
```

`.env.example` 同步, 保持模板一致。

### 4.2 前端 TS 配置 (`apps/web/src/config/branding.ts`)

```ts
import { BRAND, getSubName, getSubSlug, getSubPinyin } from '@/config/branding';

// 主名
BRAND.nameCn           // "千机工坊"
BRAND.namePy           // "qianjigongfang"
BRAND.domainPrimary    // "qianjigongfang.com"
BRAND.domainSecondary  // "qianjigongfang.cn"
BRAND.emailPrimary     // "noreply@qianjigongfang.com"

// 子名
BRAND.subNames.manhua  // "千机·漫"
BRAND.subNames.novel   // "千机·书"
BRAND.subNames.music   // "千机·曲"
BRAND.subNames.promo   // "千机·片"
BRAND.subNames.ad      // "千机·图"
BRAND.subNames.video   // "千机·影"

// helper
getSubName('manhua')   // "千机·漫"
getSubSlug('manhua')   // "manhua" (URL path)
getSubPinyin('manhua') // "qianji-manhua" (变量名)
```

### 4.3 域名切换 (`scripts/switch-domain.ps1`, 派单 12B 脚本)

- 跑 .com: `.\switch-domain.ps1 -Domain "qianjigongfang.com" -FromEmail "noreply@qianjigongfang.com" -Production`
- 跑 .cn:  `.\switch-domain.ps1 -Domain "qianjigongfang.cn"  -FromEmail "noreply@qianjigongfang.cn"  -Production`
- 4 文件 / 8 字段全改, 自动备份到 `scripts/.bak-l2t12b-<时间戳>/`
- DRY-RUN 默认, 加 `-Production` 才真写

### 4.4 nginx server_name (派单 13 实际状态)

当前文件: `infrastructure/nginx/conf.d/manhuaworks.conf`
```
server_name qianjigongfang.cn *.qianjigongfang.cn;
```
> **注意:** 派单 13 跑了 2 次 (先 .com 后 .cn), 最后一次覆盖, 当前态为 .cn。
> .com 状态独立备份在 `scripts/.bak-l2t12b-20260616-200953/`。
> 梁总决定主域名后, 从对应备份回滚或重新跑。

---

## 5. Logo 占位 (待设计)

| 形态 | 当前占位 | 设计师待办 |
|------|---------|-----------|
| 文字 logo | `千` (单字) / `千机工坊` (全称) | 梁总拍设计方向后, 派陆流光 (漫改部美术) 出 3 套方案 |
| 图标 logo | (空, 暂用文字) | 同上 |
| favicon | (空) | 派林染 (前端) 部署时塞 `apps/web/public/favicon.ico` |
| 邮件签名 | `— 千机工坊 / noreply@qianjigongfang.com` | 派单 14 已用, 待加 HTML 签名档 |

---

## 6. 风险与未决事项

| # | 事项 | 风险 | 处置 |
|---|------|------|------|
| 1 | nginx server_name 单值, .com 与 .cn 不能同时主域 | 中等 — 用户访问 .com 时 nginx 不识别 | 派单 15 Cloudflare 落地时, 把 .com 也加进 server_name (两个域名都接受) |
| 2 | `user-service/.env: EMAIL_FROM=.cn` 但 `SMTP_USER=.com` (脚本覆盖后不一致) | 低 — 阿里云 DirectMail 一个域名一个发件箱, 应当统一 | 派单 15 或梁总决定后, 选 .com 作主, 全部改成 .com |
| 3 | 备份目录是 `.bak-l2t12b-*` 不是派单 13 要求的 `.bak-l2t13-*` | 极低 — 只是命名, 内容正确 | 派单 15 顺手加 rename 脚本, 或派单 17+ 评估 |
| 4 | 商标查重 (35/42/9 类) 未做 | 中等 — 「千机」「千机工坊」是否被占未知 | 派严谨走商标查询 (派单 16 候选) |
| 5 | `apps/*/index.html` 里 `<title>` 仍是 `ManhuaWorks` | 低 — Q3B 不动 | 派单 17+ 由林染同步改 |
| 6 | `monitor/.env` 的 `SMTP_PASSWORD=<fill from DirectMail console>` 占位符 | 高 — 没真密码, 监控告警邮件发不出 | 梁总去阿里云 DirectMail 控制台填值 |

---

## 7. 同步清单 (派单 13 触发的下游任务)

- [ ] **派单 15 (程构+谢擎)** — Cloudflare 落地: DNS 解析 + HTTPS 证书 + 把 .com 也加进 nginx server_name
- [ ] **派单 16 (严谨)** — 商标查询 (35 类广告 / 42 类软件 / 9 类 APP)
- [ ] **派单 17 (林染)** — 改 `apps/*/index.html` 的 `<title>` / `<meta og:site_name>` / favicon
- [ ] **派单 18 (陆流光)** — logo 设计 (3 套方案, 朱红/玄黑/烫金 主调)
- [ ] **派单 19 (梁总)** — 阿里云 DirectMail 控制台: 创建 `noreply@qianjigongfang.com` 发件箱, 把密码填进 `monitor/.env`

---

## 8. 历史回溯

| 日期 | 派单 | 成果 |
|------|------|------|
| 2026-06-16 17:36 | 派单 12A 林知行 | 5 套主名 brainstorm, 推荐「墨境」/ 备选「MuseWorks」 |
| 2026-06-16 11:25 | 派单 12B 谢擎 | 写 switch-domain.ps1 脚本 (4 文件 8 字段), DRY-RUN 通过 |
| 2026-06-16 20:05 | 派单 14 谢擎 | user-service 接阿里云 DirectMail, .env 写 `EMAIL_FROM=noreply@qianjigongfang.com` |
| **2026-06-16 20:13** | **派单 13 谢擎** | **域名切换到千机工坊 (.com + .cn), 6 子名配置就绪, 品牌文档出炉** |
| 待派 | 派单 15+ | Cloudflare / 商标 / logo / index.html 等下游 |

---

_本文档随每次品牌配置变更同步更新, 修改者请在 §7 加一行 TODO。_