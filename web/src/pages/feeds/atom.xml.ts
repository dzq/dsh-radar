import type { APIRoute } from 'astro';
import { loadJson } from '../../lib/paths.mjs';

export const GET: APIRoute = async ({ site }) => {
  const index = await loadJson('index.json');
  const stats = await loadJson('stats.json');

  const base = site?.toString().replace(/\/$/, '') || 'https://dsh.pub';

  const entries = index.plugins.slice(0, 30).map((p: any) => `
  <entry>
    <title>[${p.grade}] ${escape(p.name)} v${p.version}</title>
    <link href="${base}/plugins/${p.slug}"/>
    <id>${base}/plugins/${p.slug}</id>
    <updated>${new Date(p.last_publish || stats.generated_at).toISOString()}</updated>
    <summary>${escape(p.description || '')}</summary>
    <category term="grade-${p.grade}"/>
  </entry>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>DSH Radar</title>
  <link href="${base}"/>
  <link href="${base}/feeds/atom.xml" rel="self"/>
  <id>${base}/</id>
  <updated>${new Date(stats.generated_at).toISOString()}</updated>${entries}
</feed>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' },
  });
};

function escape(s: string): string {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));
}
