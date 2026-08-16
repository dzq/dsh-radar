# DSH Radar 🛰️📡

> The plugin quality radar & compatibility matrix for **DeepSeek Harness (DSH)**.

[![Update Data](https://img.shields.io/badge/data-updated%20weekly-blue)](#)
[![License](https://img.shields.io/badge/license-MIT-green)](#)
[![Site](https://img.shields.io/badge/site-dsh.pub-orange)](https://dsh.pub)
[![Stars](https://img.shields.io/github/stars/dsh-radar/dsh-radar?style=social)](#)

**DSH Radar** 是 DSH 生态的"豆瓣 + NPM Trends"——给每个 DSH 插件打 S/A/B/C 雷达评分、维护 **DSH 版本兼容矩阵**、收集**实战配方（recipes）**、聚合**踩坑 Wiki**。

我们只做一件事：**持续客观评测**——让选插件不再靠玄学。

## 🎯 解决的真问题

| 痛点 | 别人没做的原因 | DSH Radar 怎么解决 |
|---|---|---|
| 装了 50 个插件不知道哪个好用 | 评分机制无人维护 | 多维雷达图 + S/A/B/C 等级 |
| 升级 DSH 后插件全炸 | 兼容性没人测 | 自动维护**版本兼容矩阵** |
| 装完不知道插件怎么搭配 | Recipes 没人整理 | 社区配方库（任务→插件组合） |
| 选 DSH 还是 BitFun / Claude Code | 客观横评少 | 横向对比页（数据驱动） |
| 踩坑只散落在 V2EX / linux.do | 没结构化 | 踩坑 Wiki 聚合 |

## 📊 评分维度（雷达图 5 维）

| 维度 | 权重 | 信号来源 |
|---|---|---|
| **Popularity** | 25% | npm 周下载量（log scale 归一化） |
| **Maintenance** | 20% | npm 最后发布 + GitHub 最近 push（指数衰减） |
| **Quality** | 20% | README 字数、keywords、license、示例代码 |
| **Security** | 15% | trustedPublisher、OIDC 配置、危险关键词审计 |
| **DSH Compat** | 20% | `dsh.*` 字段、`engines.dsh`、peerDependencies |

等级：**S**（≥85）、**A**（≥70）、**B**（≥55）、**C**（≥40）、**D**（<40）

## 🏗️ 架构

```
dsh-radar/
├── scripts/                    # 纯 Node.js 抓取脚本（零 npm 依赖）
│   ├── build-data.mjs          # 主入口：npm search → metadata → score
│   ├── build-authors.mjs       # 聚合 npm 作者 → 作者页数据
│   ├── build-changelog.mjs     # 对比历史快照 → 变化记录
│   ├── build-search-index.mjs  # 轻量搜索索引（711 → 260KB JSON）
│   └── lib/
│       ├── score.mjs           # 5 维评分算法（完全开源可改）
│       └── format.mjs          # fetchJson / sleep / slugify
├── data/                       # 抓取结果（git-tracked，自动 weekly 更新）
│   ├── plugins/*.json          # 每个插件一份详细 JSON
│   ├── authors.json            # 285 位聚合作者
│   ├── history/*.json          # 历史快照（用于 changelog diff）
│   ├── changelog.json          # 评分变化记录
│   ├── search-index.json       # 客户端搜索索引
│   ├── recipes.json            # 社区配方
│   ├── potholes.json           # 踩坑记录
│   └── compare.json            # 4 个 harness 横评数据
├── web/                        # Astro 5 静态站（dsh.pub）
│   ├── src/
│   │   ├── pages/              # 25+ 页面（插件/作者/配方/踩坑/趋势/教程/FAQ/周报…）
│   │   ├── components/         # RadarChart（纯 SVG 雷达图）
│   │   ├── layouts/            # Layout（含 SEO / i18n / 主题切换）
│   │   └── styles/             # global.css（暗/亮双主题，CSS 变量）
│   └── public/                 # sitemap.xml / robots.txt / manifest.json
└── .github/workflows/
    └── update-data.yml         # 每周一 UTC 02:00 自动抓取 + 构建 + 部署
```

## 🚀 快速开始

### 抓取数据（零依赖）

```bash
node scripts/build-data.mjs        # 全量抓取（Node.js ≥ 18，内置 fetch）
node scripts/build-authors.mjs     # 聚合作者
node scripts/build-search-index.mjs # 搜索索引
node scripts/build-changelog.mjs   # 历史变化
```

### 启动静态站

```bash
cd web
npm install --cache /tmp/npm-cache
npm run dev          # localhost:4321
npm run build        # 产出 dist/（1091 页，~1.5s）
```

### 主题切换

内置暗色（默认）/ 亮色主题切换按钮（🌙 / ☀️），支持 `localStorage` 持久化 + 系统偏好自动跟随。

## 🤝 贡献

- **提交配方**：编辑 `data/recipes.json`，附 `recipe:` 前缀的 PR 标题
- **报告踩坑**：编辑 `data/potholes.json`，PR
- **修正评分**：改 `scripts/lib/score.mjs`，跑完重算后 PR
- **贡献教程**：在 `web/src/pages/tutorials/` 写 `.astro` 页面

## 📋 页面导航

| 页面 | 说明 |
|---|---|
| `/plugins` | 全部插件列表（784 个，支持搜索/筛选/排序） |
| `/plugins/[slug]` | 单插件详情 + 雷达图 + 兼容矩阵 |
| `/authors` | 作者排名（按插件数 / Stars / 平均评分） |
| `/authors/[handle]` | 单作者主页（含所有插件 + 等级分布） |
| `/recipes` | 社区配方库（任务 → 插件组合） |
| `/compare` | 4 个 Harness 横向对比 |
| `/potholes` | 踩坑 Wiki |
| `/trends` | 趋势图（基于历史快照的评分/下载量变化） |
| `/methodology` | 评分公式完整文档（5 维权重可定制） |
| `/faq` | 24 个常见问题 |
| `/tutorials` | 5 篇实战教程 |
| `/reports` | 周报索引 |
| `/subscribe` | 邮件订阅（RSS + Web3Forms 表单） |
| `/team` | 团队版介绍 |

## 📡 部署

支持 **GitHub Pages** / **Cloudflare Pages** / **Vercel** / **Nginx**，详见 [docs/CONFIG.md](docs/CONFIG.md)。

GitHub Actions 已配置好：push 后自动构建，schedule cron 每周一自动更新数据并部署。

## 📜 License

MIT
