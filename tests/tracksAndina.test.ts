import { describe, expect, it } from 'vitest'
import { RacingBot } from '../src/ai/racingBot'
import { Route } from '../src/ai/route'
import { botDifficulties, defaultRubberBand, type BotDifficultyConfig } from '../src/config/bots'
import { defaultDrift } from '../src/config/drift'
import { defaultKartPhysics } from '../src/config/kartPhysics'
import { bogotaData, bogotaTheme } from '../src/config/tracks/bogotaTrack'
import { nevadoData, nevadoTheme } from '../src/config/tracks/nevadoTrack'
import { DEFAULT_THEME, type TrackTheme } from '../src/config/tracks/theme'
import { zipaquiraData, zipaquiraTheme } from '../src/config/tracks/zipaquiraTrack'
import { BotManager } from '../src/sim/botManager'
import { gridPose } from '../src/sim/racer'
import type { Vec2 } from '../src/sim/math'
import type { SurfaceType } from '../src/sim/race/surface'
import { Track, type HazardKind } from '../src/sim/track'
import { buildTrackDefinition, validateTrackData, type TrackData } from '../src/sim/trackData'
import { branchLength } from '../src/sim/trackSpline'
import { RaceWorld } from '../src/sim/world'

const DT = 1 / 60
const LAPS = 2
/** Shortest and longest loops that still feel like a Copa Andina circuit (m). */
const MIN_LOOP = 700
const MAX_LOOP = 1100
/** Steepest allowed slope along the main road (1.5 m per 10 m). */
const MAX_SLOPE = 0.15
/** Branches blend into the road height over a few meters, so they may be a bit steeper. */
const MAX_BRANCH_SLOPE = 0.18

interface SoloRun {
  finished: boolean
  lapTimes: number[]
  totalTime: number
  respawns: number
  /** Largest distance outside the corridor of the piece the kart is on (m); <= 0 when inside. */
  maxOutside: number
  /** Steps spent inside each branch. */
  branchSteps: number[]
  /** Closest approach to the middle of each branch (m). */
  closest: number[]
}

/** One bot alone on a track (the player sits parked on the grid), without rubber band. */
function runSolo(
  data: TrackData,
  skill: Partial<BotDifficultyConfig> = {},
  seed = 1,
  maxSeconds = 240,
): SoloRun {
  const world = new RaceWorld(buildTrackDefinition(data), defaultKartPhysics, defaultDrift, {
    totalLaps: LAPS,
    countdownSeconds: 0.5,
  })
  const manager = new BotManager(world, defaultKartPhysics, defaultDrift, {
    rubberBand: { ...defaultRubberBand, enabled: false },
  })
  manager.addBot(new RacingBot({ skill: { ...botDifficulties.normal, ...skill }, seed }))
  const racer = manager.getBotRacers()[0]
  if (!racer) throw new Error('missing bot')
  const track = world.track
  const middles = track.branches.map(
    (branch) => branch.points[Math.floor(branch.points.length / 2)],
  )
  const run: SoloRun = {
    finished: false,
    lapTimes: [],
    totalTime: 0,
    respawns: 0,
    maxOutside: -Infinity,
    branchSteps: track.branches.map(() => 0),
    closest: track.branches.map(() => Infinity),
  }
  let previous = { ...racer.kart.position }
  for (let step = 0; step < Math.ceil(maxSeconds / DT); step++) {
    manager.update(DT)
    const { position } = racer.kart
    const projection = track.project(position.x, position.z)
    run.maxOutside = Math.max(run.maxOutside, projection.distance - projection.halfWidth)
    if (projection.branch >= 0 && projection.distance <= projection.halfWidth) {
      run.branchSteps[projection.branch] = (run.branchSteps[projection.branch] ?? 0) + 1
    }
    if (Math.hypot(position.x - previous.x, position.z - previous.z) > 3) run.respawns++
    previous = { ...position }
    middles.forEach((middle, i) => {
      if (!middle) return
      const distance = Math.hypot(position.x - middle.x, position.z - middle.z)
      run.closest[i] = Math.min(run.closest[i] ?? Infinity, distance)
    })
    if (racer.race.state.phase === 'finished') {
      run.finished = true
      break
    }
  }
  run.lapTimes = [...racer.race.state.lapTimes]
  run.totalTime = racer.race.state.totalRaceTime
  return run
}

