// src/i18n/index.mjs
// 简易 i18n helper：用 Astro.currentLocale 判断 + 文案对象

const dict = {
  'zh-CN': {
    site_name: 'DSH Radar',
    tagline: '给 DSH 插件打 <strong>S/A/B/C</strong> 雷达评分 · 自动维护<strong>版本兼容矩阵</strong> · 收集<strong>实战配方</strong> · 聚合<strong>踩坑 Wiki</strong>',
    nav: { plugins: '插件雷达', search: '搜索', recipes: '配方', compare: '横评', potholes: '踩坑', subscribe: '订阅', team: '团队版' },
    hero_cta_view: '查看插件雷达 →',
    hero_cta_star: '★ Star on GitHub',
    stats: { total: '评分插件', compat: 'DSH 标准插件', weekly: '周下载', grade_s: 'S 级插件', updated: '数据更新于' },
    sections: {
      top10: '🏆 头部插件雷达',
      top10_sub: '按综合评分排序的 Top 10 · <a href="/plugins">查看全部 →</a>',
      recipes: '📖 实战配方 · 精选',
      recipes_sub: '社区贡献的"任务 → 插件组合"配方 · <a href="/recipes">查看全部 →</a>',
      why: '为什么需要 DSH Radar？',
      why_lead: 'DSH 生态已有 <strong>708+</strong> 插件（npm `dsh-plugin` 标签），但 <strong>6+ 个市场项目各自为战</strong>，没有统一评分、没有版本兼容表、没有配方库。<br/>DSH Radar 做的是<strong>大家不愿意做的脏活</strong>：持续评测、兼容性矩阵、实战配方、横向对比。',
      features: {
        radar: { title: '📊 雷达评分', desc: '5 维度：popularity / maintenance / quality / security / DSH compat' },
        search: { title: '🔍 搜索 + 筛选', desc: '按名称/关键词/等级/兼容性 实时过滤 700+ 插件' },
        recipes: { title: '📖 配方库', desc: '任务 → 插件组合 → 实测 tips，社区共建' },
        potholes: { title: '🚧 踩坑 Wiki', desc: '聚合 GitHub Discussions / V2EX / linux.do 的踩坑贴' },
        compare: { title: '📊 横评对比', desc: 'DSH vs BitFun vs Claude Code vs Cursor 6 维雷达' },
        subscribe: { title: '📬 订阅更新', desc: 'RSS / Atom / JSON Feed，每周自动推送变化' },
        team: { title: '🚀 团队版 🚀', desc: '插件白名单 + 审计 + 私有 registry · $19/seat/月' },
      },
    },
    lang: '中文',
  },
  en: {
    site_name: 'DSH Radar',
    tagline: '<strong>S/A/B/C</strong> radar scoring for DSH plugins · automatic <strong>version compatibility matrix</strong> · curated <strong>recipes</strong> · aggregated <strong>pothole Wiki</strong>',
    nav: { plugins: 'Plugins', search: 'Search', recipes: 'Recipes', compare: 'Compare', potholes: 'Potholes', subscribe: 'Subscribe', team: 'Team' },
    hero_cta_view: 'View Plugin Radar →',
    hero_cta_star: '★ Star on GitHub',
    stats: { total: 'Scored Plugins', compat: 'DSH Standard', weekly: 'Weekly Downloads', grade_s: 'Grade-S Plugins', updated: 'Data Updated' },
    sections: {
      top10: '🏆 Top Plugin Radar',
      top10_sub: 'Top 10 by overall score · <a href="/plugins">view all →</a>',
      recipes: '📖 Featured Recipes',
      recipes_sub: 'Community-contributed task → plugin combinations · <a href="/recipes">view all →</a>',
      why: 'Why DSH Radar?',
      why_lead: 'The DSH ecosystem has <strong>708+</strong> plugins (npm `dsh-plugin` tag), but <strong>6+ marketplaces</strong> compete with no unified scoring, no compatibility matrix, no recipes. DSH Radar does the <strong>dirty work no one else does</strong>: continuous evaluation, compatibility matrix, recipes, head-to-head comparisons.',
      features: {
        radar: { title: '📊 Radar Scoring', desc: '5 dimensions: popularity / maintenance / quality / security / DSH compat' },
        search: { title: '🔍 Search + Filter', desc: 'Real-time filter 700+ plugins by name/keyword/grade/compat' },
        recipes: { title: '📖 Recipes', desc: 'Task → plugin combo → tested tips, community-built' },
        potholes: { title: '🚧 Pothole Wiki', desc: 'Aggregated GitHub Discussions / V2EX / linux.do gotchas' },
        compare: { title: '📊 Comparisons', desc: 'DSH vs BitFun vs Claude Code vs Cursor 6-dim radar' },
        subscribe: { title: '📬 Subscribe', desc: 'RSS / Atom / JSON Feed, weekly auto-delivery' },
        team: { title: '🚀 Team Edition 🚀', desc: 'Plugin allowlist + audit + private registry · $19/seat/mo' },
      },
    },
    lang: 'English',
  },
};

export function t(key, locale = 'zh-CN') {
  const l = dict[locale] || dict['zh-CN'];
  const keys = key.split('.');
  let cur = l;
  for (const k of keys) {
    if (cur && typeof cur === 'object' && k in cur) cur = cur[k];
    else return key;
  }
  return cur;
}

export function getLocale(Astro) {
  return Astro.currentLocale || 'zh-CN';
}

export function getAlternate(path, currentLocale) {
  // 简单的语言切换 URL
  if (currentLocale === 'zh-CN') return `/en${path === '/' ? '' : path}`;
  return path;  // 当前是英文，回中文
}
