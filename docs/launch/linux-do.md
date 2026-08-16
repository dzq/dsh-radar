# linux.do 发布稿

## 元数据
- **分类**: 技术 / 分享创造
- **标签**: `开源`、`ai`、`deepseek`、`插件`、`工具分享`

## 标题

**【分享】DSH 插件评分雷达 — 711 个真实插件 S/A/B/C 一目了然（零追踪承诺 · 附 RSS / 团队版）**

---

## 正文

### 起因：装插件靠运气，升级像拆炸弹

上周开始玩 DeepSeek Harness（DSH），上手第一件事是装插件。

- npm 搜 `dsh-plugin` 标签，出来 **711 个包**
- GitHub 同时存在 **6 个插件市场项目**，每个都说自己是"官方"
- awesome 列表 **5 份**，互相打架
- 装完不知道哪个好用、哪个会 RCE、哪个和 DSH 0.2.0 不兼容
- 想卸载，但又怕依赖别人的插件

**装插件靠运气。升级 DSH 像拆炸弹。**

于是我想：**既然没人做评测，那我自己做。**

### DSH Radar 是什么

一个**只做评测、不做市场**的 DSH 生态观察站。

每周自动跑一遍全量脚本，给每个插件打 5 维雷达评分：

- **Popularity** — 周下载（log scale 归一化）
- **Maintenance** — 最后发布 + 最后 commit
- **Quality** — README 长度 / keywords / license / examples
- **Security** — trustedPublisher / 关键词审计
- **DSH Compat** — 含 `dsh.*` 字段 / `engines.dsh` / `peerDependencies`

等级 **S / A / B / C / D**。

跑通一次全量后，数据是这样的：

```
✅ 711 plugins · 1S · 3A · 147B · 549C · 11D
   Total weekly downloads: 8,692
   DSH 标准兼容: 649 / 711 (91%)
   Build time: 22 min (one-shot)
```

唯一的 S 级是 `@liustack/modsearch` —— 一周 4,097 下载、★105、cordis patch 完整、README 详细。

它现在 5 维都跑分 85+：

| 维度 | 得分 |
|---|---|
| Popularity | 88 |
| Maintenance | 92 |
| Quality | 87 |
| Security | 85 |
| DSH Compat | 90 |

> **其它 710 个都是陪跑。** 这就是雷达存在的意义 —— 一眼看出谁是真正能用的。

### 不只是评分，还有配套的基础设施

光评分没用，关键是**配套**：

1. **版本兼容矩阵** —— 每个插件页 4 行兼容表（0.1.0-rc.6 / 0.1.0 / 0.2.0 / 0.3.0+），升 DSH 前先看
2. **实战配方（recipes）** —— "我做 PPT 用哪 3 个插件" 类任务 → 插件组合的最佳实践
3. **踩坑 Wiki（potholes）** —— 聚合 GitHub Discussions / V2EX / linux.do 的真实坑
4. **横评对比** —— DSH vs BitFun vs Claude Code vs Cursor 的 6 维雷达
5. **订阅** —— RSS / Atom / JSON Feed 三种全做，每周自动推送变化
6. **插件实验场（playground · 即将上线）** —— 拖拽组合 + 实时兼容性预测
7. **周报页（changelog · 即将上线）** —— 自动汇总本周插件变动

### 技术栈

刻意保持简单：

- **抓取脚本**：Node 18+ 内置 fetch，**零 npm 依赖**，单文件 400 行
- **静态站**：Astro 5，`output: 'static'`，**919 个页面**，build **920ms**
- **图表**：手写 SVG 雷达图（不引 chart.js / d3，省 ~200KB runtime）
- **搜索**：纯客户端 JS 过滤，零后端

整个项目跑在 `pnpm dev` 一个命令上，可部署到任意静态托管（GitHub Pages / Cloudflare Pages / Vercel / 自建 Nginx）。

**承诺：零追踪**。不接 GA / Plausible / Umami，不写 Cookie，订阅走 RSS 或用户自托管 webhook。GitHub Pages 部署可直接审计请求日志。

### 团队版

一个人玩太孤单。如果你想让团队用 DSH 不踩坑，可以试试 Team 版：

- **插件白名单**（基于 S/A/B/C/D 评分自动推荐起点）
- **共享 profile**（前端 / 后端 / QA 各自的标准插件组合）
- **安装审计日志**（谁、什么时候、装了什么）
- **私有 registry 镜像**

**$19/seat/月**，年付 8 折。**Free 永远免费** —— 所有雷达数据 / 配方 / 踩坑 / 订阅都开源 MIT。

### 求反馈

我现在有几个开放问题：

1. **评分算法**：当前权重 popularity 25% / maintenance 20% / quality 20% / security 15% / dsh_compat 20%。合理吗？
2. **兼容矩阵**：当前是手工标 ✅⚠️❌。要不要写脚本自动跑 `cordis patch` 验证？
3. **域名**：打算买 `dsh.pub`（约 ¥150/年）。会不会太短？
4. **订阅渠道**：RSS / Atom / JSON Feed 都做了，要不要加邮件订阅（用 Web3Forms，自托管友好）？

仓库：**github.com/dsh-radar/dsh-radar**

求 ⭐，求吐槽，求贡献配方 / 踩坑。

---

## 评论区预案

**Q: 评分公式能调吗？**
A: 能。`scripts/lib/score.mjs` 一文件改完，重跑 build 即可。

**Q: 为什么不直接做付费版？**
A: 团队版已经做了。数据/插件雷达免费用，治理和审计收钱。

**Q: DeepSeek 官方知道吗？**
A: 已发邮件告知，等回复。

**Q: 数据能用我的吗？**
A: MIT，随便用。仓库 `data/` 目录是 git-tracked 的，直接 clone。

**Q: 为什么承诺零追踪？**
A: 这是产品的一部分 —— 不是"少接了"，是"承诺不接"。要审计直接看部署后的网络请求日志，零三方脚本。