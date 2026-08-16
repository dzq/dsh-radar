# cocoloop 发布稿

## 元数据
- **分类**: 项目分享 / 工具
- **标签**: `agent`、`dsh`、`harness`、`开源`、`评测`

## 标题

**DSH Radar — 给 DSH 生态做了一套"豆瓣 + NPM Trends"的雷达评分系统（711 插件，5 维雷达 + 兼容矩阵）**

---

## 正文

## 项目背景

我最近一直在用 DeepSeek Harness（DSH）做 agent 开发。一个绕不开的问题：**装什么插件？**

- npm `dsh-plugin` 标签下 **711 个包**
- GitHub 上 **6 个独立的插件市场项目** + **5 份 awesome 列表**
- 每个市场都声称"最全"
- 但**没有统一的评分**、**没有版本兼容表**、**没有配方库**

我做的是：**不解决"装什么"，解决"哪个好"**。

## DSH Radar

一个静态站，每周自动从 npm + GitHub 拉数据，给每个 DSH 插件打 5 维雷达评分。

### 评分维度

| 维度 | 权重 | 数据源 |
|---|---|---|
| Popularity | 25% | npm weekly downloads（log scale 归一化） |
| Maintenance | 20% | npm last publish + GitHub last push |
| Quality | 20% | README / keywords / license / examples |
| Security | 15% | trustedPublisher / 关键词审计 |
| DSH Compat | 20% | `dsh.*` 字段 / `engines.dsh` / `peerDependencies` |

**等级阈值**: S (≥85) / A (≥70) / B (≥55) / C (≥40) / D (<40)

### 实测数据（一次全量跑 22 分钟）

```
✅ 711 plugins scored · DSH 标准兼容 649 / 711 (91%)
├─ S: 1   @liustack/modsearch      (周下载 4,097 · ★105 · overall 85)
├─ A: 3   @liustack/pptfast / design-playbook / plaindeck
├─ B: 147
├─ C: 549
└─ D: 11   (高危，建议白名单禁用)
Total weekly downloads: 8,692
Build time: 22 min 47 s (one-shot)
```

唯一 S 级 `@liustack/modsearch` 5 维细分：

| 维度 | 得分 |
|---|---|
| Popularity | 88 |
| Maintenance | 92 |
| Quality | 87 |
| Security | 85 |
| DSH Compat | 90 |

其它 710 个都是陪跑。

## 配套基础设施

光评分不够，关键是配套：

### 1. 版本兼容矩阵（每个插件详情页）

4 行兼容表，覆盖 0.1.0-rc.6 / 0.1.0 / 0.2.0 / 0.3.0+ 四个 DSH 版本分支，升级前先看。

### 2. 实战配方（recipes）

"我用 DSH 做 XX 任务" 的真实配方：

- **PPT 一句话生成** → `@liustack/pptfast`（DrawingML 原生输出，可二次编辑）
- **自动研究循环** → `@liustack/modsearch` + `dsh-llm-auto-route`（按任务复杂度切模型）
- **代码审查 + 雷达打分** → `dsh-plugin-review`（雷达图输出可读性高）

欢迎 PR 新配方。

### 3. 踩坑 Wiki（potholes）

聚合 GitHub Discussions / V2EX / linux.do 的踩坑贴，结构化呈现：症状 / 原因 / 修复 / 原文链接。

### 4. 横评对比

DSH vs BitFun vs Claude Code vs Cursor 的 6 维雷达对比页。

### 5. 订阅（去中心化、零追踪）

- RSS 2.0: `/feeds/rss.xml`
- Atom: `/feeds/atom.xml`
- JSON Feed: `/feeds/feed.json`
- Email: Web3Forms（自托管友好，不是 Formspree）
- Webhook: n8n / Zapier / 自建 bot

### 6. 插件组合实验场（playground · 即将上线）

拖拽组合多个插件 + 实时兼容性预测，避免装完才发现冲突。

### 7. 周报页（changelog · 即将上线）

每周自动汇总本周插件变动（新增 / 升级 / 降级 / 弃坑）。

## 技术架构

```
dsh-radar/
├── scripts/                          # 零依赖抓取（Node 18+）
│   ├── build-data.mjs                # 主入口（约 400 行）
│   ├── build-search-index.mjs        # 生成客户端搜索索引
│   └── lib/
│       ├── score.mjs                 # 5 维评分算法 + 兼容矩阵判定
│       └── format.mjs                # fetchJson / sleep / fmtNum / slugify
├── data/                             # 抓取结果（git-tracked）
│   ├── index.json                    # 711 插件索引
│   ├── stats.json                    # 汇总（build_ms 1,366,688 ≈ 22 min）
│   ├── plugins/*.json                # 711 个插件详情
│   ├── recipes.json                  # 配方
│   ├── potholes.json                 # 踩坑
│   ├── compare.json                  # 横评
│   └── search-index.json             # 客户端搜索索引
└── web/                              # Astro 5 静态站
    └── src/
        ├── pages/
        │   ├── index.astro           # 首页（实时统计 + Top 5）
        │   ├── plugins/              # 列表 + 详情（动态路由 711 个）
        │   ├── search.astro          # 客户端搜索（URL 同步）
        │   ├── recipes.astro
        │   ├── compare.astro         # 6 维雷达对比
        │   ├── potholes.astro        # 踩坑 Wiki
        │   ├── subscribe.astro       # 订阅落地页
        │   ├── team.astro            # 团队版落地页
        │   ├── sitemap.xml.ts        # SEO sitemap（含 playground / changelog 占位）
        │   └── feeds/
        │       ├── rss.xml.ts        # RSS 2.0 endpoint
        │       ├── atom.xml.ts       # Atom endpoint
        │       └── feed.json.ts      # JSON Feed endpoint
        ├── components/
        │   └── RadarChart.astro      # 手写 SVG 雷达图（零运行时依赖）
        └── lib/paths.mjs             # 防 __dirname 漂移（6 候选路径探测）
```

