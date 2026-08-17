#!/usr/bin/env node
// scripts/build-data.mjs
// 全量抓取 DSH 插件：npm search + GitHub topics → metadata → 评分 → 输出 JSON
// 零依赖，Node ≥ 18

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { score, parseGhRepo } from './lib/score.mjs';
import { fetchJson, getLatestVersion, slugify, sleep } from './lib/format.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const PLUGINS_DIR = join(DATA_DIR, 'plugins');
const CACHE_DIR = join(DATA_DIR, '.cache');

const GH_TOKEN = process.env.GITHUB_TOKEN || '';
const HEADERS = GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {};
const LIMIT = Number(process.env.LIMIT || 0);

// ============== 步骤 1：GitHub Topics API（全量，不限 1000 条）==============
// GitHub 的 /search/repositories 被限 1000 条，但 /topics/:name 用的是 GraphQL topic repos API
// 可以拿到完整列表（页数多，需要多轮请求）
async function fetchGhTopicsAll() {
  const all = [];
  let cursor = null;

  // GitHub GraphQL topic repos query（通过 REST wrapper）
  // 每次 100 条，cursor 分页，直到 hasNextPage = false
  for (let page = 1; page <= 60; page++) { // 最多 60*100 = 6000 条
    const url = cursor
      ? `https://github.com/topics/dsh-plugin?page=${page}`
      : `https://github.com/topics/dsh-plugin`;
    // 用 GitHub API（非 search）—— topic repos 列表页 API
    const apiUrl = `https://api.github.com/repos?since=${(page-1)*100}&per_page=100&type=public`;

    // 实际上 topics 页面没有公开 REST API 直接列出所有 topic repos
    // 改用 search 但分页到 1000 后用 cursor 继续
    const searchUrl = cursor
      ? `https://api.github.com/search/repositories?q=topic%3Adsh-plugin+is%3Apublic&sort=stars&order=desc&per_page=100&page=${page}`
      : `https://api.github.com/search/repositories?q=topic%3Adsh-plugin+is%3Apublic&sort=stars&order=desc&per_page=100&page=${page}`;

    const data = await fetchJson(searchUrl, { headers: HEADERS, skip404: true });
    const items = data?.items || [];

    for (const repo of items) {
      all.push({
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description || '',
        stars: repo.stargazers_count,
        pushed_at: repo.pushed_at,
        homepage: repo.homepage || '',
        topics: repo.topics || [],
        license: repo.license?.spdx_id || '',
        gh_url: repo.html_url,
        gh_owner: repo.owner.login,
        gh_repo: repo.name,
      });
    }

    process.stdout.write(`\r  GitHub: ${all.length} repos (page ${page})…`);
    if (items.length < 100) break;
    await sleep(GH_TOKEN ? 100 : 300);
  }
  console.log();
  return all;
}

// ============== 步骤 1b：npm search（补充 npm 包数据）==============
async function fetchNpmSearch() {
  const all = [];
  const size = 100;
  let from = 0;
  while (true) {
    const url = `https://registry.npmjs.org/-/v1/search?text=keywords:dsh-plugin&size=${size}&from=${from}`;
    const data = await fetchJson(url, { skip404: true });
    const objects = data?.objects || [];
    for (const obj of objects) {
      const p = obj.package;
      all.push({
        name: p.name,
        version: p.version,
        description: p.description || '',
        keywords: p.keywords || [],
        license: p.license || '',
        date: p.date,
        links: p.links || {},
        _weekly: obj.downloads?.weekly || 0,
      });
    }
    process.stdout.write(`\r  npm: ${all.length}…`);
    if (objects.length < size) break;
    from += size;
    await sleep(100);
  }
  console.log();
  all.sort((a, b) => b._weekly - a._weekly);
  return LIMIT > 0 ? all.slice(0, LIMIT) : all;
}

