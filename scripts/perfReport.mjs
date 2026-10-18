// Renderer budget report: draw calls, triangles, geometries and textures of every track at
// every quality, from four camera stations with 8 karts. Needs a dev server and Playwright
// (not a dependency of the project):
//
//   npx vite --port 5214 &
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs \
//     node scripts/perfReport.mjs [--url http://localhost:5214/ChiguiroKart/] [--json out.json]
//
// It prints a Markdown table (worst of the stations per track and quality) and exits with 1
// if a budget of `src/config/perfBudget.ts` is broken.
import { writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : fallback
}
const url = option('--url', 'http://localhost:5214/ChiguiroKart/')
const jsonPath = option('--json', null)
const onlyTrack = option('--track', null)
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')

const QUALITIES = ['low', 'medium', 'high']
const BUDGETS = { low: [150, 300000], medium: [250, 700000], high: [Infinity, Infinity] }

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 800, height: 450 } })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`)
})
const load = async () => {
  await page.goto(`${url}?stats=1&volumen=0`)
  await page.waitForFunction(() => Boolean(window.game), null, { timeout: 60000 })
}
await load()

const ids = (
  await page.evaluate(async () => {
    const m = await import('/ChiguiroKart/src/config/tracks/catalog.ts')
    return [...m.trackIds]
  })
).filter((id) => !onlyTrack || onlyTrack.split(',').includes(id))

/** One track and quality; a dev-server reload in the middle (HMR) restarts the page. */
async function measure(id, quality) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await page.evaluate(
        async ({ id, quality }) => {
          const game = window.game
          const { PERF_STATIONS } = await import('/ChiguiroKart/src/game/perfProbe.ts')
          const { resolveQuality } = await import('/ChiguiroKart/src/config/quality.ts')
          game.perfStart(id, quality)
          // Let the track build, the models skin and a few frames pass
          await new Promise((resolve) => setTimeout(resolve, 600))
          const out = PERF_STATIONS.map((fraction) => game.perfSample(fraction))
          const resolved = resolveQuality(quality, 3)
          return { out, resolved }
        },
        { id, quality },
      )
    } catch (error) {
      if (attempt >= 3) throw error
      await load()
    }
  }
}

const rows = []
for (const id of ids) {
  // A fresh page per track, so the texture and geometry counters do not carry the last track
  await load()
  for (const quality of QUALITIES) {
    const samples = await measure(id, quality)
    const worst = (key) => Math.max(...samples.out.map((s) => s[key]))
    rows.push({
      track: id,
      quality,
      drawCalls: worst('drawCalls'),
      triangles: worst('triangles'),
      geometries: worst('geometries'),
      textures: worst('textures'),
      shadowMap: samples.resolved.shadowMapSize,
      pixelRatio: samples.resolved.pixelRatio,
      stations: samples.out,
    })
    process.stderr.write(
      `${id} ${quality}: ${worst('drawCalls')} calls, ${worst('triangles')} tris\n`,
    )
  }
}
await browser.close()

const kilo = (n) => `${Math.round(n / 1000)}k`
const lines = [
  '| Pista | Calidad | Draw calls | Triángulos | Geometrías | Texturas | Sombra | Pixel ratio |',
  '|---|---|---:|---:|---:|---:|---:|---:|',
]
let broken = 0
for (const r of rows) {
  const [maxCalls, maxTris] = BUDGETS[r.quality]
  const over = r.drawCalls > maxCalls || r.triangles > maxTris
  if (over) broken++
  lines.push(
    `| ${r.track} | ${r.quality} | ${r.drawCalls}${r.drawCalls > maxCalls ? ' ⚠' : ''} | ${kilo(r.triangles)}${r.triangles > maxTris ? ' ⚠' : ''} | ${r.geometries} | ${r.textures} | ${r.shadowMap || 'blob'} | ${r.pixelRatio} |`,
  )
}
console.log(lines.join('\n'))
if (errors.length > 0) console.error(`\nErrors:\n${errors.join('\n')}`)
if (jsonPath) writeFileSync(jsonPath, JSON.stringify(rows, null, 2))
process.exit(broken > 0 || errors.length > 0 ? 1 : 0)