### 关键设计

1. **零依赖抓取** —— 不用 undici / node-fetch，纯内置 fetch + 手写 retry/sleep/cache（见下文 `fetchJson`）
2. **npm metadata 缓存** —— `data/.cache/pkg/*.json`，二次跑 5 秒搞定
3. **手写 SVG 雷达图** —— 不引 chart.js / d3，零运行时依赖
4. **客户端搜索** —— 不写后端，`search-index.json` + 内联 JS 过滤，URL 同步
5. **路径探测 helper** —— `paths.mjs` 用 6 候选路径防 Astro build 后 `__dirname` 漂移

### 关键代码片段

**`fetchJson` 带指数退避重试**（`scripts/lib/format.mjs`）：

```javascript
export async function fetchJson(url, opts = {}) {
  const { retries = 3, baseDelay = 500, headers = {} } = opts;
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'dsh-radar/0.1 (+https://dsh.pub)', ...headers },
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (i < retries - 1) await sleep(baseDelay * Math.pow(2, i));
    }
  }
  throw lastErr;
}
```

**手写雷达图**（`web/src/components/RadarChart.astro`）：

```astro
---
const { scores } = Astro.props;
const dims = ['popularity', 'maintenance', 'quality', 'security', 'dsh_compat'];
const polygons = dims.map((_, i) => {
  const r = (scores[dims[i]] / 100) * 130;
  const angle = (Math.PI * 2 * i) / dims.length - Math.PI / 2;
  return `${150 + r * Math.cos(angle)},${150 + r * Math.sin(angle)}`;
}).join(' ');
---
<svg viewBox="0 0 300 300" role="img" aria-label="Radar chart">
  <defs>
    <radialGradient id="radar-fill" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#5eead4" stop-opacity="0.4" />
      <stop offset="100%" stop-color="#5eead4" stop-opacity="0.05" />
    </radialGradient>
  </defs>
  <polygon points={polygons} fill="url(#radar-fill)" stroke="#5eead4" stroke-width="2" />
</svg>
```

## 部署

```bash
# 抓数据（22 分钟全量，二次跑 5 秒）
node scripts/build-data.mjs

# 生成搜索索引
node scripts/build-search-index.mjs

# 构建站点（920ms，919 个页面）
cd web && npm run build

# 部署 dist/ 到任意静态托管（GitHub Pages / Cloudflare Pages / Vercel / Nginx）
```

GitHub Actions 已配置：每周一 UTC 02:00 自动跑数据 + 部署 GitHub Pages。

**承诺：零追踪。** 站点不接 GA / Plausible / Umami / Cloudflare Analytics，订阅全部走 RSS / Atom / JSON Feed 或用户自托管 Webhook。GitHub Pages 部署可直接审计网络请求日志。

## 团队版（B 端付费功能）

| Tier | 价格 | 包含 |
|---|---|---|
| **Free** | $0 | 全部雷达 + 配方 + 踩坑 + 订阅 |
| **Team** | $19/seat/月 | + 插件白名单 + 共享 profile + 安装审计 + 私有 registry 镜像 |
| **Enterprise** | 议价 | + 私有化部署 + SSO + 等保合规 + SLA 99.95% |

目标客户：5-50 人研发团队。痛点是"AI 擅自提交代码" + "插件质量参差" + "升级全炸"。

## 求反馈

几个开放问题：

1. **评分权重**：popularity 25% 是不是给太高了？冷门但优质的新插件会被压低
2. **兼容矩阵自动化**：要不要写脚本自动跑 `cordis patch` 验证（取代手工 ✅⚠️❌）？
3. **域名**：`dsh.pub` 还是 `dsh.run`？

仓库：**github.com/dsh-radar/dsh-radar** （待创建）

---

## 评论区预案

**Q: 评分能复现吗？**
A: 能。`scripts/build-data.mjs` + `scripts/lib/score.mjs` 一键重跑，每次重算评分 + 重写 JSON，`data/` git-tracked 可审计。

**Q: 怎么防 spam 插件刷分？**
A: 评分权重 popularity 只占 25%，其他维度（maintenance / quality / security）能让短命 spam 插件自然掉到 C/D。

**Q: 团队版真有人买吗？**
A: 还没，先做出来试。

**Q: 为什么承诺零追踪？**
A: 这是产品的一部分 —— 不是"少接了"，是"承诺不接"。第三方脚本全部不上，订阅走标准 RSS / Atom / JSON Feed。