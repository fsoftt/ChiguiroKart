import { describe, expect, it } from 'vitest'
import { RacingBot } from '../src/ai/racingBot'
import { Route } from '../src/ai/route'
import { botDifficulties, type BotDifficultyConfig } from '../src/config/bots'
import { defaultDrift } from '../src/config/drift'
import { defaultKartPhysics } from '../src/config/kartPhysics'
import { barranquillaData, barranquillaTheme } from '../src/config/tracks/barranquillaTrack'
import { cartagenaData, cartagenaTheme } from '../src/config/tracks/cartagenaTrack'
import { ciudadPerdidaData, ciudadPerdidaTheme } from '../src/config/tracks/ciudadPerdidaTrack'
import { sanAndresData, sanAndresTheme } from '../src/config/tracks/sanAndresTrack'
import type { TrackTheme } from '../src/config/tracks/theme'
import { BotManager } from '../src/sim/botManager'
import type { Racer } from '../src/sim/racer'
import { gridPose } from '../src/sim/racer'
import { Track } from '../src/sim/track'
import { buildTrackDefinition, validateTrackData, type TrackData } from '../src/sim/trackData'
import { branchLength } from '../src/sim/trackSpline'
import { RaceWorld } from '../src/sim/world'
import { DT, rubberBandOff } from './helpers/botSim'

interface Circuit {
  data: TrackData
  theme: TrackTheme
  /** Half-width range the design brief asks for. */
  halfWidth: readonly [number, number]
}

const circuits: Record<string, Circuit> = {
  cartagena: { data: cartagenaData, theme: cartagenaTheme, halfWidth: [8, 10] },
  ciudadPerdida: { data: ciudadPerdidaData, theme: ciudadPerdidaTheme, halfWidth: [8, 10] },
  sanAndres: { data: sanAndresData, theme: sanAndresTheme, halfWidth: [8, 10] },
  barranquilla: { data: barranquillaData, theme: barranquillaTheme, halfWidth: [10, 11] },
}

const LAPS = 2
/** Largest ground height change (m) over 10 m of road. */
const MAX_GRADE = 1.5
/** Respawn height of the fall rule is -5; stay well above it. */
const MIN_HEIGHT = -3

interface SoloRun {
  finished: boolean
  lapTimes: number[]
  totalTime: number
  respawns: number
  maxOutside: number
  /** Steps spent inside each branch corridor, by branch index. */
  branchSteps: number[]
}

function solo(
  data: TrackData,
  skill: Partial<BotDifficultyConfig>,
  options: { low?: boolean; seed?: number } = {},
): SoloRun {
  const world = new RaceWorld(buildTrackDefinition(data), defaultKartPhysics, defaultDrift, {
    totalLaps: LAPS,
    countdownSeconds: 0.5,
  })
  world.track.setTideLow(options.low ?? false)
  const manager = new BotManager(world, defaultKartPhysics, defaultDrift, {
    rubberBand: rubberBandOff,
  })
  manager.addBot(
    new RacingBot({ skill: { ...botDifficulties.normal, ...skill }, seed: options.seed ?? 1 }),
  )
  const racer = manager.getBotRacers()[0] as Racer
  const run: SoloRun = {
    finished: false,
    lapTimes: [],
    totalTime: 0,
    respawns: 0,
    maxOutside: -Infinity,
    branchSteps: world.track.branches.map(() => 0),
  }
  let previous = { ...racer.kart.position }
  for (let step = 0; step < 60 * 240; step++) {
    manager.update(DT)
    const { position } = racer.kart
    const projection = world.track.project(position.x, position.z)
    run.maxOutside = Math.max(run.maxOutside, projection.distance - projection.halfWidth)
    if (projection.branch >= 0 && projection.distance <= projection.halfWidth) {
      run.branchSteps[projection.branch] = (run.branchSteps[projection.branch] ?? 0) + 1
    }
    if (Math.hypot(position.x - previous.x, position.z - previous.z) > 3) run.respawns++
    previous = { ...position }
    if (racer.race.state.phase === 'finished') {
      run.finished = true
      break
    }
  }
  run.lapTimes = [...racer.race.state.lapTimes]
  run.totalTime = racer.race.state.totalRaceTime
  return run
}

const cache = new Map<string, SoloRun>()
function cachedSolo(
  key: string,
  data: TrackData,
  skill: Partial<BotDifficultyConfig>,
  options: { low?: boolean } = {},
): SoloRun {
  const id = `${key}|${JSON.stringify(skill)}|${options.low ?? false}`
  let run = cache.get(id)
  if (!run) {
    run = solo(data, skill, options)
    cache.set(id, run)
  }
  return run
}

