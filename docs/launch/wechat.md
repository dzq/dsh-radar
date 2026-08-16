# DSH Radar：把 711 个 DSH 插件拉出来做了个雷达评分，这件事我做了 22 分钟

> 公众号首发 · 略深度 · 可适度自嘲 · 阅读约 8 分钟

---

## 一、起因：一个被问了 100 遍的问题

最近半年，DSH（DeepSeek Harness）生态长得很快。

npm 上挂了 `dsh-plugin` 这个标签的包已经有 **711 个**。GitHub 上能搜到的独立插件市场，保守估计有 6 个（dsh-market、whalehub-dsh、dsh-plugin-marketplace、dsh-plugin-hub、dsh-webui-market-plugin、dsh-community-plugins），外加 5 份 awesome 列表。

但每次在群里有人问「我想给 DSH 装个 xxx 插件，哪个好？」我都没法回答。

不是不愿意答，是真的答不了。

为什么？因为没人做过这件事。所有人和所有项目都在做同一件事 —— **罗列**。

**罗列** 和 **评测** 之间隔着一道鸿沟。罗列只要抓个标题 + 描述就行；评测要看下载量、commit 频率、依赖漏洞、版本兼容性、要聚合社区的踩坑贴。

更真实的需求是：**升级 DSH 后哪些插件会炸？**

升级一次 DSH，像拆炸弹一样紧张。哪个会炸？没人告诉你。

所以我做了个东西，叫 **DSH Radar**（域名 dsh.pub）。

不做第 7 个市场。做市场不愿意做的脏活：持续评测 + 兼容矩阵 + 配方库 + 横评。

---

## 二、做了什么

DSH Radar 的定位很明确：**给 DSH 生态做客观评分雷达**。

核心是 5 维评分（每项加权到 S/A/B/C/D）：

| 维度 | 权重 | 数据来源 |
|---|---|---|
| **popularity** | 25% | npm 周下载量、GitHub Star |
| **maintenance** | 20% | 最近 commit 时间、issue 响应速度 |
| **quality** | 20% | TS 类型完整度、文档覆盖率、测试比例 |
| **security** | 15% | npm audit 漏洞数、依赖 transitive 风险 |
| **DSH compat** | 20% | 是否声明 peer 依赖、CHANGELOG 兼容记录 |

跑完一次全量，**711 个包**的分布是：

```
S  1   @liustack/modsearch (4,097 dl/wk, ★105)
A  3   pptfast / design-playbook / plaindeck
B  147 
C  549  主流
D  11   高危，建议白名单禁用
```

数据挺扎心的 —— **真正能放心用的，只有 4 个**（S+A）。剩下 91% 是 B 和 C，还有 11 个 D 级高危，应该直接禁掉。

---

## 三、技术细节：零依赖 22 分钟

做这件事最难的不是评分算法，是**怎么在零依赖的情况下跑完 711 个包**。

nmp 官方 registry 没有 bulk API，只能一个个 GET。GitHub API 有 rate limit（未认证 60 req/h）。一开始我想用 axios + p-limit，结果装了一堆依赖，启动个脚本 npm install 都要 30 秒。

后来想通了：**Node 18+ 内置 fetch + 内置 AbortController，够了**。

```javascript
// scripts/scrape.mjs —— 零依赖的核心
import { readFileSync, writeFileSync } from 'node:fs';
import { fetch } from 'undici'; // 故意注释掉，用内置 fetch

const PKGS = JSON.parse(readFileSync('data/pkg-list.json', 'utf8'));

const results = await Promise.all(
  PKGS.map(pkg =>
    fetch(`https://registry.npmjs.org/${pkg}`)
      .then(r => r.json())
      .catch(() => null)
  )
);
```

跑通后实测：**22 分钟** 抓完全量 711 个包 + 711 个 GitHub repo 元信息。

评分算法在 `scripts/lib/score.mjs`，完全公开，欢迎质疑公式。

静态站用 **Astro 5**，配置 `output: 'static'`：

```
npm run build
# → 919 pages generated in 920ms
```

**919 个页面，920ms。** 因为全是静态 HTML，连 JS 都是按需 hydrate。

雷达图是手写的 SVG —— 5 维多边形 + 渐变填充，没有任何 chart 库依赖。

---

## 四、不只是评分

如果只做评分，那就是第 7 个市场的升级版。我加了几样市场不做的东西：

### 1. 兼容矩阵

每个插件详情页都有「Compatible DSH versions」表 —— 升级 DSH 前先看一眼。

### 2. 配方库（Recipes）

任务 → 插件组合。例如：

> **「我想用 DSH 搭个自动 PPT 生成的 workflow」**
> → DSH Core + pptfast (A) + design-playbook (A) + plaindeck (A)

目前 5 个配方起步，欢迎 PR。

### 3. 踩坑 Wiki

聚合 GitHub Discussions / V2EX / linux.do / X 上提到「dsh-plugin」的所有踩坑贴，自动按插件 slug 索引。地址：`dsh.pub/potholes`

### 4. 横评（Compare）

DSH vs BitFun vs Claude Code vs Cursor，**6 维雷达图**对比。地址：`dsh.pub/compare`

### 5. Feed 三件套

RSS 2.0 / Atom / JSON Feed **三种都生成**，订阅你最顺手的那个。

---

## 五、怎么用

**作为用户**：

1. 打开 dsh.pub
2. 在 `/plugins` 浏览 711 个包，按评分排序
3. 想找特定功能？`/search?q=你的关键词`
4. 订阅 `/subscribe`，新插件/评分变化自动推

**作为开发者（给自己的项目加监控）**：

```bash
git clone https://github.com/dsh-radar/dsh-radar
cd dsh-radar
node scripts/build-data.mjs   # 重跑抓取 + 重算评分
npm run build                 # 重 build 静态站
```

**作为团队负责人**：

团队版 **$19/seat/月**，解决三个真实痛点：

- **白名单**：禁止员工装 D 级插件
- **审计日志**：谁在什么时候装了哪个版本
- **私有 registry**：企业内部插件单独评分

---

## 六、求反馈

这是社区项目，不是 DeepSeek 官方出品（虽然很希望未来能合作）。

完全开源 **MIT**，零追踪承诺 —— 没有 Google Analytics，没有埋点，连 Plausible 都是 opt-in。

我想要三类反馈：

1. **⭐ Star**：哪怕只是路过点一下，对独立开发者都是莫大的鼓励
2. **🐛 提 Issue**：评分算法哪里不合理？哪个维度权重该调？
3. **📝 PR 配方**：你用过的好插件组合，写到 `data/recipes.json`

仓库地址：
```
https://github.com/dsh-radar/dsh-radar
```

域名：
```
https://dsh.pub
```

如果你是 DSH 重度用户，欢迎转发到你的技术群。如果你装了某个插件发现评分不准，欢迎来评论区怼我 —— 反正我都会回。

最后自嘲一下：做这个项目的本意是「帮别人避坑」，结果发现**最大的坑是 D 级插件占 1.5% 这个事实本身**。装插件这事，到头来确实靠运气。😅

谢谢看完。

---

**附录 · FAQ**

**Q：和 DeepSeek 官方有关系吗？**
A：没有。社区项目，保持中立。

**Q：评分会不会被刷？**
A：popularity 只占 25%，短命 spam 插件自然掉到 C/D。

**Q：怎么部署？**
A：支持 GitHub Pages / Cloudflare Pages / Vercel / 自建。详见 `docs/CONFIG.md`。