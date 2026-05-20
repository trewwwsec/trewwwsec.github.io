import { defineConfig } from 'astro/config';

const base = process.env.SITE_BASE_PATH || '/';

export default defineConfig({
  site: process.env.SITE_URL || 'https://trewwwsec.github.io',
  base,
  trailingSlash: 'always',
});