/** Length of the main road between two centerline samples, driving forward (m). */
function mainDistance(track: Track, from: number, to: number): number {
  const count = track.centerline.length
  let total = 0
  for (let i = from; i % count !== to; i = (i + 1) % count) {
    const a = track.point(i)
    const b = track.point(i + 1)
    total += Math.hypot(b.x - a.x, b.z - a.z)
  }
  return total
}

function themeFields(theme: TrackTheme): string[] {
  const keys: (keyof TrackTheme)[] = [
    'sky',
    'horizon',
    'fog',
    'fogNear',
    'fogFar',
    'ambientSky',
    'ambientGround',
    'ambientIntensity',
    'sun',
    'sunIntensity',
    'ground',
    'road',
    'wall',
    'curb',
    'decorations',
  ]
  return keys.filter((key) => theme[key] === undefined)
}

interface Andina {
  label: string
  data: TrackData
  theme: TrackTheme
  /** Indices of the branches a bot can drive (the ice tunnel is closed by a wall). */
  open: number[]
  /** Decorations the theme must contain. */
  decorations: string[]
  /** Surface of each branch, in order. */
  surfaces: SurfaceType[]
  /** Kind of each hazard, in order. */
  hazardKinds: HazardKind[]
  /** Centerline point where the cable car jump happens (Bogotá). */
  jump?: Vec2
}

const TRACKS: Andina[] = [
  {
    label: 'Nevado del Ruiz',
    data: nevadoData,
    theme: nevadoTheme,
    open: [0],
    decorations: ['snowPine', 'rock', 'fumarole'],
    surfaces: ['ice', 'asphalt'],
    hazardKinds: ['iceWall'],
  },
  {
    label: 'Catedral de Sal de Zipaquirá',
    data: zipaquiraData,
    theme: zipaquiraTheme,
    open: [0, 1],
    decorations: ['saltColumn'],
    surfaces: ['dirt', 'asphalt'],
    hazardKinds: ['rock', 'rock', 'rock', 'rock', 'rock'],
  },
  {
    label: 'Bogotá: La Candelaria y Monserrate',
    data: bogotaData,
    theme: bogotaTheme,
    open: [0],
    decorations: ['colonialHouse', 'pine'],
    surfaces: ['wood'],
    hazardKinds: [],
    jump: { x: 45, z: 100 },
  },
]

/** Distance from a point to an open polyline (m). */
function distanceToPolyline(point: Vec2, line: readonly Vec2[]): number {
  let best = Infinity
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]
    const b = line[i + 1]
    if (!a || !b) continue
    const abx = b.x - a.x
    const abz = b.z - a.z
    const lengthSquared = abx * abx + abz * abz || 1
    const t = Math.min(
      Math.max(((point.x - a.x) * abx + (point.z - a.z) * abz) / lengthSquared, 0),
      1,
    )
    best = Math.min(best, Math.hypot(point.x - a.x - abx * t, point.z - a.z - abz * t))
  }
  return best
}

