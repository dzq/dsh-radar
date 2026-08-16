#!/usr/bin/env node
// scripts/build-changelog.mjs
// 比对 data/history/ 里的历史快照，生成 changelog 数据

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HISTORY_DIR = join(__dirname, '..', 'data', 'history');
const OUT = join(__dirname, '..', 'data', 'changelog.json');

async function main() {
  await mkdir(HISTORY_DIR, { recursive: true });
  if (!existsSync(HISTORY_DIR)) {
    console.log('No history dir.');
    return;
  }
  const files = (await readdir(HISTORY_DIR))
    .filter((f) => f.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    await writeFile(OUT, JSON.stringify([], null, 2));
    console.log('No history files yet (changelog.json = []). Run build-data.mjs first.');
    return;
  }

  const snapshots = [];
  for (const f of files) {
    const data = JSON.parse(await readFile(join(HISTORY_DIR, f), 'utf8'));
    snapshots.push({ file: f, ...data });
  }

  const changelog = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];
    const delta = {
      file: curr.file,
      prev: prev.file,
      total_delta: curr.stats.total - prev.stats.total,
      grades: {
        S: (curr.stats.by_grade.S || 0) - (prev.stats.by_grade.S || 0),
        A: (curr.stats.by_grade.A || 0) - (prev.stats.by_grade.A || 0),
        B: (curr.stats.by_grade.B || 0) - (prev.stats.by_grade.B || 0),
        C: (curr.stats.by_grade.C || 0) - (prev.stats.by_grade.C || 0),
        D: (curr.stats.by_grade.D || 0) - (prev.stats.by_grade.D || 0),
      },
      downloads_delta: curr.stats.total_weekly_downloads - prev.stats.total_weekly_downloads,
      compat_delta: curr.stats.by_compat - prev.stats.by_compat,
      generated_at: curr.stats.generated_at,
    };

    // Top10 进/出
    const prevSlugs = new Set(prev.top10.map((p) => p.slug));
    const currSlugs = new Set(curr.top10.map((p) => p.slug));
    delta.top10_in = curr.top10.filter((p) => !prevSlugs.has(p.slug)).map((p) => p.name);
    delta.top10_out = prev.top10.filter((p) => !currSlugs.has(p.slug)).map((p) => p.name);

    changelog.push(delta);
  }

  // 反转：最新的在前
  changelog.reverse();

  await writeFile(
    OUT,
    JSON.stringify(changelog, null, 2)
  );

  console.log(`✅ changelog.json: ${changelog.length} 个历史快照对比`);
}

main().catch((e) => {
  console.error('❌ Changelog build failed:', e);
  process.exit(1);
});
