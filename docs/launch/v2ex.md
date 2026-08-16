# V2EX 发布稿

## 元数据
- **节点**: `程序员` / `分享创造`
- **标签建议**: `AI`、`开源`、`插件`、`工具`

## 标题（任选其一）

**A（推荐）**: `[开源] DSH Radar — 给 DSH 生态 711 个插件打了 S/A/B/C 雷达评分 + DSH 版本兼容矩阵`

**B**: `用 Node 18 零依赖脚本，把 npm 上 711 个 dsh-plugin 全跑了一遍评分`

**C**: `dsh 生态到底缺什么？我做了个插件雷达（919 静态页，0 后端）`

---

## 正文

最近用 DeepSeek Harness（DSH）做 agent，被一件事卡住：**装什么插件？**

```
npm search dsh-plugin → 711 results
GitHub: 6 个独立的 dsh-plugin 市场项目（dsh-market / whalehub-dsh / dsh-plugin-marketplace / dsh-plugin-hub / dsh-webui-market-plugin / dsh-community-plugins）
awesome-list: 5 份，互相打架
```

大家都在做同一个事：**罗列**。没人做：
- ❌ 持续评测（哪个好用？哪个是坑？）
- ❌ 版本兼容矩阵（升级 DSH 后哪些插件会炸？）
- ❌ 实战配方（任务 → 插件组合）
- ❌ 客观横评（DSH vs BitFun vs Claude Code vs Cursor）

所以我做了个 **DSH Radar** —— 不做第 7 个市场，做市场不愿意做的脏活。

---

## 数据（一次全量跑，22 分钟）

```
✅ 711 plugins scored · DSH 标准兼容 649 / 711 (91%)
├─ S: 1   @liustack/modsearch      (周下载 4,097 · ★105)
├─ A: 3   pptfast / design-playbook / plaindeck
├─ B: 147
├─ C: 549  (主流)
└─ D: 11   (高危，建议白名单禁用)
Total weekly downloads: 8,692
```

评分 5 维：**popularity** / **maintenance** / **quality** / **security** / **DSH compat**

权重：25% / 20% / 20% / 15% / 20%。阈值 S≥85 / A≥70 / B≥55 / C≥40 / D<40。

完整算法在 `scripts/lib/score.mjs` —— 欢迎质疑。

---

## 技术栈（极简，零后端）

- **抓取**：Node 18+ 内置 fetch，**零 npm 依赖**，单文件 400 行
- **静态站**：Astro 5，`output: 'static'`，**919 个页面**，build **920ms**
- **图表**：手写 SVG 雷达图（不引 chart.js / d3，省 ~200KB runtime）
- **搜索**：客户端 JS 过滤 711 行，URL 参数同步 `?q=modsearch&grade=A&sort=w`
- **订阅**：RSS 2.0 / Atom / JSON Feed 三种 endpoint

**承诺：零追踪**。不接任何统计脚本（GA / Plausible / Umami 全部不接），不写 Cookie，所有订阅走 RSS 或用户自托管的 webhook。

---

## 站点结构（`dsh.pub`）

```
/              首页 + 实时统计（711 · 1S · 3A · 147B · 549C · 11D）
/plugins       全量 711 列表（含等级徽章 + 周下载 + 兼容标）
/plugins/[slug] 711 个详情页（雷达图 + 5 维评分 + 兼容矩阵）
/search        客户端搜索 + 5 维筛选 + URL 同步
/recipes       5 个实战配方（任务→插件组合）
/compare       DSH vs BitFun vs CC vs Cursor 6 维雷达
/potholes      踩坑 Wiki（聚合 GitHub Discussions / V2EX / linux.do）
/playground    插件组合实验场（即将上线 · 拖拽组合 + 实时兼容性预测）
/changelog     周报页（即将上线 · 自动汇总本周插件变动）
/subscribe     RSS / Email (Web3Forms) / Webhook
```

---

## 仓库

```
https://github.com/dsh-radar/dsh-radar
```

完全开源 **MIT**。`data/` 目录 git-tracked（711 个插件 JSON + 配方 + 踩坑），`web/` 是 Astro 站点，`scripts/` 是抓取脚本。

参与方式：
- 新增配方：编辑 `data/recipes.json`
- 报告踩坑：编辑 `data/potholes.json`
- 修正评分：跑 `node scripts/build-data.mjs`

---

## 下一步

1. 注册 `dsh.pub` 域名（约 ¥80-150/年）
2. GitHub Actions 每周一自动跑数据 + 部署 GitHub Pages
3. 上线 `/playground` + `/changelog` 两个新页面（sitemap 已占位）
4. 邮件订阅接 Web3Forms（不是 Formspree，自托管友好）
5. 招 100 个早期 Star

求 ⭐ / 反馈 / 吐槽。

---

## 评论区预案

**Q: 为什么不直接做第 7 个市场？**
A: 市场已经过度饱和（npm 711 包 + GitHub 6 个市场 + 5 份 awesome-list）。我做差异化 —— 持续评测、兼容矩阵、配方库、横评。

**Q: 评分算法靠谱吗？**
A: 评分完全基于公开数据（npm registry + GitHub API），算法在 `scripts/lib/score.mjs`，欢迎质疑具体公式。仓库 100% 可重跑。

**Q: 怎么保证数据真实？**
A: `node scripts/build-data.mjs` 一键重跑 —— 重新拉数据 + 重算评分 + 重写所有 JSON。`data/` git-tracked，diff 公开可审计。

**Q: 和 DeepSeek 官方有关系吗？**
A: 没有。纯社区项目。

**Q: 为什么强调零追踪？**
A: 因为这是产品的一部分 —— 不是"少接了"，是"承诺不接"。GitHub Pages 部署可直接审计请求日志。

**Q: 数据能给个 raw 链接吗？**
A: `https://github.com/dsh-radar/dsh-radar/tree/main/data` （MIT，随便用）