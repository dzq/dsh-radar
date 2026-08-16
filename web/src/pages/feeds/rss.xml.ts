import type { APIRoute } from 'astro';
import { loadJson } from '../../lib/paths.mjs';

export const GET: APIRoute = async ({ site }) => {
  const index = await loadJson('index.json');
  const stats = await loadJson('stats.json');
  const recipes = await loadJson('recipes.json');
  const potholes = await loadJson('potholes.json');
  const compare = await loadJson('compare.json');

  const base = site?.toString().replace(/\/$/, '') || 'https://dsh.pub';
  const items: any[] = [];

  // 最新 30 个插件
  index.plugins.slice(0, 30).forEach((p: any) => {
    items.push({
      title: `[${p.grade}] ${p.name} v${p.version}`,
      link: `${base}/plugins/${p.slug}`,
      guid: `${base}/plugins/${p.slug}`,
      pubDate: new Date(p.last_publish || stats.generated_at).toUTCString(),
      description: `<p>${escape(p.description || '')}</p>
        <ul>
          <li>Grade: <strong>${p.grade}</strong> (overall ${p.overall})</li>
          <li>Weekly downloads: <strong>${p.weekly_downloads.toLocaleString()}</strong></li>
          <li>GitHub stars: <strong>${p.stars}</strong></li>
          <li>DSH standard: ${p.dsh_compat ? '✅' : '—'}</li>
        </ul>
        <p><a href="${base}/plugins/${p.slug}">→ 查看详情与雷达图</a></p>`,
    });
  });

  // 最新配方
  recipes.slice(0, 5).forEach((r: any) => {
    items.push({
      title: `📝 配方：${r.title}`,
      link: `${base}/recipes#${r.id}`,
      guid: `${base}/recipes#${r.id}`,
      pubDate: new Date(r.submitted_at).toUTCString(),
      description: `<p><strong>任务：</strong>${escape(r.task)}</p>
        <p><strong>插件：</strong>${r.plugins.map((p: string) => `<code>${p}</code>`).join(', ')}</p>
        <p>${escape(r.why)}</p>`,
    });
  });

  // 最新踩坑
  potholes.slice(0, 5).forEach((p: any) => {
    items.push({
      title: `[${p.severity}] 踩坑：${p.title}`,
      link: `${base}/potholes#${p.id}`,
      guid: `${base}/potholes#${p.id}`,
      pubDate: new Date(p.submitted_at).toUTCString(),
      description: `<p><strong>症状：</strong>${escape(p.symptom)}</p>
        <p><strong>原因：</strong>${escape(p.cause)}</p>
        <p><strong>修复：</strong>${escape(p.fix)}</p>`,
    });
  });

  items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>DSH Radar — DeepSeek Harness 插件雷达</title>
  <link>${base}</link>
  <description>每周自动更新的 DSH 插件评分、配方、踩坑与对比</description>
  <language>zh-cn</language>
  <lastBuildDate>${new Date(stats.generated_at).toUTCString()}</lastBuildDate>
  <atom:link href="${base}/feeds/rss.xml" rel="self" type="application/rss+xml" xmlns:atom="http://www.w3.org/2005/Atom"/>
${items.map((it) => `  <item>
    <title>${escape(it.title)}</title>
    <link>${it.link}</link>
    <guid isPermaLink="false">${it.guid}</guid>
    <pubDate>${it.pubDate}</pubDate>
    <description><![CDATA[${it.description}]]></description>
  </item>`).join('\n')}
</channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};

function escape(s: string): string {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));
}
