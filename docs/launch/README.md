# DSH Radar 发布计划

## 🎯 发布目标

- **首周**：4 个平台同步发，目标 100 Star
- **首月**：1 个平台爆，目标 500 Star
- **首季**：稳定 1000+ Star + 首批 Team 付费客户

## 📦 已交付物

```
docs/launch/
├── README.md             # 本文件（总览）
├── v2ex.md               # V2EX 发布稿（极客风 + 数据驱动）
├── linux-do.md           # linux.do 发布稿（故事向 + 痛点共鸣）
├── cocoloop.md           # cocoloop 发布稿（AI 编程深度）
├── juejin.md             # 掘金发布稿（结构化 + SEO 友好）
├── x-twitter.md          # X(Twitter) 主推 + thread（hook 驱动）
├── wechat.md             # 微信公众号长文（深度 + 自嘲）
├── xiaohongshu.md        # 小红书笔记（短 + 朋友聊天 + 表情包）
└── ../../docs/CONFIG.md  # Formspree + Plausible 配置指南
```

## 📋 发布步骤

### 准备（发布前 1 天）

- [ ] 注册 GitHub repo：`gh repo create dsh-radar/dsh-radar --public --source=. --remote=origin --push`
- [ ] 买域名：`dsh.pub`（约 ¥80-150/年，Namecheap / 阿里云）
- [ ] 配置 DNS：`dsh.pub` CNAME → `<user>.github.io`
- [ ] GitHub Pages 启用 + 首次部署
- [ ] 注册 [Formspree](https://formspree.io/)（免费 50/月）+ 创建 form
- [ ] 注册 [Plausible](https://plausible.io/)（30 天试用）或自托管
- [ ] 填 `web/.env` 并 commit（敏感变量用 GitHub Secrets）

### 发布当天（按时间顺序）

#### 1. V2EX（北京时间 9:00 发，程序员节点流量高峰）
- [ ] 复制 `v2ex.md` 正文（去掉标题党包装，留下真实标题）
- [ ] 添加 1 张首页截图（带雷达图）
- [ ] 发到 `https://v2ex.com/new/` → 节点选 `分享创造`
- [ ] 1 小时内回复所有评论（流量最大平台）

#### 2. linux.do（北京时间 14:00 发，社区流量高峰）
- [ ] 复制 `linux-do.md` 正文
- [ ] 发到 `linux.do` 对应分类
- [ ] 主动 @ 几个 DSH 重度用户（你认识的）

#### 3. 掘金（北京时间 20:00 发，晚间阅读高峰）
- [ ] 复制 `juejin.md` 正文
- [ ] 手动加封面图 + 配图
- [ ] 选标签：`JavaScript`、`Node.js`、`Astro`、`开源`、`AI`
- [ ] 发到 https://juejin.cn/post/new

#### 4. cocoloop（次日上午发）
- [ ] 复制 `cocoloop.md` 正文
- [ ] 发到 https://cocoloop.cn/new
- [ ] 同时发到 X（Twitter）@daboring_ai @shao__meng 等 DSH 知名开发者

### 发布后 1 周

- [ ] 每天回复所有平台评论
- [ ] 整理 FAQ 发到 README
- [ ] 跑 1 次增量抓取（数据更新到博客里当"周报"）
- [ ] 收集反馈 → 调整评分权重

## 🎯 关键传播节点

| 时间 | 动作 |
|---|---|
| T+0h | 4 平台同步发出 |
| T+1h | V2EX 第一波评论（最关键，决定首页停留） |
| T+6h | 整理 FAQ + 修小 bug |
| T+24h | 发"24 小时数据"：多少 Star、多少 issue、多少注册 |
| T+72h | 发"踩坑 Wiki 收录第一周战报" |
| T+7d | 发"周报 #1"：本周评分变化 + 新增插件 |

## 💬 评论区预案（每个平台通用）

**Q: 评分算法靠谱吗？**
A: 完全基于公开数据（npm + GitHub API），算法在 `scripts/lib/score.mjs`。欢迎质疑公式。

**Q: 怎么防止刷分？**
A: popularity 只占 25%，其他维度让短命 spam 插件自然掉到 C/D。

**Q: 团队版有人买吗？**
A: 还没，先做出来试。痛点真实存在。

**Q: 和 DeepSeek 官方有关系吗？**
A: 没有。社区项目。

**Q: 怎么部署？**
A: 见 `docs/CONFIG.md`，支持 GitHub Pages / Cloudflare Pages / Vercel / 自建。

## 📊 监控指标

部署后立刻接：

1. **Plausible**（已集成，填 env 即生效）
   - 关键页：/、/plugins、/team、/subscribe
   - 目标：首周 1000 PV
2. **GitHub Stars**（最重要的北极星）
   - 目标：T+7d 50 star · T+30d 200 star
3. **Formspree submissions**（B 端真实信号）
   - 目标：T+30d 5 个 Team 试用申请

## 🛟 紧急预案

如果某平台被喷"重复造轮子"：
> 回复：我们做的不是第 7 个市场，是市场不愿意做的脏活（持续评测、兼容矩阵、配方库、横评）。差异化在数据驱动 + 持续更新。

如果被喷"评分不客观"：
> 回复：算法完全开源，欢迎提 issue 改权重。当前是 popularity 25% / maintenance 20% / quality 20% / security 15% / dsh_compat 20%。

如果被质疑"会不会被官方收编"：
> 回复：保持中立。数据开源，谁都可以用。如果官方愿意合作，更好。
