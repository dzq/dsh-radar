# X（Twitter）中文推文

## 🧵 主推（≤ 280 字）

> 711 个 npm dsh-plugin，只有 1 个 S 级、3 个 A 级，549 个 C 级，11 个 D 级高危。
>
> 我用 Node 18 零依赖脚本 22 分钟跑完全量抓取，5 维评分（popularity / maintenance / quality / security / DSH compat），919 个静态页 build 920ms。
>
> 不做第 7 个插件市场，做市场不愿做的脏活：兼容矩阵 + 配方库 + 踩坑 Wiki + RSS。
>
> 🔗 dsh.pub ｜ MIT · 零追踪
>
> #DSH #开源 #DeepSeek

---

## 🧵 Thread（≤ 7 条）

### 1/7 🪝 hook

> 711 个 DSH 插件，真正能放心用的只有 4 个。
>
> 我把 npm 上所有挂了 `dsh-plugin` 标签的包全跑了一遍评分，结果挺扎心的：1S / 3A / 147B / 549C / 11D 高危。
>
> 🧵 说说这事儿 ↓
>
> #DSH #开源 #DeepSeek

### 2/7 起因

> DSH 生态已经卷到有 6 个独立的插件市场 + 5 份 awesome 列表。
>
> 但所有人都在做同一件事：罗列。
>
> 没人做持续评测、没人做升级兼容矩阵、没人做任务→插件的实战配方。
>
> 升级一次 DSH，像拆炸弹一样 —— 哪个会炸？没人告诉你。

### 3/7 做了什么

> 所以我做了 **DSH Radar**：不做第 7 个市场，做市场不愿做的脏活。
>
> 5 维评分：
> - popularity（下载量/Star）
> - maintenance（commit 频率）
> - quality（类型完整度）
> - security（依赖漏洞）
> - DSH compat（版本兼容）

### 4/7 数据

> 纯 Node 18 内置 fetch，**零依赖**，22 分钟跑完全量 711 个包。
>
> Astro 5 静态站，919 个页面，**build 920ms**。
>
> 手写 SVG 雷达图，5 维多边形渐变。
>
> 客户端 JS 搜索 + URL 同步：`?q=modsearch&grade=A&sort=w`

### 5/7 不只是列表

> 我还做了 4 个市场不做的事：
> - **兼容矩阵**：升级 DSH 后哪些插件会炸
> - **配方库**：任务 → 插件组合（5 个起步）
> - **踩坑 Wiki**：聚合 GitHub Discussions / V2EX / linux.do
> - **横评**：DSH vs BitFun vs Claude Code vs Cursor（6 维）
>
> 另：RSS 2.0 / Atom / JSON Feed 三种订阅都生成。

### 6/7 商业模式

> 个人/查看完全免费，MIT 开源，零追踪承诺。
>
> 团队版 $19/seat/月：白名单 / 审计日志 / 私有 registry。
>
> 痛点真实存在 —— 企业不让员工随便装插件，但又没法一个个 review。

### 7/7 求反馈 + CTA

> 域名 dsh.pub，仓库 github.com/dsh-radar/dsh-radar
>
> 求：
> ⭐ Star（哪怕只是路过点一下）
> 🐛 提 issue（评分算法在 `scripts/lib/score.mjs`，欢迎质疑公式）
> 📝 PR 配方（`data/recipes.json`）
> 💬 转发给用 DSH 的朋友
>
> 谢谢看完。🙏
>
> #DSH #开源 #DeepSeek #独立开发