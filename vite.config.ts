import { defineConfig } from 'vitest/config'

export default defineConfig({
  // GitHub Pages serves the site from /<repo-name>/
  base: '/ChiguiroKart/',
  build: {
    // Game page plus the track editor page (/editor.html)
    rollupOptions: {
      input: {
        main: new URL('index.html', import.meta.url).pathname,
        editor: new URL('editor.html', import.meta.url).pathname,
      },
    },
    // Three.js alone is ~500 kB minified (~130 kB gzip)
    chunkSizeWarningLimit: 700,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