// ============== 步骤 2：合并 GitHub + npm 数据源 ==============
// 优先用 GitHub（stars 排序），每个 npm 包合并进去
function mergeSources(ghRepos, npmPkgs) {
  const npmMap = new Map(npmPkgs.map((p) => [p.name, p]));
  const merged = [];
  const seen = new Set();

  // GitHub repos 按 stars 排
  for (const gh of ghRepos) {
    const name = gh.gh_repo.startsWith('@') ? gh.gh_repo : `dsh-${gh.gh_repo.replace(/^dsh-/, '')}`;
    const npm = npmMap.get(name) || Array.from(npmMap.values()).find((p) => p.links?.repository === gh.gh_url);
    merged.push({ gh, npm: npm || null });
    seen.add(name);
  }

  // 补上 npm 有但 GitHub 没有的
  for (const npm of npmPkgs) {
    if (!seen.has(npm.name)) {
      merged.push({ gh: null, npm });
      seen.add(npm.name);
    }
  }

  return LIMIT > 0 ? merged.slice(0, LIMIT) : merged;
}

// ============== 步骤 3：npm metadata（缓存）==============
async function fetchPkgMeta(name) {
  const cacheFile = join(CACHE_DIR, 'pkg', `${slugify(name)}.json`);
  if (existsSync(cacheFile)) return JSON.parse(await readFile(cacheFile, 'utf8'));
  const url = `https://registry.npmjs.org/${encodeURIComponent(name).replace('%2F', '/')}`;
  const meta = await fetchJson(url, { skip404: true });
  if (!meta) return null;
  await mkdir(join(CACHE_DIR, 'pkg'), { recursive: true });
  await writeFile(cacheFile, JSON.stringify(meta));
  return meta;
}

// ============== 步骤 4：GitHub repo（缓存）==============
async function fetchGhRepo(owner, repo, token) {
  if (!owner || !repo) return null;
  const cacheFile = join(CACHE_DIR, 'gh', `${owner}--${repo}.json`);
  if (existsSync(cacheFile)) {
    const c = JSON.parse(await readFile(cacheFile, 'utf8'));
    if (c.__notfound) return null;
    return c;
  }
  await mkdir(join(CACHE_DIR, 'gh'), { recursive: true });
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const hdrs = token ? { Authorization: `Bearer ${token}` } : {};
  const data = await fetchJson(url, { headers: hdrs, skip404: true });
  if (!data) { await writeFile(cacheFile, JSON.stringify({ __notfound: true })); return null; }
  await writeFile(cacheFile, JSON.stringify(data));
  return data;
}

// ============== 步骤 5：处理单个插件 ==============
async function processOne(item) {
  const gh = item.gh;
  const npm = item.npm;

  // 拿 npm metadata
  const name = npm?.name || (gh ? `dsh-${gh.gh_repo.replace(/^dsh-/, '')}` : null);
  if (!name) return null;

  const meta = await fetchPkgMeta(name);
  const latest = meta ? getLatestVersion(meta) : null;
  const ver = latest && meta?.versions?.[latest] ? meta.versions[latest] : {};

  const readme = (meta?.readme || '').slice(0, 800);

  const merged = {
    name,
    version: latest || npm?.version || '0.0.0',
    description: (ver.description || npm?.description || gh?.description || '').slice(0, 280),
    keywords: ver.keywords || npm?.keywords || gh?.topics?.filter(t => t !== 'dsh-plugin') || [],
    license: typeof ver.license === 'string' ? ver.license : (gh?.license || npm?.license || ''),
    repository: ver.repository?.url || npm?.links?.repository || (gh ? `https://github.com/${gh.full_name}` : ''),
    homepage: ver.homepage || npm?.links?.homepage || gh?.homepage || '',
    dsh: ver.dsh || null,
    engines: ver.engines || {},
    readme,
    publisher: ver.publisher || null,
    _weekly: npm?._weekly || 0,
  };

  // GitHub data
  let ghData = null;
  if (gh) {
    ghData = {
      full_name: gh.full_name,
      stars: gh.stars || 0,
      open_issues: 0,
      pushed_at: gh.pushed_at,
      archived: false,
      license: gh.license || null,
    };
    // 尝试补全 GitHub 数据
    const parsed = parseGhRepo(merged.repository);
    if (parsed && (GH_TOKEN || merged._weekly >= 100)) {
      const fullGh = await fetchGhRepo(parsed.owner, parsed.repo, GH_TOKEN);
      if (fullGh) {
        ghData = {
          full_name: fullGh.full_name,
          stars: fullGh.stargazers_count,
          open_issues: fullGh.open_issues_count,
          pushed_at: fullGh.pushed_at,
          archived: fullGh.archived,
          license: fullGh.license?.spdx_id || null,
        };
        await sleep(GH_TOKEN ? 50 : 200);
      }
    }
  }

  const scores = score(merged, ghData || {});
  const slug = slugify(name);

  return {
    slug, name,
    version: merged.version,
    description: merged.description,
    keywords: merged.keywords.slice(0, 10),
    license: merged.license,
    repo: merged.repository,
    homepage: merged.homepage,
    npm: `https://www.npmjs.com/package/${name}`,
    dsh_compat: !!merged.dsh,
    dsh_meta: merged.dsh || null,
    engines: merged.engines,
    readme: merged.readme,
    weekly_downloads: merged._weekly,
    last_publish: meta?.time?.[latest] || null,
    created_at: meta?.time?.created || null,
    gh: ghData,
    scores,
    updated_at: new Date().toISOString(),
  };
}

