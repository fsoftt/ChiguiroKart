import { describe, expect, it } from 'vitest'
import { cocoraTrack } from '../src/config/tracks/cocoraTrack'
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
    expect(track.surfaceAt(-15, 100)).toBe('mud')
    expect(track.surfaceAt(300, 300)).toBe('grass')
  })

  it('has mandatory checkpoints covering the full circuit', () => {
    const checkpoints = cocoraTrack.checkpoints ?? []
    expect(checkpoints.length).toBeGreaterThanOrEqual(6)
    const mandatoryCount = checkpoints.filter((c) => c.mandatory).length
    expect(mandatoryCount).toBe(checkpoints.length)
  })
})
