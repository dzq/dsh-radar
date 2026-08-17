#!/usr/bin/env node
// scripts/build-data.mjs
// 主入口：npm search → metadata → 评分 → 输出 JSON
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

// ============== 步骤 1：npm search 分页抓取 ==============
async function fetchNpmSearch(limit) {
  const all = [];
  const size = 100;
  let from = 0;

  while (all.length < limit) {
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
    if (objects.length < size) break;
    from += size;
    await sleep(150);
  }
  console.log();
  // 按下载量排，截到 limit
  all.sort((a, b) => b._weekly - a._weekly);
  return all.slice(0, limit);
}

// ============== 步骤 2：npm metadata（缓存，404 直接跳过） ==============
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

// ============== 步骤 3：GitHub repo（缓存） ==============
async function fetchGhRepo(owner, repo) {
  if (!owner || !repo) return null;
  const cacheFile = join(CACHE_DIR, 'gh', `${owner}--${repo}.json`);
  if (existsSync(cacheFile)) {
    const cached = JSON.parse(await readFile(cacheFile, 'utf8'));
    if (cached.__notfound) return null;
    return cached;
  }
  await mkdir(join(CACHE_DIR, 'gh'), { recursive: true });
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const data = await fetchJson(url, { headers: HEADERS, skip404: true });
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
  const LIMIT = Number(process.env.LIMIT || 50);

  console.log('📡 DSH Radar — data builder');
  console.log(`   GitHub token: ${GH_TOKEN ? '✅ yes' : '❌ no (60 req/h)'}`);
  console.log(`   Daily limit: ${LIMIT} plugins\n`);

  await mkdir(PLUGINS_DIR, { recursive: true });

  console.log('① Fetching npm search…');
  const hits = await fetchNpmSearch(LIMIT);
  console.log(`   → ${hits.length} packages\n`);

  console.log('② Fetching npm metadata + GitHub stats…');
  const plugins = [];
  let ghCalls = 0;

  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i];
    process.stdout.write(`\r  [${i + 1}/${hits.length}] ${hit.name.padEnd(45)}`);

    const meta = await fetchPkgMeta(hit.name);
    if (!meta) {
      process.stdout.write(` ${hit.name} not on npm, skipping\n`);
      continue;
    }

    const latest = getLatestVersion(meta);
    const ver = meta.versions?.[latest] || {};
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
      readme: (meta.readme || '').slice(0, 4000),
      publisher: ver.publisher || null,
      _weekly: hit._weekly,
    };

    // GitHub
    const parsed = parseGhRepo(merged.repository);
    let gh = null;
    if (parsed) {
      gh = await fetchGhRepo(parsed.owner, parsed.repo);
      if (gh) ghCalls++;
      // 无 token 时对低下载量包跳过 GH 调用
      const shouldSkipGh = !GH_TOKEN && hit._weekly < 100 && gh;
      await sleep(GH_TOKEN ? 50 : 200);
    }

    const scores = score(merged, gh || {});
    const slug = slugify(hit.name);

    const plugin = {
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

    plugins.push(plugin);
    await writeFile(join(PLUGINS_DIR, `${slug}.json`), JSON.stringify(plugin, null, 2));
  }

  console.log(`\n   → ${plugins.length} plugins scored (${ghCalls} GH calls)\n`);

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
      slug: p.slug,
      name: p.name,
      version: p.version,
      description: p.description,
      weekly_downloads: p.weekly_downloads,
      stars: p.gh?.stars || 0,
      grade: p.scores.grade,
      overall: p.scores.overall,
      dsh_compat: p.dsh_compat,
      last_publish: p.last_publish,
      keywords: p.keywords.slice(0, 5),
    })),
  };

  await writeFile(join(DATA_DIR, 'index.json'), JSON.stringify(index, null, 2));
  await writeFile(join(DATA_DIR, 'stats.json'), JSON.stringify(stats, null, 2));

  // 历史快照
  const now = new Date();
  const histName = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}.json`;
  await mkdir(join(DATA_DIR, 'history'), { recursive: true });
  await writeFile(
    join(DATA_DIR, 'history', histName),
    JSON.stringify({ stats, top10: index.plugins.slice(0, 10) }, null, 2)
  );

  console.log('✅ Done!');
  console.log(`   ${stats.total} plugins · ${stats.by_grade.S||0}S · ${stats.by_grade.A||0}A · ${stats.by_grade.B||0}B · ${stats.by_grade.C||0}C · ${stats.by_grade.D||0}D`);
  console.log(`   Weekly downloads: ${stats.total_weekly_downloads.toLocaleString()}`);
  console.log(`   Build time: ${(stats.build_ms / 1000).toFixed(1)}s\n`);
}

main().catch((e) => {
  console.error('❌ Build failed:', e);
  process.exit(1);
});
