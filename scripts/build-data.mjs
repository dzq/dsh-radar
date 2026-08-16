#!/usr/bin/env node
// scripts/build-data.mjs
// 主入口：拉 npm → 拉 GitHub → 评分 → 输出 JSON
// 零依赖，Node ≥ 18

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { score, parseGhRepo } from './lib/score.mjs';
import { fetchJson, getLatestVersion, slugify, fmtDate, sleep } from './lib/format.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const PLUGINS_DIR = join(DATA_DIR, 'plugins');
const CACHE_DIR = join(DATA_DIR, '.cache');

const NPM_SEARCH_URL = 'https://registry.npmjs.org/-/v1/search';
const NPM_META_URL = (pkg) => `https://registry.npmjs.org/${encodeURIComponent(pkg).replace('%2F', '/')}`;
const GH_REPO_URL = (owner, repo) => `https://api.github.com/repos/${owner}/${repo}`;

const GH_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const HEADERS = GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {};

// ============== 步骤 1：拉 npm 搜索结果（分页） ==============
async function fetchNpmSearch() {
  const all = [];
  const size = 100;
  let from = 0;
  let total = Infinity;

  while (from < total) {
    const url = `${NPM_SEARCH_URL}?text=keywords:dsh-plugin&size=${size}&from=${from}`;
    const data = await fetchJson(url);
    total = data.total || 0;
    for (const obj of data.objects || []) {
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
        _monthly: obj.downloads?.monthly || 0,
        _searchScore: obj.searchScore,
      });
    }
    process.stdout.write(`\r  npm search: ${all.length}/${total}`);
    if ((data.objects || []).length < size) break;
    from += size;
    await sleep(200);
  }
  console.log();
  return all;
}

// ============== 步骤 2：拉单个包的完整 metadata（缓存） ==============
async function fetchPkgMeta(name) {
  const cacheFile = join(CACHE_DIR, 'pkg', `${slugify(name)}.json`);
  if (existsSync(cacheFile)) {
    return JSON.parse(await readFile(cacheFile, 'utf8'));
  }
  try {
    const meta = await fetchJson(NPM_META_URL(name));
    await mkdir(join(CACHE_DIR, 'pkg'), { recursive: true });
    await writeFile(cacheFile, JSON.stringify(meta));
    return meta;
  } catch (e) {
    console.warn(`  ⚠️  npm meta failed for ${name}: ${e.message}`);
    return null;
  }
}

// ============== 步骤 3：拉 GitHub repo 数据（缓存） ==============
async function fetchGhRepo(owner, repo) {
  if (!owner || !repo) return null;
  const cacheFile = join(CACHE_DIR, 'gh', `${owner}--${repo}.json`);
  if (existsSync(cacheFile)) {
    const cached = JSON.parse(await readFile(cacheFile, 'utf8'));
    if (cached.__notfound) return null;
    return cached;
  }
  await mkdir(join(CACHE_DIR, 'gh'), { recursive: true });
  try {
    const data = await fetchJson(GH_REPO_URL(owner, repo), { headers: HEADERS });
    await writeFile(cacheFile, JSON.stringify(data));
    return data;
  } catch (e) {
    // 404 等情况缓存 notfound 标记避免反复打
    await writeFile(cacheFile, JSON.stringify({ __notfound: true, status: e.message }));
    return null;
  }
}

// ============== 主流程 ==============
async function main() {
  const t0 = Date.now();
  console.log('📡 DSH Radar — data builder v0.1');
  console.log(`   GitHub token: ${GH_TOKEN ? '✅ yes' : '❌ no (60 req/h limit)'}\n`);

  await mkdir(PLUGINS_DIR, { recursive: true });

  const LIMIT = Number(process.env.LIMIT || process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || 0);

  console.log('① Fetching npm search results…');
  let searchHits = await fetchNpmSearch();
  console.log(`   → ${searchHits.length} packages found`);
  if (LIMIT > 0) {
    // 优先保留 weekly downloads 高的，再补齐其他
    searchHits.sort((a, b) => b._weekly - a._weekly);
    searchHits = searchHits.slice(0, LIMIT);
    console.log(`   → limited to top ${LIMIT} by downloads\n`);
  } else {
    console.log();
  }

  console.log('② Fetching npm metadata + GitHub stats…');
  const plugins = [];
  let ghCalls = 0;
  for (let i = 0; i < searchHits.length; i++) {
    const hit = searchHits[i];
    process.stdout.write(`\r  [${i + 1}/${searchHits.length}] ${hit.name.padEnd(40, ' ')}`);

    const meta = await fetchPkgMeta(hit.name);
    if (!meta) continue;

    const latest = getLatestVersion(meta);
    const ver = meta.versions?.[latest] || {};
    const merged = {
      ...hit,
      ...ver,
      time: meta.time,
      readme: (meta.readme || '').slice(0, 5000), // 截断 README 控制体积
      publisher: meta.versions?.[latest]?.publisher || ver.publisher,
    };

    const repoUrl = ver.repository?.url || hit.links?.repository || '';
    const parsed = parseGhRepo(repoUrl);
    let gh = null;
    if (parsed) {
      gh = await fetchGhRepo(parsed.owner, parsed.repo);
      if (gh) ghCalls++;
      // 控制 GitHub 调用：未认证时只对头部插件打
      if (!GH_TOKEN && hit._weekly < 50 && gh) {
        // 跳过冷门包的 GH 调用（节省 rate limit）
      }
      await sleep(GH_TOKEN ? 50 : 200);
    }

    const scores = score(merged, gh || {});

    const slug = slugify(hit.name);
    const plugin = {
      slug,
      name: hit.name,
      version: latest,
      description: (ver.description || hit.description || '').slice(0, 280),
      keywords: ver.keywords || hit.keywords || [],
      license: typeof ver.license === 'string' ? ver.license : (hit.license || ''),
      repo: repoUrl,
      homepage: ver.homepage || hit.links?.homepage || '',
      npm: `https://www.npmjs.com/package/${hit.name}`,
      dsh_compat: !!ver.dsh,
      dsh_meta: ver.dsh || null,
      engines: ver.engines || {},
      weekly_downloads: hit._weekly,
      monthly_downloads: hit._monthly,
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
  console.log(`\n   → ${plugins.length} plugins scored (${ghCalls} GitHub calls)\n`);

  console.log('③ Building index…');
  // 按 overall 排序
  plugins.sort((a, b) => b.scores.overall - a.scores.overall);

  // 统计
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

  // 保存本次构建的历史快照（用于 changelog 比对）
  const now = new Date();
  const histName = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}.json`;
  await mkdir(join(DATA_DIR, 'history'), { recursive: true });
  await writeFile(
    join(DATA_DIR, 'history', histName),
    JSON.stringify({ stats, top10: index.plugins.slice(0, 10) }, null, 2)
  );

  console.log('✅ Done!');
  console.log(`   ${stats.total} plugins · ${stats.by_grade.S || 0}S · ${stats.by_grade.A || 0}A · ${stats.by_grade.B || 0}B · ${stats.by_grade.C || 0}C · ${stats.by_grade.D || 0}D`);
  console.log(`   Total weekly downloads: ${stats.total_weekly_downloads.toLocaleString()}`);
  console.log(`   Build time: ${(stats.build_ms / 1000).toFixed(1)}s\n`);
}

main().catch((e) => {
  console.error('❌ Build failed:', e);
  process.exit(1);
});
