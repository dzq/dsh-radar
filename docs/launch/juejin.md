# 掘金发布稿

## 元数据
- **分类**: 后端 / 工具
- **标签**: `JavaScript`、`Node.js`、`Astro`、`开源`、`AI`

## 标题

**我用 Node 18 零依赖脚本，给 DSH 生态 711 个插件打了 S/A/B/C 雷达评分（919 静态页 · 920ms build · 完整架构）**

## 副标题

> 不做第 7 个插件市场，做市场不愿意做的脏活：持续评测 + 版本兼容矩阵 + 实战配方 · 承诺零追踪

## 封面图建议

- 首页截图（711 统计条 + 雷达图 + 等级徽章）
- 或自己画一张"DSH 雷达扫描图"

---

## 正文

### 前言

最近在做 DSH（DeepSeek Harness）项目，遇到一个绕不开的问题：**装什么插件？**

搜 `dsh-plugin` 标签，出来 711 个 npm 包；GitHub 上同时存在 6 个独立的插件市场项目 + 5 份 awesome 列表 —— **都在罗列，没人评测**。

于是我花了 **22 分钟**跑了全量脚本，给每个插件打了 **5 维雷达评分**。这就是 **DSH Radar**。

**本文适合**：对 Astro / 静态站 / Node 脚本 / AI Agent 生态感兴趣的开发者。

**读完你能 get**：
1. 一个可复现的插件雷达系统（数据 + 算法 + 站点都开源）
2. 零依赖抓取脚本的写法（Node 18+ 内置 fetch + 指数退避）
3. Astro 静态站的极致性能（919 页 / 920ms）
4. 一个完整的产品方法论（不接 GA / Plausible，承诺零追踪）

## 一、为什么不做第 7 个市场？

做市场容易，做评测难。评测需要：
- **持续跑**（不能写死数据，必须周更）
- **多维度评分**（不是简单的 star 数，要看维护 + 安全 + 兼容）
- **兼容性测试**（DSH rc 版 API 经常变，升级会炸）
- **配方积累**（社区共建，任务 → 插件组合）

这些脏活没人做。我做。

## 二、数据结果

一次全量跑（22 分钟 47 秒，零 npm 依赖）：

```
✅ 711 个 npm 包挂 dsh-plugin 标签 · 100% 评分覆盖
├─ S 级: 1     @liustack/modsearch     (周下载 4,097 · ★105 · overall 85)
├─ A 级: 3     @liustack/pptfast / design-playbook / plaindeck
├─ B 级: 147
├─ C 级: 549   (主流)
└─ D 级: 11     (高危，建议白名单禁用)
Total weekly downloads: 8,692
DSH 标准兼容: 649 / 711 (91%)
Build time: 22 min 47 s (build_ms 1,366,688)
```

### 评分 5 维

| 维度 | 权重 | 数据源 |
|---|---|---|
| **Popularity** | 25% | npm weekly downloads（log scale 归一化） |
| **Maintenance** | 20% | npm last publish + GitHub last push |
| **Quality** | 20% | README 长度 / keywords / license / examples |
| **Security** | 15% | trustedPublisher / 关键词审计 |
| **DSH Compat** | 20% | `dsh.*` 字段 / `engines.dsh` / `peerDependencies` |

### 等级阈值

- **S** ≥85 · **A** ≥70 · **B** ≥55 · **C** ≥40 · **D** <40

完整算法在 `scripts/lib/score.mjs`（欢迎质疑权重）。

## 三、架构（核心代码 ≈ 600 行）

```
dsh-radar/
├── scripts/                          # 零依赖抓取（Node 18+）
│   ├── build-data.mjs                # 主入口（约 400 行）
│   ├── build-search-index.mjs        # 客户端搜索索引生成
│   └── lib/
│       ├── score.mjs                 # 5 维评分算法
│       └── format.mjs                # fetchJson / sleep / slugify
├── data/                             # 抓取结果（git-tracked）
│   ├── index.json                    # 711 插件索引
│   ├── stats.json                    # 汇总统计
│   ├── plugins/*.json                # 711 个插件详情
│   ├── recipes.json                  # 实战配方
│   ├── potholes.json                 # 踩坑 Wiki
│   ├── compare.json                  # 横评数据
│   └── search-index.json             # 客户端搜索索引
└── web/                              # Astro 5 静态站
    └── src/
        ├── pages/
        │   ├── index.astro           # 首页（实时统计 + Top 5）
        │   ├── plugins/              # 列表 + 711 个详情（动态路由）
        │   ├── search.astro          # 客户端搜索 + URL 同步
        │   ├── recipes.astro
        │   ├── compare.astro         # 6 维雷达对比
        │   ├── potholes.astro        # 踩坑 Wiki
        │   ├── subscribe.astro       # 订阅落地页
        │   ├── team.astro            # 团队版落地页
        │   ├── sitemap.xml.ts        # SEO sitemap
        │   └── feeds/
        │       ├── rss.xml.ts        # RSS 2.0
        │       ├── atom.xml.ts       # Atom
        │       └── feed.json.ts      # JSON Feed
        ├── components/
        │   └── RadarChart.astro      # 手写 SVG 雷达图
        └── lib/paths.mjs                # 路径探测 helper（6 候选路径防漂移）
```

