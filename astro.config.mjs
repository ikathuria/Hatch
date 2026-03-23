// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare({ configPath: './wrangler.toml' }),
  // Avoid two dev servers (e.g. 4321 + 4322): stale instance → "Expected miniflare to be defined"
  server: {
    port: 4321,
    strictPort: true
  },
  vite: {
    plugins: [tailwindcss()],
    // Miniflare persists D1/KV under .wrangler/state; watching it triggers full reloads and can
    // leave deps_ssr modules (e.g. @astrojs/cloudflare server entry) undefined — especially after API calls.
    server: {
      watch: {
        ignored: ['**/.wrangler/**']
      }
    }
  }
});
