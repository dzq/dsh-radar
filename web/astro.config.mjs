import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://dsh.pub',
  output: 'static',
  build: {
    format: 'directory',
  },
  server: {
    host: '0.0.0.0',
    port: 4321,
  },
  i18n: {
    defaultLocale: 'zh-CN',
    locales: ['zh-CN', 'en'],
    routing: {
      prefixDefaultLocale: false,  // 中文不带前缀 /，英文 /en/
    },
    fallback: {
      en: 'zh-CN',  // 英文页面 fallback 到中文（避免 404）
    },
  },
  vite: {
    server: {
      fs: { strict: false },
    },
  },
});