## 四、关键技术点

### 4.1 零依赖抓取脚本

为了避免 `pnpm install` 拖慢 CI，抓取脚本只用 Node 18+ 内置的 `fetch`：

```javascript
// scripts/lib/format.mjs
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

**好处**：跑 `node scripts/build-data.mjs` 即可，无需任何包管理。CI 上少装 100+ 传递依赖。

### 4.2 npm metadata 缓存

711 个包每个都要拉 metadata，第二次跑会快很多：

```javascript
// scripts/build-data.mjs
async function fetchPkgMeta(name) {
  const cacheFile = join(CACHE_DIR, 'pkg', `${slugify(name)}.json`);
  if (existsSync(cacheFile)) {
    return JSON.parse(await readFile(cacheFile, 'utf8'));
  }
  const meta = await fetchJson(`https://registry.npmjs.org/${name}`);
  await mkdir(dirname(cacheFile), { recursive: true });
  await writeFile(cacheFile, JSON.stringify(meta));
  return meta;
}
```

**结果**：首次跑 22 分钟，二次跑 ~5 秒。

### 4.3 手写 SVG 雷达图

不引 chart.js / d3（省 ~200KB runtime）：

```astro
---
// web/src/components/RadarChart.astro
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

**好处**：完全可控、移动端自适应、零运行时依赖。

### 4.4 客户端搜索（零后端）

711 个插件摘要 inline 到 HTML，URL 参数同步：

```javascript
// search.astro 里的客户端逻辑
const q = document.getElementById('q').value.toLowerCase();
rows.forEach((r) => {
  const match = !q ||
    r.dataset.name.includes(q) ||
    r.dataset.desc.includes(q) ||
    r.dataset.keywords.includes(q);
  r.style.display = match ? '' : 'none';
});
// URL 同步: /search?q=modsearch&grade=A&sort=w&compat=1
```

**好处**：零服务器成本、可分享 URL、即时响应。

### 4.5 RSS / Atom / JSON Feed 端点

Astro 5 的 endpoint 模式，运行时生成（静态站也支持）：

```typescript
// web/src/pages/feeds/rss.xml.ts
export const GET: APIRoute = async ({ site }) => {
  const base = site?.toString().replace(/\/$/, '') || 'https://dsh.pub';
  // ... 生成 RSS XML
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
```

**承诺：零追踪**。不接 GA / Plausible / Umami / Cloudflare Analytics，订阅全部走标准 RSS / Atom / JSON Feed 或用户自托管 Webhook。

### 4.6 Sitemap（含新页面占位）

```typescript
// web/src/pages/sitemap.xml.ts
const staticUrls = [
  '', 'plugins', 'search', 'recipes', 'compare',
  'potholes', 'subscribe', 'team',
  'playground',   // 即将上线
  'changelog',    // 即将上线
].map((p) => ({
    loc: `${base}/${p}`,
    priority: p === '' ? 1.0 : 0.8,
    changefreq: p === '' || p === 'plugins' ? 'daily' : 'weekly',
}));
```

## 五、踩坑与修复

### 5.1 `<code>{ JSON }</code>` 被当 JSX

Astro 把 `<code>` 标签后的 `{` 解析为表达式开始。**修复**：用 backtick template literal：

```astro
<pre><code>{`{
  "whitelist": {
    "auto_allow": ["grade-S", "grade-A"]
  }
}`}</code></pre>
```

### 5.2 `__dirname` 在 Astro build 后漂移

`plugins/index.astro` 编译到 `dist/pages/plugins.astro.mjs`（不是 `dist/pages/plugins/`），少一层。**修复**：统一 `paths.mjs` 用 6 候选路径探测：