const NO_SHORTCUT = { shortcutChance: 0 }
const ALL_SHORTCUTS = { shortcutChance: 1 }

describe.each(Object.entries(circuits))('Copa Caribe: %s', (key, { data, theme, halfWidth }) => {
  const definition = buildTrackDefinition(data)
  const track = new Track(definition)
  const route = new Route(track)

  it('has a valid layout with a sane size, width and relief', () => {
    expect(validateTrackData(data)).toEqual([])
    expect(track.loopLength).toBeGreaterThanOrEqual(700)
    expect(track.loopLength).toBeLessThanOrEqual(1100)
    expect(data.halfWidth).toBeGreaterThanOrEqual(halfWidth[0])
    expect(data.halfWidth).toBeLessThanOrEqual(halfWidth[1])

    let lowest = Infinity
    let steepest = 0
    for (let i = 0; i < track.centerline.length; i++) {
      const a = track.point(i)
      const b = track.point(i + 5)
      const ya = track.groundHeight(a.x, a.z)
      const yb = track.groundHeight(b.x, b.z)
      lowest = Math.min(lowest, ya)
      steepest = Math.max(steepest, (Math.abs(yb - ya) / Math.hypot(b.x - a.x, b.z - a.z)) * 10)
    }
    expect(lowest).toBeGreaterThanOrEqual(MIN_HEIGHT)
    expect(steepest).toBeLessThanOrEqual(MAX_GRADE)
  })

  it('has a complete theme', () => {
    const colors = [
      theme.sky,
      theme.horizon,
      theme.fog,
      theme.ambientSky,
      theme.ambientGround,
      theme.sun,
      theme.ground,
      theme.road,
      theme.wall,
      ...theme.curb,
    ]
    for (const color of colors) expect(color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(theme.fogFar).toBeGreaterThan(theme.fogNear)
    expect(theme.ambientIntensity).toBeGreaterThan(0)
    expect(theme.sunIntensity).toBeGreaterThan(0)
    expect(theme.decorations.length).toBeGreaterThanOrEqual(2)
    for (const set of theme.decorations) expect(set.count).toBeGreaterThan(0)
  })

  it('has 3 to 5 rows of 3 or 4 power boxes, 5 to 7 uchuva lines and a boost pad', () => {
    expect(data.itemBoxRows.length).toBeGreaterThanOrEqual(3)
    expect(data.itemBoxRows.length).toBeLessThanOrEqual(5)
    for (const row of data.itemBoxRows) expect([3, 4]).toContain(row.count)
    expect(data.uchuvaLines.length).toBeGreaterThanOrEqual(5)
    expect(data.uchuvaLines.length).toBeLessThanOrEqual(7)
    expect(definition.boostPads?.length ?? 0).toBeGreaterThanOrEqual(1)
  })

  it('keeps pickups, boost pads and the grid on the road', () => {
    for (const spot of [...track.itemBoxes, ...track.uchuvas]) {
      const projection = track.mainProjection(spot.x, spot.z)
      expect(projection.distance).toBeLessThan(data.halfWidth - 1)
    }
    track.boostPads.forEach((pad, i) => {
      // A pad on a shortcut must fit inside that shortcut instead
      const branch = track.branches.find((b) => b.name === data.boostPads?.[i]?.branch)
      const projection = branch
        ? track.project(pad.position.x, pad.position.z)
        : track.mainProjection(pad.position.x, pad.position.z)
      expect(projection.distance + pad.width / 2).toBeLessThan(branch?.halfWidth ?? data.halfWidth)
    })
    for (let slot = 0; slot < 8; slot++) {
      const { position } = gridPose(track, slot)
      const projection = track.project(position.x, position.z)
      expect(projection.branch, `slot ${slot}`).toBe(-1)
      expect(projection.distance, `slot ${slot}`).toBeLessThan(
        data.halfWidth - defaultKartPhysics.radius,
      )
    }
  })

  it('has shortcuts shorter than the road they skip, with only skipped gates optional', () => {
    expect(track.branches.length).toBeGreaterThanOrEqual(1)
    const count = track.centerline.length
    const optional = new Set(data.checkpoints.optional)
    const skippedGates = new Set<number>()
    track.branches.forEach((branch, i) => {
      const junction = route.junctions[i]
      if (!junction) throw new Error('missing junction')
      const skipped = route.mainDistanceAhead(junction.startIndex, junction.endIndex)
      expect(branchLength(branch), branch.name).toBeLessThan(skipped * 0.85)
      track.checkpoints.forEach((_gate, gate) => {
        const index = Math.floor((gate * count) / track.checkpoints.length)
        const inside =
          route.mainDistanceAhead(junction.startIndex, index) <
            route.mainDistanceAhead(junction.startIndex, junction.endIndex) &&
          index !== junction.startIndex
        if (inside) skippedGates.add(gate)
      })
    })
    // Every gate a shortcut skips must be optional, and no other gate may be
    for (const gate of skippedGates) expect(optional.has(gate), `gate ${gate}`).toBe(true)
    for (const gate of optional) expect(skippedGates.has(gate), `gate ${gate}`).toBe(true)
  })

  it('is driven by a bot for two laps without respawns or leaving the corridor', () => {
    const run = cachedSolo(key, data, NO_SHORTCUT, { low: true })
    expect(run.finished).toBe(true)
    expect(run.lapTimes).toHaveLength(LAPS)
    expect(run.respawns).toBe(0)
    expect(run.maxOutside).toBeLessThanOrEqual(0.05)
    expect(run.totalTime).toBeLessThan(
      (LAPS * track.loopLength * 1.8) / defaultKartPhysics.maxSpeed,
    )
  })

  it('is driven through every shortcut for two laps when the bot always takes them', () => {
    const run = cachedSolo(key, data, ALL_SHORTCUTS, { low: true })
    expect(run.finished).toBe(true)
    expect(run.respawns).toBe(0)
    expect(run.maxOutside).toBeLessThanOrEqual(0.05)
    run.branchSteps.forEach((steps, i) => {
      expect(steps, track.branches[i]?.name).toBeGreaterThan(60)
    })
  })

  it('is quicker through the shortcuts than around them', () => {
    const taken = cachedSolo(key, data, ALL_SHORTCUTS, { low: true })
    const skipped = cachedSolo(key, data, NO_SHORTCUT, { low: true })
    expect(taken.totalTime).toBeLessThan(skipped.totalTime)
  })
})

describe('San Andrés tide', () => {
  const track = new Track(buildTrackDefinition(sanAndresData))
  const tidal = track.branches.findIndex((branch) => branch.tide !== undefined)
  const sandbank = track.branches[tidal]
  const middle = sandbank?.points[Math.floor((sandbank.points.length - 1) / 2)]

  it('has a sandbank branch that only shows on lap 2', () => {
    expect(sandbank?.tide).toEqual({ lowLaps: [2], lowSurface: 'sand', highSurface: 'water' })
  })

  it('is water at high tide and sand at low tide', () => {
    if (!middle) throw new Error('missing sandbank')
    expect(track.surfaceAt(middle.x, middle.z)).toBe('water')
    track.setTideLow(true)
    expect(track.surfaceAt(middle.x, middle.z)).toBe('sand')
    track.setTideLow(false)
    expect(track.surfaceAt(middle.x, middle.z)).toBe('water')
  })

  it('keeps bots on the road at high tide, even when they want the shortcut', () => {
    const run = cachedSolo('sanAndres', sanAndresData, ALL_SHORTCUTS)
    expect(run.finished).toBe(true)
    expect(run.respawns).toBe(0)
    expect(run.maxOutside).toBeLessThanOrEqual(0.05)
    expect(run.branchSteps[tidal] ?? 0).toBe(0)
  })

  it('has a sea plane below the road and a road above it', () => {
    const level = sanAndresTheme.water?.level
    expect(level).toBeDefined()
    expect(level ?? 0).toBeLessThan(0)
    for (let i = 0; i < track.centerline.length; i++) {
      const p = track.point(i)
      expect(track.groundHeight(p.x, p.z)).toBeGreaterThan(level ?? 0)
    }
  })

  it('has beach sections on the road', () => {
    const sandy = track.centerline.filter((p) => track.surfaceAt(p.x, p.z) === 'sand')
    expect(sandy.length).toBeGreaterThan(track.centerline.length * 0.1)
  })
})

describe('Carnaval de Barranquilla floats', () => {
  const definition = buildTrackDefinition(barranquillaData)
  const track = new Track(definition)

  it('has floats that follow the road and always leave room to pass', () => {
    const floats = track.hazards.filter((hazard) => hazard.kind === 'float')
    expect(floats.length).toBeGreaterThanOrEqual(1)
    for (const hazard of floats) {
      expect(hazard.motion).toBe('loop')
      expect(hazard.count).toBe(2)
      for (const p of hazard.path) {
        const projection = track.mainProjection(p.x, p.z)
        // Its footprint stays inside the road and leaves a lane several karts wide free
        expect(projection.distance + hazard.radius).toBeLessThan(track.halfWidth)
        expect(track.halfWidth * 2 - hazard.radius * 2).toBeGreaterThan(8)
      }
    }
  })
})
