# GitHub 上传报告 — 派单 64.1

**执行人:** 谢擎 (后端开发)  
**时间:** 2026-06-12 00:00 (实际 2026-06-11 22:30)  
**状态:** ⚠️ 部分完成 — 阻塞于仓库创建

---

## 1. ✅ 已完成项

| 步骤 | 状态 | 详情 |
|------|------|------|
| SSH 私钥配置 | ✅ | `~/.ssh/id_ed25519` 已配置，权限正确 |
| SSH config | ✅ | `~/.ssh/config` 配置 `github.com` → IdentityFile |
| SSH 连通测试 | ✅ | `Hi 11qiangzi! You've successfully authenticated` |
| Git 全局配置 | ✅ | `user.name=330247468`, `user.email=330247468@qq.com` |
| .gitignore | ✅ | 已排除 `.env`, `node_modules/`, `dist/`, `.vite/`, `*.log`, `.run/`, `*.pid`, `*.err`, `*.out` 等 |
| Git 仓库初始化 | ✅ | `D:\ManhuaWorks\.git` 已初始化 |
| 源码提交 | ✅ | Commit `dc5a0cd` — 1863 files, 326,716 insertions |
| Remote 配置 | ✅ | `origin = git@github.com:330247468/ManhuaWorks.git` |

---

## 2. 🚫 阻塞项: GitHub 仓库不存在

### 根因
- GitHub Web/API (`github.com:443`) 被 GFW 封锁，本机浏览器无法访问
- SSH (`github.com:22`) 可通，但 GitHub SSH 仅支持 Git 操作，不支持仓库创建
- 无可用 Personal Access Token (PAT)
- 网关主机可访问 GitHub API，但 `gh auth login` 需要浏览器完成 OAuth 设备授权

### 已尝试的解决方案
1. ✗ `git push` → "Repository not found"（仓库需预先存在）
2. ✗ SSH 隧道 `ssh -L/-D` → GitHub SSH 不支持 TCP 转发
3. ✗ `gh auth login` (本机) → 无法连接 `github.com:443`
4. ✗ `gh auth login` (网关) → 设备码 `A9AA-F9D5` 已获取，需人工在浏览器完成授权
5. ✗ 本地 `.env` / 环境变量 → 无 GitHub Token

---

## 3. 🔑 建议解决方案

### 方案 A: 人工创建仓库（推荐，最快）
大哥在手机上/代理环境：
1. 访问 https://github.com/new
2. Repository name: `ManhuaWorks`
3. 设为 **Public**（或 Private）
4. 不要勾选 "Add a README file"
5. 点击 "Create repository"

创建后告诉我，我立即执行 `git push -u origin master`

### 方案 B: 完成设备授权
在可访问 GitHub 的设备上：
1. 打开 https://github.com/login/device
2. 输入设备码: **`A9AA-F9D5`**
3. 登录 GitHub 账号并授权

授权后 `gh` CLI 会自动获取 token，然后用 `gh repo create` 创建仓库

### 方案 C: 提供 PAT
大哥提供一个 GitHub Personal Access Token (classic)，scope 需含 `repo`，我通过网关 API 创建仓库。

---

## 4. 🔒 待执行: 私钥轮转

**当前私钥已贴公开会话，上传后立刻 rotate:**

```powershell
# 步骤 1: 生成新密钥（覆盖旧密钥）
ssh-keygen -t ed25519 -f C:\Users\Administrator\.ssh\id_ed25519 -N ""

# 步骤 2: 输出新公钥
type C:\Users\Administrator\.ssh\id_ed25519.pub

# 步骤 3: 大哥登录 GitHub → Settings → SSH and GPG keys
#   - 删除旧 key (330247468@qq.com)
#   - 添加新 key（粘贴上面的公钥）
```

---

## 5. 📊 当前 Git 状态

```
Remote:  git@github.com:330247468/ManhuaWorks.git (origin)
Branch:  master
Commit:  dc5a0cd "init: ManhuaWorks 源码 2026-06-12"
Files:   1863 files
Size:    326,716 insertions
```

```powershell
# 仓库就绪后一键推送:
cd D:\ManhuaWorks
git push -u origin master
```

---

## 6. ⚠️ 安全备注

- ✅ `.env` 文件（含密钥的服务配置）未被提交
- ✅ `node_modules/` 未被提交
- ✅ PID/运行时文件未被提交
- ⚠️ `.env.development` 文件已提交（通常不含生产密钥，但需确认）
- ⚠️ `tests/.tok.txt` 已提交（测试 token，需确认是否敏感）
