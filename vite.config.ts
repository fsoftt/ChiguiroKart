import { defineConfig } from 'vitest/config'

export default defineConfig({
  // GitHub Pages serves the site from /<repo-name>/
  base: '/ChiguiroKart/',
  build: {
    // Game page, the track editor (/editor.html) and the character gallery (/characters.html)
    rollupOptions: {
      input: {
        main: new URL('index.html', import.meta.url).pathname,
        editor: new URL('editor.html', import.meta.url).pathname,
        characters: new URL('characters.html', import.meta.url).pathname,
      },
    },
    // Three.js (~500 kB minified) plus the post-processing passes and the game
    chunkSizeWarningLimit: 900,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // Whole-race simulations take a few seconds each and run in parallel files
    testTimeout: 20000,
  },
})
