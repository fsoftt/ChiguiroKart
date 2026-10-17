import { describe, expect, it } from 'vitest'
import { testPreset } from '../src/config/tracks/trackPresets'
import {
  addShortcut,
  deleteSelected,
  hitHandle,
  insertPointAt,
  moveSelected,
  parseBoxRows,
  parseOptionalGates,
  parseUchuvaLines,
} from '../src/editor/editorOps'
import { fitView, panBy, screenToWorld, worldToScreen, zoomAt } from '../src/editor/viewport'
import { validateTrackData } from '../src/sim/trackData'

describe('editorOps', () => {
  it('hits the closest handle and moves it', () => {
    const data = testPreset()
    const first = data.points[0]
    if (!first) throw new Error('no points')
    const hit = hitHandle(data, first.x + 0.5, first.z, 2)
    expect(hit).toEqual({ kind: 'point', index: 0 })
    moveSelected(data, hit, 5, 6)
    expect(data.points[0]).toMatchObject({ x: 5, z: 6 })
    expect(hitHandle(data, 1000, 1000, 2)).toBeNull()
  })

  it('inserts a point on the road between its neighbours and refuses off-road clicks', () => {
    const data = testPreset()
    const count = data.points.length
    const a = data.points[0]
    const b = data.points[1]
    if (!a || !b) throw new Error('no points')
    const inserted = insertPointAt(data, (a.x + b.x) / 2, (a.z + b.z) / 2)
    expect(inserted).toEqual({ kind: 'point', index: 1 })
    expect(data.points).toHaveLength(count + 1)
    expect(insertPointAt(data, 5000, 5000)).toBeNull()
  })

  it('deletes points but keeps the minimum', () => {
    const data = testPreset()
    expect(deleteSelected(data, { kind: 'point', index: 3 })).toBe(true)
    data.points.length = 4
    expect(deleteSelected(data, { kind: 'point', index: 0 })).toBe(false)
    expect(deleteSelected(data, null)).toBe(false)
  })

  it('adds a shortcut whose ends touch the road', () => {
    const data = testPreset()
    const selection = addShortcut(data)
    expect(selection).toEqual({ kind: 'branch', branch: 0, index: 1 })
    expect(validateTrackData(data).filter((m) => m.includes('atajo'))).toEqual([])
    expect(deleteSelected(data, { kind: 'branch', branch: 0, index: 1 })).toBe(true)
    expect(deleteSelected(data, { kind: 'branch', branch: 0, index: 1 })).toBe(false)
  })

  it('parses pickup text, skipping bad lines', () => {
    expect(parseBoxRows('0.1 4\nmal\n2 3\n0.5 0\n0.6 2')).toEqual([
      { at: 0.1, count: 4 },
      { at: 0.6, count: 2 },
    ])
    expect(parseUchuvaLines('0.5, 5, -3\n0.2 4')).toEqual([
      { at: 0.5, count: 5, offset: -3 },
      { at: 0.2, count: 4, offset: 0 },
    ])
    expect(parseOptionalGates('4, 5, 1, 99, x', 7)).toEqual([3, 4])
  })
})

describe('viewport', () => {
  it('roundtrips screen and world and keeps the cursor point fixed when zooming', () => {
    const view = { centerX: 10, centerZ: -20, scale: 3 }
    const world = screenToWorld(view, 800, 600, { x: 123, z: 456 })
    const back = worldToScreen(view, 800, 600, world)
    expect(back.x).toBeCloseTo(123)
    expect(back.z).toBeCloseTo(456)
    const zoomed = zoomAt(view, 800, 600, { x: 123, z: 456 }, -100)
    expect(zoomed.scale).toBeGreaterThan(view.scale)
    const same = screenToWorld(zoomed, 800, 600, { x: 123, z: 456 })
    expect(same.x).toBeCloseTo(world.x)
    expect(same.z).toBeCloseTo(world.z)
  })

  it('pans with the pointer and fits points', () => {
    const panned = panBy({ centerX: 0, centerZ: 0, scale: 2 }, 10, -4)
    expect(panned).toEqual({ centerX: -5, centerZ: 2, scale: 2 })
    const fitted = fitView(
      [
        { x: -50, z: -50 },
        { x: 50, z: 50 },
      ],
      800,
      600,
    )
    expect(fitted.centerX).toBe(0)
    expect(fitted.scale).toBeCloseTo(5.1)
  })
})
