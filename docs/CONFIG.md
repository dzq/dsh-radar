# DSH Radar 配置指南

## 1. 第三方服务集成（可选）

DSH Radar 默认**完全零追踪**（不打点、不发请求）。如需启用以下服务，按需配置 `web/.env`：

### Formspree（联系表单后端）

**作用**：把 `/subscribe` 和 `/team` 的表单提交转发到你的邮箱

**步骤**：
1. 注册 [formspree.io](https://formspree.io/)（免费 50 submissions/月）
2. 创建两个 form（一个订阅、一个团队咨询）
3. 把两个 form ID 都填到 `PUBLIC_FORMSPREE_ID`（用同一个 ID 即可，因为两个表单发到同一邮箱）

```bash
# web/.env
PUBLIC_FORMSPREE_ID=xkgjabcd
```

**留空行为**：表单 `action` 回退到 `mailto:` 链接，浏览器打开用户邮件客户端

### Plausible Analytics（访问统计）

**作用**：统计页面访问量（GDPR 合规、零 cookie、轻量 < 1KB script）

**步骤**：
1. 注册 [plausible.io](https://plausible.io/)（30 天试用，或 self-host `plausible/analytics`）
2. 添加站点，填你的域名（如 `dsh.pub`）
3. 把域名填到 `PUBLIC_PLAUSIBLE_DOMAIN`（不要带 `https://`）

```bash
# web/.env
PUBLIC_PLAUSIBLE_DOMAIN=dsh.pub
```

**留空行为**：完全不上报，符合 DSH Radar 的"不卖数据、不接广告"承诺

### 自托管 Plausible（完全免费）

如果你不想付费，可以用 Docker 自托管：

```bash
# 1. 克隆 plausible
git clone https://github.com/plausible/analytics
cd analytics

# 2. 启动（需要 PostgreSQL + ClickHouse）
docker compose up -d

# 3. 改 web/.env
PUBLIC_PLAUSIBLE_DOMAIN=stats.your-domain.com
# 部署站点时，script 改用 https://stats.your-domain.com/js/script.js
```

## 2. 部署选项

### GitHub Pages

```bash
# 1. 在 GitHub repo settings → Pages → Source: GitHub Actions
# 2. 把 .github/workflows/deploy.yml 提交
# 3. 每次 push main 自动部署
```

### Cloudflare Pages

```bash
# 1. 连接 GitHub repo
# 2. Build command: cd web && npm run build
# 3. Output dir: web/dist
# 4. Environment variables: 填 PUBLIC_FORMSPREE_ID / PUBLIC_PLAUSIBLE_DOMAIN
# 5. Custom domain: dsh.pub
```

### Vercel

```bash
# 一键部署
vercel deploy --prod

# 环境变量在 vercel.com dashboard 设置
```

### 自建 Nginx

```bash
# 本地 build
cd web && npm run build

# 复制 dist/ 到服务器
rsync -avz dist/ user@server:/var/www/dsh.pub/

# Nginx 配置
server {
  listen 443 ssl http2;
  server_name dsh.pub;
  root /var/www/dsh.pub;
  index index.html;
  
  # SPA fallback（虽然我们不是 SPA，但兜底）
  try_files $uri $uri/ /index.html;
}
```

## 3. 域名推荐

| 域名 | 后缀 | 优势 | 年费 |
|---|---|---|---|
| **dsh.pub** | .pub | 短、含义贴合（publish/公共） | ¥80-150 |
| dsh.run | .run | 行动感、便宜 | ¥80-150 |
| dshkit.com | .com | 工具箱含义 | ¥60-100 |
| dshchef.com | .com | "DSH 大厨" 调性、IP 化 | ¥60-100 |

**推荐**：`dsh.pub`（最契合"发布/数据/公共"的定位）

## 4. 监控与告警

部署后可加：

- **Uptime**: [UptimeRobot](https://uptimerobot.com/) 免费 50 monitor
- **错误追踪**: [Sentry](https://sentry.io/) 免费 5K events/月
- **访问统计**: Plausible（如上）

## 5. 数据更新频率

- **默认**：手动 `node scripts/build-data.mjs`
- **推荐**：每周一自动跑（GitHub Actions 已配置）
- **企业**：每小时（Team 版）

修改 cron 在 `.github/workflows/update-data.yml`：
```yaml
on:
  schedule:
    - cron: '0 2 * * 1'   # 每周一 UTC 02:00（北京时间 10:00）
```
