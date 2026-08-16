import type { APIRoute } from 'astro';
import { loadJson } from '../../lib/paths.mjs';

export const GET: APIRoute = async ({ site }) => {
  const index = await loadJson('index.json');
  const stats = await loadJson('stats.json');

  const base = site?.toString().replace(/\/$/, '') || 'https://dsh.pub';

  const items = index.plugins.slice(0, 30).map((p: any) => ({
    id: `${base}/plugins/${p.slug}`,
    url: `${base}/plugins/${p.slug}`,
    title: `[${p.grade}] ${p.name} v${p.version}`,
    content_text: p.description || '',
    summary: `Grade ${p.grade} (overall ${p.overall}) · ${p.weekly_downloads.toLocaleString()} dl/wk · ★${p.stars}`,
    date_published: new Date(p.last_publish || stats.generated_at).toISOString(),
    tags: [`grade-${p.grade}`, ...(p.keywords || []).slice(0, 3)],
  }));

  return new Response(JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1',
    title: 'DSH Radar',
    home_page_url: base,
    feed_url: `${base}/feeds/feed.json`,
    language: 'zh-CN',
    items,
  }), {
    headers: { 'Content-Type': 'application/feed+json; charset=utf-8' },
  });
};
