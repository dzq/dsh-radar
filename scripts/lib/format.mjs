// scripts/lib/format.mjs
// 格式化 + 工具函数

export function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

export function daysAgo(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

export function fmtNum(n) {
  if (n == null) return '0';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 带重试的 fetch
 */
export async function fetchJson(url, opts = {}) {
  const { retries = 3, baseDelay = 500, headers = {} } = opts;
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'dsh-radar/0.1 (+https://dsh.pub)', ...headers },
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (i < retries - 1) await sleep(baseDelay * Math.pow(2, i));
    }
  }
  throw lastErr;
}

/**
 * 从 npm package metadata 提取 latest 版本号
 */
export function getLatestVersion(meta) {
  return meta['dist-tags']?.latest || Object.keys(meta.versions || {}).pop();
}

/**
 * slugify
 */
export function slugify(name) {
  return name.replace(/^@/, '').replace(/\//g, '--');
}
