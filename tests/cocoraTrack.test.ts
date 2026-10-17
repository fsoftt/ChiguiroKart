import { describe, expect, it } from 'vitest'
import { cocoraTrack } from '../src/config/tracks/cocoraTrack'
import { NEUTRAL_INPUT } from '../src/input/kartInput'
import { defaultDrift } from '../src/config/drift'
import { createKartState } from '../src/sim/kart/kartState'
import { RaceManager } from '../src/sim/race/raceManager'
import { Track } from '../src/sim/track'

describe('Valle de Cocora Track', () => {
  it('creates a valid closed track loop with multiple points', () => {
    const track = new Track(cocoraTrack)
    expect(track.centerline.length).toBeGreaterThan(150)
    expect(track.name).toBe('Valle de Cocora')
    expect(track.halfWidth).toBe(9)
  })

  it('provides ground height variation for hills and ramps', () => {
    const track = new Track(cocoraTrack)
    const startHeight = track.groundHeight(0, -100)
    const hillHeight = track.groundHeight(125, -45)
    expect(hillHeight).toBeGreaterThan(startHeight)
  })

  it('detects different surfaces (wood on bridge, mud on shortcut, grass offroad)', () => {
    const track = new Track(cocoraTrack)
    expect(track.surfaceAt(80, 75)).toBe('wood')
    expect(track.surfaceAt(-22, 100)).toBe('mud')
    expect(track.surfaceAt(300, 300)).toBe('grass')
  })

  it('has a mud branch whose middle is mud and drivable', () => {
    const track = new Track(cocoraTrack)
    const branch = track.branches[0]
    expect(branch?.surface).toBe('mud')
    expect(branch?.halfWidth).toBe(6)
    for (const point of branch?.points.slice(2, -2) ?? []) {
      expect(track.surfaceAt(point.x, point.z)).toBe('mud')
      const projection = track.project(point.x, point.z)
      expect(projection.branch).toBe(0)
      expect(projection.distance).toBeLessThan(0.001)
    }
  })

  it('no longer treats the old fake mud box as mud', () => {
    const track = new Track(cocoraTrack)
    // Inside the old box (x -50..10, z 80..125) but far from both corridors
    expect(track.surfaceAt(-25, 123)).toBe('grass')
    expect(track.surfaceAt(5, 85)).toBe('grass')
  })

  it('keeps the branch clear of the rest of the circuit away from the junctions', () => {
    const track = new Track(cocoraTrack)
    const branch = track.branches[0]
    const points = branch?.points ?? []
    for (let s = 0; s + 1 < points.length; s++) {
      const a = points[s]
      const b = points[s + 1]
      if (!a || !b) continue
      for (let u = 0; u <= 1; u += 0.1) {
        const x = a.x + (b.x - a.x) * u
        const z = a.z + (b.z - a.z) * u
        const fromEnds = Math.min(
          Math.hypot(x - (points[0]?.x ?? 0), z - (points[0]?.z ?? 0)),
          Math.hypot(
            x - (points[points.length - 1]?.x ?? 0),
            z - (points[points.length - 1]?.z ?? 0),
          ),
        )
        if (fromEnds < 30) continue
        expect(track.mainProjection(x, z).distance).toBeGreaterThan(9 + 6)
      }
    }
  })

  it('has no height steps along the branch', () => {
    const track = new Track(cocoraTrack)
    const points = track.branches[0]?.points ?? []
    let previous: number | undefined
    for (let s = 0; s + 1 < points.length; s++) {
      const a = points[s]
      const b = points[s + 1]
      if (!a || !b) continue
      for (let u = 0; u < 1; u += 0.05) {
        const h = track.groundHeight(a.x + (b.x - a.x) * u, a.z + (b.z - a.z) * u)
        if (previous !== undefined) expect(Math.abs(h - previous)).toBeLessThan(0.15)
        previous = h
      }
    }
  })

  it('makes the mud shortcut shorter than the hairpin it bypasses', () => {
    const track = new Track(cocoraTrack)
    const branch = track.branches[0]
    const points = branch?.points ?? []
    const length = (pts: readonly { x: number; z: number }[]) =>
      pts.reduce((sum, p, i) => {
        const prev = pts[i - 1]
        return prev ? sum + Math.hypot(p.x - prev.x, p.z - prev.z) : sum
      }, 0)
    const first = points[0]
    const last = points[points.length - 1]
    const start = track.centerline.findIndex((p) => p.x === first?.x && p.z === first?.z)
    const end = track.centerline.findIndex((p) => p.x === last?.x && p.z === last?.z)
    expect(start).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(start)
    const hairpin = length(track.centerline.slice(start, end + 1))
    expect(length(points)).toBeLessThan(hairpin * 0.8)
  })

  it('has mandatory checkpoints covering the full circuit, except the hairpin apex', () => {
    const checkpoints = cocoraTrack.checkpoints ?? []
    expect(checkpoints.length).toBeGreaterThanOrEqual(6)
    const optional = checkpoints.filter((c) => !c.mandatory)
    expect(optional.map((c) => c.index)).toEqual([3])
  })

  describe('lap through the mud shortcut', () => {
    /** Drives a scripted path by teleporting the kart along it in small steps. */
    function driveLap(useShortcut: boolean): RaceManager {
      const track = new Track(cocoraTrack)
      const manager = new RaceManager(cocoraTrack.checkpoints ?? [], {
        countdownSeconds: 0,
        totalLaps: 2,
      })
      const start = track.point(0)
      const kart = createKartState({ x: start.x - 3, y: 0, z: start.z }, 0)
      manager.update(kart, NEUTRAL_INPUT, defaultDrift, () => 0, 0.01)

      const branch = track.branches[0]
      const first = branch?.points[0]
      const last = branch?.points[(branch?.points.length ?? 1) - 1]
      const startIdx = track.centerline.findIndex((p) => p.x === first?.x && p.z === first?.z)
      const endIdx = track.centerline.findIndex((p) => p.x === last?.x && p.z === last?.z)

      const path: { x: number; z: number }[] = []
      for (let i = 1; i <= track.centerline.length; i++) {
        if (useShortcut && i > startIdx && i < endIdx) {
          if (i === startIdx + 1) path.push(...(branch?.points ?? []))
          continue
        }
        path.push(track.point(i))
      }
      for (const target of path) {
        const from = { x: kart.position.x, z: kart.position.z }
        const steps = Math.max(1, Math.ceil(Math.hypot(target.x - from.x, target.z - from.z) / 2))
        for (let s = 1; s <= steps; s++) {
          kart.position.x = from.x + ((target.x - from.x) * s) / steps
          kart.position.z = from.z + ((target.z - from.z) * s) / steps
          manager.update(kart, NEUTRAL_INPUT, defaultDrift, () => 0, 0.01)
        }
      }
      // Cross the finish line forward
      kart.position.x = start.x + 3
      manager.update(kart, NEUTRAL_INPUT, defaultDrift, () => 0, 0.01)
      return manager
    }

    it('completes a lap by taking the shortcut', () => {
      const manager = driveLap(true)
      expect(manager.state.passedMandatoryCheckpoints.has(3)).toBe(false)
      expect(manager.state.lapTimes.length).toBe(1)
    })

    it('also completes a lap around the hairpin', () => {
      const manager = driveLap(false)
      expect(manager.state.lapTimes.length).toBe(1)
    })
  })
})
