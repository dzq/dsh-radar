// src/lib/paths.mjs
// 统一数据路径解析，兼容 Astro build 的各种 __dirname 漂移
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 自动探测 data 目录绝对路径
 */
function findDataDir() {
  const candidates = [
    resolve(__dirname, '..', '..', '..', '..', 'data'),
    resolve(__dirname, '..', '..', '..', 'data'),
    resolve(__dirname, '..', '..', '..', '..', '..', 'data'),
    resolve(process.cwd(), '..', 'data'),
    resolve(process.cwd(), 'data'),
    resolve(process.cwd(), '..', '..', 'data'),
  ];
  for (const p of candidates) {
    if (existsSync(join(p, 'index.json'))) return p;
  }
  throw new Error(`Cannot locate data dir. Tried:\n${candidates.join('\n')}\nCWD: ${process.cwd()}`);
}

export const DATA_DIR = findDataDir();

export async function loadJson(rel) {
  return JSON.parse(await readFile(join(DATA_DIR, rel), 'utf8'));
}

export async function listPlugins() {
  const dir = join(DATA_DIR, 'plugins');
  return (await readdir(dir)).filter((f) => f.endsWith('.json'));
}
