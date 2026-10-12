import { defineConfig } from 'vitest/config'

export default defineConfig({
  // GitHub Pages serves the site from /<repo-name>/
  base: '/ChiguiroKart/',
  build: {
    // Three.js alone is ~500 kB minified (~130 kB gzip)
    chunkSizeWarningLimit: 700,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
