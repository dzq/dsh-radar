import type { APIRoute } from 'astro';
import { loadJson } from '../lib/paths.mjs';

export const GET: APIRoute = async ({ site }) => {
  const base = site?.toString().replace(/\/$/, '') || 'https://dsh.pub';
  const stats = await loadJson('stats.json');

  // 静态页面
  const staticUrls = [
    '',
    'plugins',
    'search',
    'recipes',
    'compare',
    'potholes',
    'subscribe',
    'team',
    'playground',
    'changelog',
  ].map((p) => ({
    loc: `${base}/${p}`,
    priority: p === '' ? 1.0 : 0.8,
    changefreq: p === '' || p === 'plugins' ? 'daily' : 'weekly',
  }));

  // 插件详情页（711 个）
  const index = await loadJson('index.json');
  const pluginUrls = index.plugins.map((p: any) => ({
    loc: `${base}/plugins/${p.slug}`,
    priority: p.grade === 'S' ? 0.9 : p.grade === 'A' ? 0.7 : 0.5,
    lastmod: p.last_publish || stats.generated_at,
    changefreq: 'weekly',
  }));

  const allUrls = [...staticUrls, ...pluginUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map((u) => `  <url>
    <loc>${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
