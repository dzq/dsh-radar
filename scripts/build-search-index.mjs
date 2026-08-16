#!/usr/bin/env node
// scripts/build-search-index.mjs
// 生成客户端搜索索引（瘦 JSON，减小页面体积）

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const index = [];
const files = await readdir(join(DATA_DIR, 'plugins'));
for (const f of files.filter((x) => x.endsWith('.json'))) {
  const p = JSON.parse(await readFile(join(DATA_DIR, 'plugins', f), 'utf8'));
  index.push({
    s: p.slug,
    n: p.name,
    v: p.version,
    d: p.description || '',
    k: p.keywords || [],
    g: p.scores.grade,
    o: p.scores.overall,
    w: p.weekly_downloads,
    r: p.gh?.stars || 0,
    p: p.last_publish || null,
    c: p.dsh_compat ? 1 : 0,
    l: p.license || '',
  });
}

// 按 overall 排
index.sort((a, b) => b.o - a.o);

await writeFile(join(DATA_DIR, 'search-index.json'), JSON.stringify(index));
console.log(`✅ search-index.json: ${index.length} plugins (${(JSON.stringify(index).length / 1024).toFixed(1)} KB)`);