describe.each(TRACKS)(
  '$label',
  ({ label, data, theme, open, decorations, surfaces, hazardKinds, jump }) => {
    const definition = buildTrackDefinition(data)
    const track = new Track(definition)
    const route = new Route(track)

    it('is a valid layout with the expected name and size', () => {
      expect(validateTrackData(data)).toEqual([])
      expect(data.name).toBe(label)
      expect(track.loopLength).toBeGreaterThanOrEqual(MIN_LOOP)
      expect(track.loopLength).toBeLessThanOrEqual(MAX_LOOP)
      expect(data.halfWidth).toBeGreaterThanOrEqual(8)
      expect(data.halfWidth).toBeLessThanOrEqual(10)
      expect(data.branches.length).toBeGreaterThanOrEqual(1)
    })

    it('has smooth ground that never gets near the fall respawn', () => {
      let steepest = 0
      track.centerline.forEach((point, i) => {
        const next = track.point(i + 1)
        const height = track.groundHeight(point.x, point.z)
        expect(height).toBeGreaterThan(-3)
        const run = Math.hypot(next.x - point.x, next.z - point.z)
        const rise = Math.abs(track.groundHeight(next.x, next.z) - height)
        steepest = Math.max(steepest, rise / run)
      })
      expect(steepest).toBeLessThan(MAX_SLOPE)
    })

    it('has every shortcut shorter than the road it skips, and drivable heights along it', () => {
      expect(route.junctions).toHaveLength(track.branches.length)
      track.branches.forEach((branch, i) => {
        const junction = route.junctions[i]
        if (!junction) throw new Error('missing junction')
        const skipped = mainDistance(track, junction.startIndex, junction.endIndex)
        expect(branchLength(branch), branch.name).toBeLessThan(skipped * 0.8)
        for (let s = 0; s + 1 < branch.points.length; s++) {
          const a = branch.points[s]
          const b = branch.points[s + 1]
          if (!a || !b) continue
          const rise = Math.abs(track.groundHeight(b.x, b.z) - track.groundHeight(a.x, a.z))
          expect(rise / Math.hypot(b.x - a.x, b.z - a.z), branch.name).toBeLessThan(
            MAX_BRANCH_SLOPE,
          )
        }
      })
    })

    it('only lets a shortcut skip the checkpoints it really bypasses', () => {
      const count = track.centerline.length
      const gates = track.checkpoints.map((gate) => ({
        gate,
        index: route.nearestMainIndex(gate.position),
      }))
      const inside = (index: number, start: number, end: number): boolean =>
        (index - start + count) % count < (end - start + count) % count
      // Optional gates are exactly those strictly inside a skipped stretch
      for (const { gate, index } of gates) {
        const skipped = route.junctions.some((j) => inside(index, j.startIndex, j.endIndex))
        if (gate.index === 0) expect(gate.mandatory).toBe(true)
        else expect(gate.mandatory, `gate ${gate.index}`).toBe(!skipped)
      }
      for (const junction of route.junctions) {
        // A mandatory gate close before and after every shortcut, and one skipped inside
        const before = gates.filter(
          ({ gate, index }) =>
            gate.mandatory &&
            mainDistance(track, index, junction.startIndex) < track.loopLength / 5 &&
            index !== junction.startIndex,
        )
        const after = gates.filter(
          ({ gate, index }) =>
            gate.mandatory && mainDistance(track, junction.endIndex, index) < track.loopLength / 5,
        )
        const skipped = gates.filter(({ index }) =>
          inside(index, junction.startIndex, junction.endIndex),
        )
        expect(before.length).toBeGreaterThan(0)
        expect(after.length).toBeGreaterThan(0)
        expect(skipped.length).toBeGreaterThan(0)
      }
    })

    it('places the 8 grid slots on the road, on the start straight', () => {
      for (let slot = 0; slot < 8; slot++) {
        const { position } = gridPose(track, slot)
        const projection = track.mainProjection(position.x, position.z)
        expect(projection.distance, `slot ${slot}`).toBeLessThan(
          track.halfWidth - defaultKartPhysics.radius,
        )
      }
    })

    it('has item boxes, uchuvas and a boost pad, and none of them on a branch or off the road', () => {
      expect(data.itemBoxRows.length).toBeGreaterThanOrEqual(3)
      expect(data.itemBoxRows.length).toBeLessThanOrEqual(5)
      for (const row of data.itemBoxRows) {
        expect(row.count).toBeGreaterThanOrEqual(3)
        expect(row.count).toBeLessThanOrEqual(4)
      }
      expect(data.uchuvaLines.length).toBeGreaterThanOrEqual(5)
      expect(data.uchuvaLines.length).toBeLessThanOrEqual(7)
      expect(track.boostPads.length).toBeGreaterThanOrEqual(1)
      const spots = [
        ...track.itemBoxes,
        ...track.uchuvas,
        ...track.boostPads.map((p) => p.position),
      ]
      for (const spot of spots) {
        expect(track.mainProjection(spot.x, spot.z).distance).toBeLessThan(track.halfWidth)
      }
    })

    it('makes each shortcut riskier than the road: other surface or narrower, as designed', () => {
      expect(track.branches.map((branch) => branch.surface)).toEqual(surfaces)
      track.branches.forEach((branch) => {
        const middle = branch.points[Math.floor(branch.points.length / 2)]
        if (!middle) throw new Error('empty branch')
        expect(branch.halfWidth, branch.name).toBeLessThan(track.halfWidth)
        expect(track.surfaceAt(middle.x, middle.z), branch.name).toBe(branch.surface)
      })
    })

    it('keeps hazards where they belong and out of the way of the main road', () => {
      expect(track.hazards.map((h) => h.kind)).toEqual(hazardKinds)
      for (const hazard of track.hazards) {
        const [spot] = hazard.path
        if (!spot) throw new Error('hazard without a path')
        expect(hazard.path).toHaveLength(1)
        expect(hazard.speed).toBe(0)
        const nearest = track.branches
          .map((candidate) => ({ candidate, d: distanceToPolyline(spot, candidate.points) }))
          .sort((a, b) => a.d - b.d)[0]
        const branch = nearest?.candidate
        if (!branch) throw new Error(`${hazard.kind} is not on a shortcut`)
        // Never so close to the main road that it bumps karts that did not take the shortcut
        expect(track.mainProjection(spot.x, spot.z).distance).toBeGreaterThan(
          track.halfWidth + hazard.radius,
        )
        const offset = distanceToPolyline(spot, branch.points)
        if (hazard.kind === 'iceWall') {
          // Closes the whole corridor
          expect(hazard.radius).toBeGreaterThanOrEqual(branch.halfWidth + 0.5)
          expect(offset).toBeLessThan(1)
        } else {
          // A boulder beside the line: the kart can pass it, but not without weaving
          expect(offset).toBeGreaterThan(hazard.radius + defaultKartPhysics.kartRadius + 0.5)
          expect(offset + hazard.radius).toBeLessThanOrEqual(branch.halfWidth + 0.1)
        }
      }
    })

    if (jump) {
      it('has a crest with a boost pad before it and nothing to collect on it', () => {
        const index = route.nearestMainIndex(jump)
        const ahead = (pad: Vec2): number => mainDistance(track, route.nearestMainIndex(pad), index)
        expect(
          track.boostPads.some((pad) => ahead(pad.position) > 20 && ahead(pad.position) < 70),
        ).toBe(true)
        const height = (back: number): number => {
          const point = track.point(index + Math.round(back / 2.7))
          return track.groundHeight(point.x, point.z)
        }
        expect(height(0)).toBeGreaterThan(height(-35))
        expect(height(0)).toBeGreaterThan(height(30) + 2)
        const spots = [...track.itemBoxes, ...track.uchuvas]
        for (const spot of spots) {
          const gap = Math.min(
            ahead(spot),
            mainDistance(track, index, route.nearestMainIndex(spot)),
          )
          expect(gap).toBeGreaterThan(40)
        }
      })
    }

    it('has a complete theme with its own palette', () => {
      expect(themeFields(theme)).toEqual([])
      expect(theme.decorations.length).toBeGreaterThan(0)
      for (const kind of decorations) {
        expect(theme.decorations.map((set) => set.kind)).toContain(kind)
      }
      expect(theme.fogFar).toBeGreaterThan(theme.fogNear)
      expect(theme.ground).not.toBe(DEFAULT_THEME.ground)
      expect(theme.sky).not.toBe(DEFAULT_THEME.sky)
      for (const other of TRACKS) {
        if (other.label !== label) expect(other.theme.ground).not.toBe(theme.ground)
      }
    })

    describe('RacingBot', () => {
      it('finishes two laps alone in a sane time, without respawns, inside the corridor', () => {
        const run = runSolo(data)
        const ideal = track.loopLength / defaultKartPhysics.maxSpeed
        expect(run.finished).toBe(true)
        expect(run.lapTimes).toHaveLength(LAPS)
        expect(run.totalTime).toBeLessThan(LAPS * 3 * ideal)
        expect(run.respawns).toBe(0)
        expect(run.maxOutside).toBeLessThanOrEqual(0.05)
      })

      it('finishes the laps on the main road when it never takes a shortcut', () => {
        const run = runSolo(data, { shortcutChance: 0 })
        expect(run.finished).toBe(true)
        expect(run.respawns).toBe(0)
        expect(run.maxOutside).toBeLessThanOrEqual(0.05)
        expect(run.branchSteps.every((steps) => steps === 0)).toBe(true)
      })

      it('completes the laps through the shortcuts when it always takes them', () => {
        const run = runSolo(data, { shortcutChance: 1, wanderAmplitude: 0 })
        expect(run.finished).toBe(true)
        expect(run.lapTimes).toHaveLength(LAPS)
        expect(run.respawns).toBe(0)
        expect(run.maxOutside).toBeLessThanOrEqual(0.05)
        for (const i of open) {
          expect(run.closest[i], `branch ${i} middle`).toBeLessThan(3)
          expect(run.branchSteps[i]).toBeGreaterThan(100)
        }
      })
    })
  },
)
