# 一键本机工作台（无需 Docker / WSL）

当前这台电脑可以直接使用已提供的「启动邮件工作台.cmd」和「停止邮件工作台.cmd」。首次启动会准备网页，之后在浏览器打开 http://localhost:5230/app/manager 。

源码中的通用入口是 scripts/local/start.cmd，需要已有 Node.js 和 Bun。当前电脑的专用入口自动使用 Codex 配套的 Node 和本次已准备的 Bun，无需全局安装。依赖和本机私有 .env 已准备好。

本机模式通过 DATABASE_DRIVER=local 启用 PGlite，数据持久化到 local-data/mail-db；它与 Docker/PostgreSQL 数据库分别存储，不会自动迁移之前的数据库。原有多 Gmail、分类、摘要、动作和草稿逻辑保持不变。

进入页面点击「连接 Gmail / 首次设置」，在网页中填写 Google OAuth 客户端并连接账号；不再需要手动修改 Google 配置文件。AI 提供商凭据仍在应用设置中填写。尚未授权账号时，不会显示真实邮件。

服务仅监听本机 127.0.0.1，不自动随 Windows 启动。关闭浏览器不等于停止后台；使用停止入口可释放后台资源。首次运行与最终页面渲染尚未在自动执行环境中验证：当前会话的权限策略阻止了启动及其网页构建。核心、API 与本机网页服务的类型检查已通过。

备份时保留 .env 和 local-data。不要将这些私有文件上传到仓库。生成的日志位于 local-data，可用于排查启动问题。

---

以下为可选 Docker 部署，当前这台电脑不需要继续安装 WSL 或 Docker。

# 本地部署 AI Mail Manager

推荐 Windows 用户通过 Docker Desktop 启动完整服务。需要 Git、Docker Compose，以及自己的 Google OAuth 客户端和一个 AI 提供商凭据。没有凭据也可以启动服务，但无法连接真实 Gmail 或运行 AI 分析。

## 1. 获取与配置

```powershell
git clone https://github.com/yujunhong2006-sketch/ai-mail-manager.git
cd ai-mail-manager
Copy-Item .env.example .env
```

编辑 `.env`：

- `API_SECRET` 与 `VITE_API_SECRET`：设置为同一个随机长字符串。
- `TOKEN_ENCRYPTION_KEY`：32 字节随机密钥的 Base64 编码；用于保护 Google 和 AI 凭据。请备份，后续不要随意更换。
- `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`：自己的 Google Cloud OAuth 客户端。
- `GOOGLE_REDIRECT_URI=http://localhost:5531/auth/google/callback`
- `WEB_ORIGIN=http://localhost:5230`
- 保持 `VITE_API_BASE=/api` 和 `ALLOW_EMAIL_SEND=false`。

可以用 PowerShell 7 生成随机值，在本机终端读取后填入 `.env`，不要提交到仓库：

```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

分别生成 API 密钥和加密密钥；API 与 VITE 两项使用同一个值。

Google Cloud 中启用 Gmail API，配置 OAuth 同意屏幕并把每个要连接的 Gmail 地址加入测试用户。创建 Web application 类型 OAuth 客户端，登记上面的回调地址。详细步骤见 README 的 Creating the Google OAuth client。Google 凭据不能由仓库自动生成。

## 2. 启动完整服务

```powershell
docker compose up -d --build
docker compose logs --tail=80 api
```

打开 http://localhost:5230/app/manager 。API 启动时自动执行全部数据库迁移，包括 `0013_mail_manager.sql`，无需手工执行 SQL。数据库保存在命名卷 `miel-pgdata`。

默认端口只绑定到本机回环地址。本项目沿用上游单用户认证设计，前端包含 API bearer secret；不要把前端和 API 直接暴露到公共网络。远程访问需要额外的身份验证网关，详见上游 DEPLOY.md。

## 3. 连接 Gmail 与 AI

1. 在应用内使用 **Connect with Google** 连接第一个 Gmail，重复操作添加其他账号。
2. 在 **Settings → AI & Triage → Credentials** 输入所选提供商的凭据；AI 密钥不放在 `.env`。
3. 为 triage、reply 等任务选定对应提供商和模型。上游默认 Claude Code；若使用托管 API，在设置中切换到对应提供商。不同任务需要分别设置。
4. 在原邮箱页面运行同步，然后回到侧边栏 **AI Mail Manager**。新分析自动出现在统一看板。
5. 老版本已有的邮件在 **Pending**，展开邮件并点击 **Analyze**。分类后可以 **Refresh analysis**。

AI 会收到邮件发件人、主题、snippet、接收日期和标签。回复草稿会发送原邮件正文（最多 8,000 字符）给所选 AI 提供商。摘要可能因 snippet 不完整而缺少信息；重要事项应核对原邮件。

## 4. 使用说明

- **Important**：动作按已知 deadline 排序；勾选完成，展开邮件可重新打开动作。
- **Normal**：将每封邮件 AI 摘要按主题放在一起，可查看来源账号。
- **Junk / Quarantine**：仅在本应用中隔离，不改变 Gmail 原件，没有定时销毁。展开后用 **Move to** 恢复；人工分类覆盖在下一次 AI 分析后保留。
- **Generate reply draft**：保存到本应用数据库；刷新页面仍可见。点击 Copy draft 后可到 Gmail 编辑并发送。该草稿不写入 Gmail Drafts。
- 后端默认拒绝发送。原详情页保留上游手动 Send 按钮，但默认会失败；使用新看板的草稿功能。只有操作者显式设置 `ALLOW_EMAIL_SEND=true` 并重启服务才恢复上游手动发送能力，仍不存在自动发送流程。
- 看板选择所有账号或某一个账号，展示最近 500 封未移除、未进垃圾箱的已同步邮件；计数、Action List 和摘要均仅覆盖当前选择。更多邮件请按账号筛选或使用原邮箱页面。

## 5. 更新、停止与备份

```powershell
git pull
docker compose up -d --build
docker compose stop
```

不要使用 `docker compose down -v`，除非确实要清除本地数据库。备份数据库卷和 `.env` 的加密密钥。更新前建议先备份；原始 Gmail 邮件不会因本地隔离或完成动作而变化。

## 开发模式

需要 Bun 1.3.4+ 和 PostgreSQL 16（可由开发 Compose 启动）：

```powershell
bun install --frozen-lockfile
docker compose -f docker-compose.dev.yml up -d
```

Windows 可使用两个终端直接运行，避免上游开发脚本依赖 Bash/tee：

```powershell
# 终端一，在仓库根目录
bun --env-file=.env packages/api/src/index.ts
```

```powershell
# 终端二
cd packages/web
bun node_modules/vite/bin/vite.js
```

打开 http://localhost:5230/app/manager 。Linux/macOS 也可按照上游 README 使用 `bun dev`。

验证：

```powershell
bun run typecheck
cd packages/web
bun node_modules/vite/bin/vite.js build
bun test src/pages/MailManagerPage.test.tsx
cd ../core
bun test src/services/mailAnalysis.test.ts src/db/migrationSnapshots.test.ts src/claude/prompts.test.ts
```

完整上游测试需要 PostgreSQL 和 Bash，入口为 `bun run test`。真实 Gmail 同步和真实 AI 调用还需要完成上述凭据配置。