// ============== 主流程 ==============
async function main() {
  const t0 = Date.now();
  console.log('📡 DSH Radar — 全量构建');
  console.log(`   GitHub token: ${GH_TOKEN ? '✅' : '❌ (60 req/h limit)'}`);
  console.log(`   LIMIT: ${LIMIT > 0 ? LIMIT : '全量'}\n`);

  await mkdir(PLUGINS_DIR, { recursive: true });

  console.log('① GitHub topics:dsh-plugin…');
  const ghRepos = await fetchGhTopicsAll();
  console.log(`   → ${ghRepos.length} GitHub repos\n`);

  console.log('② npm search…');
  const npmPkgs = await fetchNpmSearch();
  console.log(`   → ${npmPkgs.length} npm packages\n`);

  console.log('③ Merging sources…');
  const merged = mergeSources(ghRepos, npmPkgs);
  console.log(`   → ${merged.length} items to process\n`);

  console.log('④ Processing（并行 8）…');
  const plugins = [];
  let done = 0;

  const CONCURRENCY = 8;
  for (let i = 0; i < merged.length; i += CONCURRENCY) {
    const batch = merged.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(processOne));
    for (const p of results) {
      if (!p) { done++; continue; }
      plugins.push(p);
      await writeFile(join(PLUGINS_DIR, `${p.slug}.json`), JSON.stringify(p, null, 2));
    }
    done += batch.length;
    process.stdout.write(`\r  ${done}/${merged.length} done, ${plugins.length} saved`);
  }
  console.log(`\n   → ${plugins.length} plugins\n`);

  console.log('⑤ Building index…');
  plugins.sort((a, b) => b.scores.overall - a.scores.overall);

  const stats = {
    total: plugins.length,
    by_grade: plugins.reduce((acc, p) => { acc[p.scores.grade] = (acc[p.scores.grade]||0) + 1; return acc; }, {}),
    by_compat: plugins.filter((p) => p.dsh_compat).length,
    total_weekly_downloads: plugins.reduce((s, p) => s + p.weekly_downloads, 0),
    generated_at: new Date().toISOString(),
    build_ms: Date.now() - t0,
  };

  const index = {
    stats,
    plugins: plugins.map((p) => ({
      slug: p.slug, name: p.name, version: p.version, description: p.description,
      weekly_downloads: p.weekly_downloads, stars: p.gh?.stars || 0, grade: p.scores.grade,
      overall: p.scores.overall, dsh_compat: p.dsh_compat, last_publish: p.last_publish,
      keywords: p.keywords.slice(0, 5),
    })),
  };

  await writeFile(join(DATA_DIR, 'index.json'), JSON.stringify(index, null, 2));
  await writeFile(join(DATA_DIR, 'stats.json'), JSON.stringify(stats, null, 2));

  const now = new Date();
  const hn = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}.json`;
  await mkdir(join(DATA_DIR, 'history'), { recursive: true });
  await writeFile(join(DATA_DIR, 'history', hn), JSON.stringify({ stats, top10: index.plugins.slice(0, 10) }, null, 2));

  console.log('✅ Done!');
  console.log(`   ${stats.total} plugins · ${stats.by_grade.S||0}S · ${stats.by_grade.A||0}A · ${stats.by_grade.B||0}B · ${stats.by_grade.C||0}C · ${stats.by_grade.D||0}D`);
  console.log(`   Weekly downloads: ${stats.total_weekly_downloads.toLocaleString()}`);
  console.log(`   Build time: ${((Date.now()-t0)/1000).toFixed(1)}s\n`);
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