```javascript
function findDataDir() {
  const candidates = [
    resolve(__dirname, '..', '..', '..', '..', 'data'),     // src/lib
    resolve(__dirname, '..', '..', '..', 'data'),          // src/pages
    resolve(__dirname, '..', '..', '..', '..', '..', 'data'), // build 后
    resolve(process.cwd(), '..', 'data'),
    // ... fallback
  ];
  for (const p of candidates) {
    if (existsSync(join(p, 'index.json'))) return p;
  }
}
```

### 5.3 pnpm 11 强制 onlyBuiltDependencies

pnpm 11 不再读 package.json 里的 `pnpm.*` 字段，所有配置位置都失效。**修复**：直接换 npm。

### 5.4 Astro telemetry 写 ~/Library/Preferences

macOS sandbox 拒绝写。**修复**：

```bash
ASTRO_TELEMETRY_DISABLED=1 \
XDG_CONFIG_HOME=/tmp/xdg \
XDG_CACHE_HOME=/tmp/cache \
npx astro build
```

## 六、订阅 + 变现

### 6.1 订阅（去中心化、零追踪）

- RSS 2.0: `/feeds/rss.xml`
- Atom: `/feeds/atom.xml`
- JSON Feed: `/feeds/feed.json`
- Email: **Web3Forms** 表单（自托管友好，不是 Formspree）
- Webhook: n8n / Zapier / 自建 bot

### 6.2 团队版（B 端付费）

| Tier | 价格 | 目标 |
|---|---|---|
| Free | $0 | 个人开发者 |
| Team | $19/seat/月 | 5-50 人研发团队 |
| Enterprise | 议价 | 50+ 人 / 金融 / 政企 |

**核心特性**：插件白名单 + 共享 profile + 安装审计 + 私有 registry 镜像。

## 八、部署

```bash
# 抓数据（22 分钟全量 / 5 秒增量）
node scripts/build-data.mjs
node scripts/build-search-index.mjs

# 构建站点（920ms）
cd web && npm run build

# 部署 dist/ 到任意静态托管
# GitHub Pages / Cloudflare Pages / Vercel / 自建 Nginx
```

GitHub Actions 已配置：每周一 UTC 02:00 自动跑数据 + 部署。

## 九、路线图

- [x] 711 插件全量评分（v0.1）
- [x] 版本兼容矩阵（v0.1）
- [x] 实战配方 / 踩坑 Wiki / 横评（v0.1）
- [ ] `/playground` 插件组合实验场（拖拽 + 实时兼容性预测）
- [ ] `/changelog` 周报页（自动汇总本周插件变动）
- [ ] 英文版 i18n（Astro i18n 模块）
- [ ] 邮件订阅接 Web3Forms
- [ ] 注册 `dsh.pub` 域名

## 十、开放问题

1. **评分权重**：popularity 25% 是不是给太高？冷门但优质的新插件会被压低
2. **兼容矩阵自动化**：要不要写脚本自动跑 `cordis patch` 验证？
3. **域名**：`dsh.pub` vs `dsh.run` vs `dshkit.com`？

仓库：**github.com/dsh-radar/dsh-radar** （待创建）

求 ⭐、求 PR（配方 / 踩坑 / 评分公式）、求吐槽。

---

## 评论区预案

**Q: 为什么不直接用 chart.js / d3？**
A: 想要零运行时依赖。手写 SVG 50 行，比引 chart.js 省 200KB。

**Q: 评分公式能复现吗？**
A: 完整在 `scripts/lib/score.mjs`，欢迎质疑具体权重。`data/` git-tracked 每次 build 重算。

**Q: 怎么保证数据真实？**
A: 全脚本可重跑。每次 build 重算评分 + 重写 JSON，`data/` 是事实源。

**Q: 团队版真有人买吗？**
A: 还没。先做出来试。痛点真实存在（AI 擅自提交代码、插件质量参差），就看付费意愿了。

**Q: 和 DeepSeek 官方有关系吗？**
A: 没有。社区项目。已发邮件告知官方。

**Q: 为什么承诺零追踪？**
A: 这是产品的一部分 —— 不是"少接了"，是"承诺不接"。第三方脚本（GA / Plausible / Umami / Cloudflare Analytics）全部不上，订阅走 RSS / Atom / JSON Feed 或用户自托管 Webhook。GitHub Pages 部署可直接审计网络请求日志。