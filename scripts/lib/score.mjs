// scripts/lib/score.mjs
// 5 维评分逻辑：popularity / maintenance / quality / security / dsh_compat
// 纯函数，无外部依赖

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = () => Date.now();

// log 归一化：将 downloads 映射到 0-100
// 假设 10000 weekly downloads ≈ 满分（实际 DSH 头部插件就这么高）
function logNormalize(value, ceiling = 10000) {
  if (!value || value <= 0) return 0;
  return Math.min(100, Math.round((Math.log10(value + 1) / Math.log10(ceiling + 1)) * 100));
}

// GitHub stars → popularity（stars 的 log 归一化，5000 ★ ≈ 满分）
function starsToPopularity(stars) {
  if (!stars || stars <= 0) return 0;
  return Math.min(100, Math.round((Math.log10(stars + 1) / Math.log10(5000 + 1)) * 100));
}

// 天数差→评分（越新越高，半年内高分，一年外衰减）
function recencyScore(isoDate, halfLifeDays = 180) {
  if (!isoDate) return 0;
  const ageDays = (NOW() - new Date(isoDate).getTime()) / MS_PER_DAY;
  if (ageDays < 0) return 100;
  return Math.max(0, Math.round(100 * Math.exp(-ageDays / halfLifeDays)));
}

/**
 * 计算单个插件的 5 维评分
 * @param {object} pkg - 从 npm registry 抓到的完整 metadata（含 time, keywords, dsh 字段等）
 * @param {object} gh - GitHub repo 信息（可选，{} 表示无）
 * @returns {object} scores + grade
 */
export function score(pkg, gh = {}) {
  // 1. Popularity: weekly downloads (log scale)；无 npm 下载时用 GitHub stars 替代
  const weekly = pkg._weekly ?? 0;
  // GitHub API 返回 stargazers_count，GitHub search 返回 stars
  const ghStars = gh?.stargazers_count ?? gh?.stars ?? 0;
  const popularity = weekly > 0 ? logNormalize(weekly) : (ghStars > 0 ? starsToPopularity(ghStars) : 0);

  // 2. Maintenance: latest publish + github last push，取加权平均
  const lastPublish = pkg.time?.[pkg['dist-tags']?.latest] || pkg.time?.modified;
  const mPublish = recencyScore(lastPublish, 120); // 4 个月内高分
  const mGh = recencyScore(gh.pushed_at, 90); // 3 个月内高分
  const maintenance = Math.round(mPublish * 0.6 + mGh * 0.4);

  // 3. Quality: README + keywords + license + description
  let q = 0;
  const desc = pkg.description || '';
  const readme = pkg.readme || '';
  const kws = pkg.keywords || [];
  const license = pkg.license || '';
  if (desc.length > 20) q += 15;
  if (desc.length > 60) q += 10;
  if (readme.length > 500) q += 20;
  if (readme.length > 3000) q += 15;
  if (kws.length >= 3) q += 10;
  if (kws.includes('dsh-plugin')) q += 10;
  if (license && license !== 'SEE LICENSE IN LICENSE.md') q += 10;
  if (gh.license?.spdx_id && gh.license.spdx_id !== 'NOASSERTION') q += 10;
  const quality = Math.min(100, q);

  // 4. Security: trustedPublisher + 签名 + 关键词审计
  let s = 50; // baseline
  const pub = pkg.publisher || {};
  if (pub.trustedPublisher?.oidcConfigId) s += 25;
  if (pub.username) s += 5;
  const lowerName = pkg.name.toLowerCase();
  const lowerDesc = (desc + ' ' + kws.join(' ')).toLowerCase();
  if (/audit|sandbox|permission|allowlist/.test(lowerDesc)) s += 15;
  // 风险关键词（仅扣分项）
  if (/eval|exec|child_process/.test(lowerDesc) && !/safe|sandbox/.test(lowerDesc)) s -= 10;
  if (gh.archived) s -= 30;
  const security = Math.max(0, Math.min(100, s));

  // 5. DSH Compatibility: package.json 含 dsh.* 字段 + engines
  let c = 30; // baseline（只要挂了 dsh-plugin 关键词就算）
  if (pkg.dsh && typeof pkg.dsh === 'object') c += 30;
  if (pkg.dsh?.bundle?.patch) c += 15;
  if (pkg.dsh?.client?.platform) c += 5;
  if (pkg.engines?.dsh) c += 10;
  if (pkg.peerDependencies?.['@deepseek-ai/dsh'] || pkg.dependencies?.['@deepseek-ai/dsh']) c += 10;
  // 检测 cordis patch 格式（DSH 标准）
  if (pkg.exports?.['./cordis.patch.yml']) c += 5;
  const dsh_compat = Math.min(100, c);

  const overall = Math.round(
    popularity * 0.25 +
    maintenance * 0.20 +
    quality * 0.20 +
    security * 0.15 +
    dsh_compat * 0.20
  );

  return {
    popularity,
    maintenance,
    quality,
    security,
    dsh_compat,
    overall,
    grade: gradeOf(overall),
  };
}

function gradeOf(score) {
  if (score >= 85) return 'S';
  if (score >= 70) return 'A';
  if (score >= 55) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

/**
 * 从 GitHub repo URL 提取 owner/repo
 */
export function parseGhRepo(url) {
  if (!url) return null;
  const m = String(url).match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git|\/|$)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, '') };
}
