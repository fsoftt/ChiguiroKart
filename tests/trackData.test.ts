import { describe, expect, it } from 'vitest'
import { cocoraPreset, testPreset } from '../src/config/tracks/trackPresets'
import { Track } from '../src/sim/track'
import {
  buildTrackDefinition,
  cloneTrackData,
  loopSelfIntersects,
  parseTrackData,
  parseTrackDataText,
  validateTrackData,
  type TrackData,
} from '../src/sim/trackData'

function squareTrack(): TrackData {
  return {
    version: 1,
    name: 'Cuadrado',
    halfWidth: 8,
    samplesPerSegment: 8,
    points: [
      { x: 0, z: 0, y: 0 },
      { x: 100, z: 0, y: 2 },
      { x: 100, z: 100, y: 4, surface: 'wood' },
      { x: 0, z: 100, y: 2 },
    ],
    branches: [],
    checkpoints: { count: 4, optional: [2] },
    itemBoxRows: [{ at: 0.1, count: 3 }],
    uchuvaLines: [{ at: 0.5, count: 4, offset: 2 }],
  }
}

describe('buildTrackDefinition', () => {
  it('builds a valid closed Track with checkpoints, pickups and start pose', () => {
    const track = new Track(buildTrackDefinition(squareTrack()))
    expect(track.name).toBe('Cuadrado')
    expect(track.centerline).toHaveLength(32)
    expect(track.halfWidth).toBe(8)
    expect(track.loopLength).toBeGreaterThan(300)
    expect(track.checkpoints).toHaveLength(4)
    expect(track.checkpoints.map((c) => c.mandatory)).toEqual([true, true, false, true])
    expect(track.itemBoxes).toHaveLength(3)
    expect(track.uchuvas).toHaveLength(4)
    const start = track.startPose()
    expect(start.position.x).toBeCloseTo(0)
    expect(start.position.z).toBeCloseTo(0)
  })

  it('interpolates ground height from control points', () => {
    const track = new Track(buildTrackDefinition(squareTrack()))
    expect(track.groundHeight(0, 0)).toBeCloseTo(0)
    expect(track.groundHeight(100, 100)).toBeCloseTo(4)
  })

  it('uses the control point surface on the road and grass outside', () => {
    const track = new Track(buildTrackDefinition(squareTrack()))
    const onRoad = track.point(4)
    expect(track.surfaceAt(onRoad.x, onRoad.z)).toBe('asphalt')
    expect(track.surfaceAt(100, 100)).toBe('wood')
    expect(track.surfaceAt(50, 50)).toBe('grass')
    expect(track.surfaceAt(900, 900)).toBe('grass')
  })

  it('supports branches with their own surface', () => {
    const data = squareTrack()
    const road = new Track(buildTrackDefinition(data))
    const from = road.point(2)
    const to = road.point(6)
    data.branches.push({
      name: 'Atajo',
      points: [from, { x: 50, z: 30 }, to],
      halfWidth: 5,
      surface: 'mud',
    })
    const track = new Track(buildTrackDefinition(data))
    expect(track.surfaceAt(50, 30)).toBe('mud')
    expect(track.project(50, 30).branch).toBe(0)
    expect(validateTrackData(data)).toEqual([])
  })

  it('builds both presets into valid tracks without warnings about intersections', () => {
    for (const preset of [cocoraPreset(), testPreset()]) {
      const parsed = parseTrackData(preset)
      expect(parsed).not.toBeNull()
      const definition = buildTrackDefinition(preset)
      expect(loopSelfIntersects(definition.centerline)).toBe(false)
      expect(new Track(definition).checkpoints.length).toBeGreaterThan(2)
    }
    const cocora = new Track(buildTrackDefinition(cocoraPreset()))
    expect(cocora.surfaceAt(-22, 100)).toBe('mud')
    expect(cocora.surfaceAt(80, 75)).toBe('wood')
  })
})

describe('parseTrackData', () => {
  it('roundtrips through JSON', () => {
    const data = cocoraPreset()
    expect(parseTrackDataText(JSON.stringify(data))).toEqual(data)
    expect(parseTrackData(cloneTrackData(data))).toEqual(data)
  })

  it('rejects bad versions, shapes and numbers', () => {
    const good = squareTrack()
    const bad: unknown[] = [
      null,
      'texto',
      [],
      { ...good, version: 2 },
      { ...good, name: '' },
      { ...good, halfWidth: 0 },
      { ...good, halfWidth: Number.NaN },
      { ...good, samplesPerSegment: 1.5 },
      { ...good, points: good.points.slice(0, 3) },
      { ...good, points: [...good.points.slice(0, 3), { x: Number.NaN, z: 0, y: 0 }] },
      { ...good, points: [...good.points.slice(0, 3), { x: 1, z: 1, y: 0, surface: 'lava' }] },
      { ...good, checkpoints: { count: 0, optional: [] } },
      { ...good, checkpoints: undefined },
      {
        ...good,
        branches: [{ name: 'a', points: [{ x: 0, z: 0 }], halfWidth: 5, surface: 'mud' }],
      },
      { ...good, itemBoxRows: [{ at: 2, count: 3 }] },
      { ...good, uchuvaLines: [{ at: 0.5, count: 0, offset: 0 }] },
    ]
    for (const input of bad) expect(parseTrackData(input)).toBeNull()
    expect(parseTrackDataText('{no es json')).toBeNull()
  })

  it('defaults missing lists to empty', () => {
    const full = squareTrack()
    const rest: Record<string, unknown> = { ...full }
    delete rest.branches
    delete rest.itemBoxRows
    delete rest.uchuvaLines
    const parsed = parseTrackData(rest)
    expect(parsed?.branches).toEqual([])
    expect(parsed?.itemBoxRows).toEqual([])
  })
})

describe('validateTrackData', () => {
  it('is quiet for a good track and warns about crossing loops', () => {
    expect(validateTrackData(squareTrack())).toEqual([])
    const bowtie = squareTrack()
    bowtie.points = [
      { x: 0, z: 0, y: 0 },
      { x: 100, z: 100, y: 0 },
      { x: 100, z: 0, y: 0 },
      { x: 0, z: 100, y: 0 },
    ]
    expect(validateTrackData(bowtie).join(' ')).toContain('cruza')
  })

  it('warns about too few points and detached branches', () => {
    const few = squareTrack()
    few.points = few.points.slice(0, 3)
    expect(validateTrackData(few).join(' ')).toContain('Faltan puntos')
    const detached = squareTrack()
    detached.branches.push({
      name: 'Suelto',
      points: [
        { x: 500, z: 500 },
        { x: 520, z: 500 },
      ],
      halfWidth: 5,
      surface: 'dirt',
    })
    expect(validateTrackData(detached).join(' ')).toContain('Suelto')
  })
})
