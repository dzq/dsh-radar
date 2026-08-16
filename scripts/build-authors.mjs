#!/usr/bin/env node
// scripts/build-authors.mjs
// 聚合所有插件作者，生成 authors.json

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = join(__dirname, '..', 'data', 'plugins');

async function main() {
  const files = await readdir(PLUGINS_DIR);
  const authorMap = new Map();

  for (const f of files.filter((x) => x.endsWith('.json'))) {
    const p = JSON.parse(await readFile(join(PLUGINS_DIR, f), 'utf8'));
    const ghOwner = p.gh?.full_name?.split('/')[0] || null;
    const npmName = p.name.startsWith('@') ? p.name.split('/')[0].slice(1) : null;

    const handles = new Set();
    if (ghOwner) handles.add(ghOwner);
    if (npmName) handles.add(npmName);

    for (const handle of handles) {
      if (!authorMap.has(handle)) {
        authorMap.set(handle, {
          handle,
          plugins: [],
          total_stars: 0,
          total_weekly_dl: 0,
          avg_overall: 0,
          grades: { S: 0, A: 0, B: 0, C: 0, D: 0 },
        });
      }
      const a = authorMap.get(handle);
      a.plugins.push({
        slug: p.slug,
        name: p.name,
        grade: p.scores.grade,
        overall: p.scores.overall,
        stars: p.gh?.stars || 0,
        weekly_dl: p.weekly_downloads,
      });
      a.total_stars += p.gh?.stars || 0;
      a.total_weekly_dl += p.weekly_downloads;
      a.grades[p.scores.grade]++;
    }
  }

  const authors = [];
  for (const a of authorMap.values()) {
    a.avg_overall = Math.round(
      a.plugins.reduce((s, p) => s + p.overall, 0) / a.plugins.length
    );
    a.plugin_count = a.plugins.length;
    // 排序插件：按 overall
    a.plugins.sort((x, y) => y.overall - x.overall);
    // 找 GitHub URL
    const firstWithGh = a.plugins.find((p) => p.name.includes('/'));
    if (firstWithGh) {
      const slugMatch = a.plugins.find((p) => p.name.startsWith(`@${a.handle}/`));
      if (slugMatch) {
        const slugFile = slugMatch.slug;
        const meta = JSON.parse(await readFile(join(PLUGINS_DIR, `${slugFile}.json`), 'utf8'));
        if (meta.gh?.full_name) a.gh_url = `https://github.com/${meta.gh.full_name.split('/')[0]}`;
      }
    }
    if (!a.gh_url) a.gh_url = `https://github.com/${a.handle}`;
    a.npm_url = `https://www.npmjs.com/~${a.handle}`;
    authors.push(a);
  }

  // 排序：插件数降序
  authors.sort((x, y) => y.plugin_count - x.plugin_count || y.total_stars - x.total_stars);

  await writeFile(
    join(__dirname, '..', 'data', 'authors.json'),
    JSON.stringify(authors, null, 2)
  );

  console.log(`✅ authors.json: ${authors.length} 位作者`);
  // Top 10 摘要
  authors.slice(0, 5).forEach((a) => {
    console.log(`   @${a.handle}: ${a.plugin_count} 个插件 · ★${a.total_stars} · avg ${a.avg_overall}`);
  });
}

main().catch((e) => {
  console.error('❌ authors build failed:', e);
  process.exit(1);
});
