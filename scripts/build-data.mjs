#!/usr/bin/env node
// scripts/build-data.mjs
// 抓取 DSH 插件：GitHub search（Stars/仓库数据） + npm search（下载量/npm元数据）
// 零依赖，Node ≥ 18

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { score, parseGhRepo } from './lib/score.mjs';

// 加载 .env 到环境变量（.env 位于 dsh-radar/ 根目录）
try {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const idx = t.indexOf('=');
      if (idx < 0) continue;
      const k = t.slice(0, idx).trim(), v = t.slice(idx + 1).trim();
      if (k && !process.env[k]) process.env[k] = v;
    }
  }
} catch (_) {}

const GH_TOKEN = process.env.GITHUB_TOKEN || '';
import { fetchJson, getLatestVersion, slugify, sleep } from './lib/format.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const PLUGINS_DIR = join(DATA_DIR, 'plugins');
const CACHE_DIR = join(DATA_DIR, '.cache');

const HDR = GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {};
const LIMIT = Number(process.env.LIMIT || 0); // 0=全量

// ============== 步骤 1：GitHub search（Stars + 仓库数据）==============
// 无 token：60 req/h，1000 条上限；有 token：5000 req/h
async function fetchGhSearch() {
  const all = [];
  const perPage = 100;
  let page = 1;

  while (page <= 10) { // 最多 10*100=1000 条（GitHub search 硬上限）
    const q = encodeURIComponent('topic:dsh-plugin is:public');
    const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=${perPage}&page=${page}`;
    process.stdout.write(`\r  GitHub: ${all.length} repos (page ${page})…`);

    const data = await fetchJson(url, { headers: HDR, skip404: true });
    const items = data?.items || [];
    for (const r of items) {
      all.push({
        gh_id: r.id,
        name: r.name,
        full_name: r.full_name,
        description: r.description || '',
        stars: r.stargazers_count,
        forks: r.forks_count,
        pushed_at: r.pushed_at,
        homepage: r.homepage || '',
        topics: r.topics || [],
        license: r.license?.spdx_id || '',
        gh_url: r.html_url,
        gh_owner: r.owner.login,
        gh_repo: r.name,
        open_issues: r.open_issues_count,
        language: r.language,
        archived: r.archived,
      });
    }
    if (items.length < perPage) break;
    page++;
    await sleep(HDR ? 100 : 500);
  }
  console.log();
  return all;
}

// ============== 步骤 2：npm search（下载量 + 元数据）==============
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

// ============== 步骤 3：GitHub 仓库名搜索（纠正 npm repository 错误）==============
async function searchGhRepoByName(pkgName) {
  if (!pkgName || !GH_TOKEN) return null;
  // 去掉 @scope/ 前缀中的 @
  const searchName = pkgName.replace(/^@/, '').replace(/\//g, '--');
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(searchName + ' in:name')}&sort=stars&order=desc&per_page=5`;
  try {
    const data = await fetchJson(url, { headers: HDR, skip404: true });
    for (const r of data?.items || []) {
      // 优先选名字完全匹配的
      if (r.name.toLowerCase() === searchName.toLowerCase() ||
          r.name.toLowerCase() === pkgName.replace(/^@/, '').replace(/\//g, '-').toLowerCase()) {
        return r.html_url;
      }
    }
    // 其次选第一个
    if (data?.items?.[0]) return data.items[0].html_url;
  } catch (_) {}
  return null;
}

// ============== 步骤 4：npm metadata（缓存）==============
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

// ============== 步骤 4：GitHub repo 详情（缓存）==============
async function fetchGhRepo(owner, repo) {
  if (!owner || !repo) return null;
  const cacheFile = join(CACHE_DIR, 'gh', `${owner}--${repo}.json`);
  if (existsSync(cacheFile)) {
    const c = JSON.parse(await readFile(cacheFile, 'utf8'));
    if (c.__notfound) return null;
    return c;
  }
  await mkdir(join(CACHE_DIR, 'gh'), { recursive: true });
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const data = await fetchJson(url, { headers: HDR, skip404: true });
  if (!data) { await writeFile(cacheFile, JSON.stringify({ __notfound: true })); return null; }
  await writeFile(cacheFile, JSON.stringify(data));
  return data;
}

// ============== 步骤 5：合并来源，处理单个插件 ==============
async function processOne(gh, npmHit) {
  // 优先用 npm name，GitHub repo 名为备
  let name = npmHit?.name || null;
  if (!name && gh) {
    const repoName = gh.gh_repo;
    name = gh.gh_owner === 'dsh'
      ? repoName.startsWith('@') ? repoName : `dsh-${repoName.replace(/^dsh-/, '')}`
      : repoName.startsWith('@') ? `@${gh.gh_owner}/${repoName.replace(/^dsh-/, '')}` : `dsh-${repoName.replace(/^dsh-/, '')}`;
  }

  // npm metadata：查不到不致命，GitHub 数据足够就继续
  let meta = null;
  if (name) {
    meta = await fetchPkgMeta(name);
    if (meta) await sleep(80);
  }
  // gh 和 meta 都为 null 才无法创建插件
  if (!meta && !gh) return null;

  const latest = meta ? getLatestVersion(meta) : null;
  const ver = latest && meta?.versions?.[latest] ? meta.versions[latest] : {};
  const readme = (meta?.readme || '').slice(0, 800);

  const description = (ver.description || npmHit?.description || gh?.description || '').slice(0, 280);
  const keywords = (ver.keywords || npmHit?.keywords || gh?.topics?.filter(t => t !== 'dsh-plugin') || []).slice(0, 10);
  const license = typeof ver.license === 'string' ? ver.license : (gh?.license || npmHit?.license || '');

  // 优先用 npm 的 repository；如果指向 deepseek-harness 主仓库（不是插件自己的），用 GitHub 搜索纠正
  let repository = ver.repository?.url || npmHit?.links?.repository || (gh ? `https://github.com/${gh.full_name}` : '');
  if (name && repository.includes('deepseek-ai/deepseek-harness')) {
    const corrected = await searchGhRepoByName(name);
    if (corrected) repository = corrected;
  }

  // GitHub 详细数据（补充 stars/issues 等）
  let ghDetail = null;
  if (gh && (GH_TOKEN || (gh.stars || 0) >= 50)) {
    const parsed = parseGhRepo(repository);
    if (parsed) {
      ghDetail = await fetchGhRepo(parsed.owner, parsed.repo);
      if (ghDetail) await sleep(HDR ? 50 : 200);
    }
  }

  const stars = ghDetail?.stargazers_count ?? gh?.stars ?? 0;
  const ghFinal = ghDetail || (gh ? {
    full_name: gh.full_name,
    stars: gh.stars || 0,
    open_issues: gh.open_issues || 0,
    pushed_at: gh.pushed_at,
    archived: gh.archived || false,
    license: gh.license || null,
  } : null);

  const merged = {
    name: name || (gh ? `dsh-${gh.gh_repo}` : 'unknown'),
    version: latest || npmHit?.version || '0.0.0',
    description,
    keywords,
    license,
    repository,
    homepage: ver.homepage || npmHit?.links?.homepage || gh?.homepage || '',
    dsh: ver.dsh || null,
    engines: ver.engines || {},
    readme,
    publisher: ver.publisher || null,
    _weekly: npmHit?._weekly || 0,
  };

  const scores = score(merged, ghFinal || {});
  const slug = slugify(merged.name);

  return {
    slug,
    name: merged.name,
    version: merged.version,
    description: merged.description,
    keywords: merged.keywords,
    license: merged.license,
    repo: merged.repository,
    homepage: merged.homepage,
    npm: name ? `https://www.npmjs.com/package/${name}` : '',
    dsh_compat: !!merged.dsh,
    dsh_meta: merged.dsh || null,
    engines: merged.engines,
    readme: merged.readme,
    weekly_downloads: merged._weekly,
    monthly_downloads: meta?.downloads?.monthly || 0,
    last_publish: meta?.time?.[latest] || null,
    created_at: meta?.time?.created || null,
    gh: ghFinal ? {
      full_name: ghFinal.full_name,
      stars: stars, // 用局部变量 stars（兼容 stargazers_count）
      open_issues: ghFinal.open_issues || 0,
      pushed_at: ghFinal.pushed_at,
      archived: ghFinal.archived || false,
      license: ghFinal.license || null,
    } : null,
    scores,
    updated_at: new Date().toISOString(),
  };
}

// ============== 主流程 ==============
async function main() {
  const t0 = Date.now();
  console.log('📡 DSH Radar — 全量构建');
  console.log(`   GitHub token: ${GH_TOKEN ? '✅' : '❌ (60 req/h, 1000 条上限)'}`);
  console.log(`   LIMIT: ${LIMIT > 0 ? LIMIT : '全量'}\n`);

  await mkdir(PLUGINS_DIR, { recursive: true });

  console.log('① GitHub search: topic:dsh-plugin（Stars 数据源）…');
  const ghRepos = await fetchGhSearch();
  console.log(`   → ${ghRepos.length} GitHub repos\n`);

  console.log('② npm search: keywords:dsh-plugin（下载量数据源）…');
  const npmPkgs = await fetchNpmSearch();
  console.log(`   → ${npmPkgs.length} npm packages\n`);

  // 步骤 3：npm name → GitHub repo 匹配
  const npmByName = new Map(npmPkgs.map(p => [p.name, p]));
  const npmByGhUrl = new Map(
    npmPkgs.filter(p => p.links?.repository).map(p => [p.links.repository.replace(/^git\+/, '').replace(/\.git$/, ''), p])
  );

  // 构建处理列表：GitHub repos 优先，每个都尝试匹配 npm 数据
  const todo = [];
  const seen = new Set();

  // 先处理所有 GitHub repos
  for (const gh of ghRepos) {
    const repoUrl = `https://github.com/${gh.full_name}`;
    const npm = npmByName.get(gh.name) || npmByGhUrl.get(repoUrl) ||
      npmByGhUrl.get(repoUrl.replace('https://github.com/', 'git://github.com/'));
    todo.push({ gh, npm });
    seen.add(gh.name);
    seen.add(gh.full_name);
  }

  // 补上 npm 有但 GitHub 没有的
  for (const npm of npmPkgs) {
    if (!seen.has(npm.name)) {
      todo.push({ gh: null, npm });
      seen.add(npm.name);
    }
  }

  // 截到 LIMIT
  const batch = LIMIT > 0 ? todo.slice(0, LIMIT) : todo;
  console.log(`③ 处理 ${batch.length} 个插件（并行 8）…\n`);

  const plugins = [];
  let done = 0;
  const CONCURRENCY = 8;

  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const chunk = batch.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(item => processOne(item.gh, item.npm)));
    for (const p of results) {
      if (!p) { done++; continue; }
      plugins.push(p);
      await writeFile(join(PLUGINS_DIR, `${p.slug}.json`), JSON.stringify(p, null, 2));
    }
    done += chunk.length;
    process.stdout.write(`\r  ${done}/${batch.length} done, ${plugins.length} saved`);
  }
  console.log(`\n   → ${plugins.length} plugins\n`);

  console.log('④ Building index…');
  plugins.sort((a, b) => b.scores.overall - a.scores.overall);

  const stats = {
    total: plugins.length,
    by_grade: plugins.reduce((acc, p) => { acc[p.scores.grade] = (acc[p.scores.grade]||0)+1; return acc; }, {}),
    by_compat: plugins.filter(p => p.dsh_compat).length,
    total_weekly_downloads: plugins.reduce((s, p) => s + p.weekly_downloads, 0),
    generated_at: new Date().toISOString(),
    build_ms: Date.now() - t0,
  };

  const index = {
    stats,
    plugins: plugins.map(p => ({
      slug: p.slug, name: p.name, version: p.version, description: p.description,
      weekly_downloads: p.weekly_downloads, stars: p.gh?.stars || 0,
      grade: p.scores.grade, overall: p.scores.overall,
      dsh_compat: p.dsh_compat, last_publish: p.last_publish, keywords: p.keywords.slice(0, 5),
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

main().catch(e => { console.error('❌', e); process.exit(1); });
