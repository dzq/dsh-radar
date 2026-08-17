#!/usr/bin/env node
// scripts/build-data.mjs
// 全量抓取 DSH 插件：npm search → metadata → 评分 → 输出 JSON
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
const LIMIT = Number(process.env.LIMIT || 0); // 0 = 全量

// ============== 步骤 1：npm search 全量抓取 ==============
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
    process.stdout.write(`\r  npm: ${all.length} packages…`);
    if (objects.length < size || (LIMIT > 0 && all.length >= LIMIT)) break;
    from += size;
    await sleep(100);
  }
  console.log();

  // 按周下载排，截到 LIMIT
  all.sort((a, b) => b._weekly - a._weekly);
  return LIMIT > 0 ? all.slice(0, LIMIT) : all;
}

// ============== 步骤 2：并行 npm metadata ==============
async function fetchPkgMeta(name) {
  const cacheFile = join(CACHE_DIR, 'pkg', `${slugify(name)}.json`);
  if (existsSync(cacheFile)) {
    return JSON.parse(await readFile(cacheFile, 'utf8'));
  }
  const url = `https://registry.npmjs.org/${encodeURIComponent(name).replace('%2F', '/')}`;
  const meta = await fetchJson(url, { skip404: true });
  if (!meta) return null;
  await mkdir(join(CACHE_DIR, 'pkg'), { recursive: true });
  await writeFile(cacheFile, JSON.stringify(meta));
  return meta;
}

// ============== 步骤 3：并行处理单个插件 ==============
async function processPlugin(hit, ghToken) {
  const meta = await fetchPkgMeta(hit.name);
  if (!meta) return null;

  const latest = getLatestVersion(meta);
  const ver = meta.versions?.[latest] || {};
  const readme = (meta.readme || '').slice(0, 800); // README 前 800 字符

  const merged = {
    name: hit.name,
    version: latest,
    description: (ver.description || hit.description || '').slice(0, 280),
    keywords: ver.keywords || hit.keywords || [],
    license: typeof ver.license === 'string' ? ver.license : hit.license,
    repository: ver.repository?.url || hit.links?.repository || '',
    homepage: ver.homepage || hit.links?.homepage || '',
    dsh: ver.dsh || null,
    engines: ver.engines || {},
    readme,
    publisher: ver.publisher || null,
    _weekly: hit._weekly,
  };

  // GitHub（低下载量跳过，节省 API 调用）
  let gh = null;
  const parsed = parseGhRepo(merged.repository);
  if (parsed && (ghToken || hit._weekly >= 100)) {
    gh = await fetchGhRepo(parsed.owner, parsed.repo, ghToken);
  }

  const scores = score(merged, gh || {});
  const slug = slugify(hit.name);

  return {
    slug,
    name: hit.name,
    version: latest,
    description: merged.description,
    keywords: merged.keywords.slice(0, 10),
    license: merged.license,
    repo: merged.repository,
    homepage: merged.homepage,
    npm: `https://www.npmjs.com/package/${hit.name}`,
    dsh_compat: !!merged.dsh,
    dsh_meta: merged.dsh || null,
    engines: merged.engines,
    readme: merged.readme,
    weekly_downloads: hit._weekly,
    last_publish: meta.time?.[latest] || null,
    created_at: meta.time?.created || null,
    gh: gh ? {
      full_name: gh.full_name,
      stars: gh.stargazers_count,
      open_issues: gh.open_issues_count,
      pushed_at: gh.pushed_at,
      archived: gh.archived,
      license: gh.license?.spdx_id || null,
    } : null,
    scores,
    updated_at: new Date().toISOString(),
  };
}

// ============== 步骤 4：GitHub repo ==============
async function fetchGhRepo(owner, repo, token) {
  if (!owner || !repo) return null;
  const cacheFile = join(CACHE_DIR, 'gh', `${owner}--${repo}.json`);
  if (existsSync(cacheFile)) {
    const cached = JSON.parse(await readFile(cacheFile, 'utf8'));
    if (cached.__notfound) return null;
    return cached;
  }
  await mkdir(join(CACHE_DIR, 'gh'), { recursive: true });
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const hdrs = token ? { Authorization: `Bearer ${token}` } : {};
  const data = await fetchJson(url, { headers: hdrs, skip404: true });
  if (!data) {
    await writeFile(cacheFile, JSON.stringify({ __notfound: true }));
    return null;
  }
  await writeFile(cacheFile, JSON.stringify(data));
  return data;
}

// ============== 主流程 ==============
async function main() {
  const t0 = Date.now();
  console.log('📡 DSH Radar — 全量构建');
  console.log(`   GitHub token: ${GH_TOKEN ? '✅' : '❌ (60 req/h)'}`);
  console.log(`   LIMIT: ${LIMIT > 0 ? LIMIT : '全量'}\n`);

  await mkdir(PLUGINS_DIR, { recursive: true });

  console.log('① Fetching npm search…');
  const hits = await fetchNpmSearch();
  console.log(`   → ${hits.length} packages\n`);

  console.log('② Fetching npm metadata + GitHub stats（并行）…');
  const plugins = [];
  let done = 0;

  // 并行：每次最多 8 个同时跑
  const CONCURRENCY = 8;
  for (let i = 0; i < hits.length; i += CONCURRENCY) {
    const batch = hits.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((hit) => processPlugin(hit, GH_TOKEN))
    );
    for (const p of results) {
      if (!p) { done++; continue; }
      plugins.push(p);
      await writeFile(join(PLUGINS_DIR, `${p.slug}.json`), JSON.stringify(p, null, 2));
    }
    done += batch.length;
    process.stdout.write(`\r  ${done}/${hits.length} processed, ${plugins.length} saved`);
    if (done >= hits.length) break;
  }
  console.log(`\n   → ${plugins.length} plugins scored\n`);

  console.log('③ Building index…');
  plugins.sort((a, b) => b.scores.overall - a.scores.overall);

  const stats = {
    total: plugins.length,
    by_grade: plugins.reduce((acc, p) => {
      acc[p.scores.grade] = (acc[p.scores.grade] || 0) + 1;
      return acc;
    }, {}),
    by_compat: plugins.filter((p) => p.dsh_compat).length,
    total_weekly_downloads: plugins.reduce((s, p) => s + p.weekly_downloads, 0),
    generated_at: new Date().toISOString(),
    build_ms: Date.now() - t0,
  };

  const index = {
    stats,
    plugins: plugins.map((p) => ({
      slug: p.slug, name: p.name, version: p.version,
      description: p.description, weekly_downloads: p.weekly_downloads,
      stars: p.gh?.stars || 0, grade: p.scores.grade,
      overall: p.scores.overall, dsh_compat: p.dsh_compat,
      last_publish: p.last_publish, keywords: p.keywords.slice(0, 5),
    })),
  };

  await writeFile(join(DATA_DIR, 'index.json'), JSON.stringify(index, null, 2));
  await writeFile(join(DATA_DIR, 'stats.json'), JSON.stringify(stats, null, 2));

  // 历史快照
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
