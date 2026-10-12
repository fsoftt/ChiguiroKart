import { describe, expect, it } from 'vitest'
import { defaultDrift } from '../src/config/drift'
import { checkGateCrossing, type Checkpoint } from '../src/sim/race/checkpoint'
import { RaceManager } from '../src/sim/race/raceManager'
import { createKartState } from '../src/sim/kart/kartState'
import { NEUTRAL_INPUT } from '../src/input/kartInput'

const defaultInput = NEUTRAL_INPUT

describe('Checkpoint detection', () => {
  const cp: Checkpoint = {
    index: 0,
    position: { x: 0, z: 0 },
    forward: { x: 0, z: 1 }, // driving toward +z
    width: 10,
    mandatory: true,
  }

  it('detects forward crossing across the gate', () => {
    const prev = { x: 0, z: -1 }
    const curr = { x: 0, z: 1 }
    expect(checkGateCrossing(cp, prev, curr)).toBe('forward')
  })

  it('detects backward crossing across the gate', () => {
    const prev = { x: 0, z: 1 }
    const curr = { x: 0, z: -1 }
    expect(checkGateCrossing(cp, prev, curr)).toBe('backward')
  })

  it('ignores movement far outside the gate width', () => {
    const prev = { x: 50, z: -1 }
    const curr = { x: 50, z: 1 }
    expect(checkGateCrossing(cp, prev, curr)).toBe('none')
  })

  it('ignores movement parallel to the gate that does not cross it', () => {
    const prev = { x: -3, z: -2 }
    const curr = { x: 3, z: -2 }
    expect(checkGateCrossing(cp, prev, curr)).toBe('none')
  })
})

describe('RaceManager', () => {
  const checkpoints: Checkpoint[] = [
    { index: 0, position: { x: 0, z: 0 }, forward: { x: 1, z: 0 }, width: 10, mandatory: true },
    { index: 1, position: { x: 50, z: 0 }, forward: { x: 0, z: 1 }, width: 10, mandatory: true },
    { index: 2, position: { x: 50, z: 50 }, forward: { x: -1, z: 0 }, width: 10, mandatory: false }, // optional (shortcut bypasses this)
    { index: 3, position: { x: 0, z: 50 }, forward: { x: 0, z: -1 }, width: 10, mandatory: true },
  ]

  it('starts in countdown phase and counts down to racing', () => {
    const manager = new RaceManager(checkpoints, { countdownSeconds: 2.0 })
    const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)

    expect(manager.state.phase).toBe('countdown')
    expect(manager.state.countdown).toBe(2.0)

    manager.update(kart, defaultInput, defaultDrift, () => 0, 1.0)
    expect(manager.state.phase).toBe('countdown')
    expect(manager.state.countdown).toBe(1.0)

    manager.update(kart, defaultInput, defaultDrift, () => 0, 1.1)
    expect(manager.state.phase).toBe('racing')
  })

  it('locks kart velocity during countdown', () => {
    const manager = new RaceManager(checkpoints, { countdownSeconds: 2.0 })
    const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
    kart.velocity = { x: 15, y: 0, z: 10 }

    manager.update(kart, { ...defaultInput, throttle: 1 }, defaultDrift, () => 0, 0.5)
    expect(kart.velocity).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('stalls the engine if player revs too early in countdown', () => {
    const manager = new RaceManager(checkpoints, { countdownSeconds: 2.0 })
    const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)

    // Player full throttles at 2.0s
    manager.update(kart, { ...defaultInput, throttle: 1.0 }, defaultDrift, () => 0, 1.0)
    // Finishes countdown
    manager.update(kart, { ...defaultInput, throttle: 1.0 }, defaultDrift, () => 0, 1.1)

    expect(manager.state.phase).toBe('racing')
    expect(manager.state.engineStallRemaining).toBeGreaterThan(0)
    expect(kart.boost.level).toBe(0)
  })

  it('awards start boost if player hits throttle right at green light', () => {
    const manager = new RaceManager(checkpoints, { countdownSeconds: 2.0 })
    const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)

    // No throttle during early countdown
    manager.update(kart, defaultInput, defaultDrift, () => 0, 1.8)
    // Hit throttle right as light turns green
    manager.update(kart, { ...defaultInput, throttle: 1.0 }, defaultDrift, () => 0, 0.3)

    expect(manager.state.phase).toBe('racing')
    expect(manager.state.engineStallRemaining).toBe(0)
    expect(kart.boost.level).toBe(2)
    expect(kart.boost.perfect).toBe(true)
  })

  it('validates laps when passing mandatory checkpoints in order', () => {
    const manager = new RaceManager(checkpoints, { countdownSeconds: 0, totalLaps: 2 })
    const kart = createKartState({ x: 0, y: 0, z: -2 }, 0)
    manager.update(kart, defaultInput, defaultDrift, () => 0, 0.01) // enter racing

    // Cross checkpoint 1 (mandatory)
    kart.position = { x: 50, y: 0, z: -2 }
    manager.update(kart, defaultInput, defaultDrift, () => 0, 0.01)
    kart.position = { x: 50, y: 0, z: 2 }
    manager.update(kart, defaultInput, defaultDrift, () => 0, 0.01)
    expect(manager.state.passedMandatoryCheckpoints.has(1)).toBe(true)

    // Skip checkpoint 2 (optional shortcut)

    // Cross checkpoint 3 (mandatory)
    kart.position = { x: 0, y: 0, z: 52 }
    manager.update(kart, defaultInput, defaultDrift, () => 0, 0.01)
    kart.position = { x: 0, y: 0, z: 48 }
    manager.update(kart, defaultInput, defaultDrift, () => 0, 0.01)
    expect(manager.state.passedMandatoryCheckpoints.has(3)).toBe(true)

    // Cross start/finish line (checkpoint 0)
    kart.position = { x: -2, y: 0, z: 0 }
    manager.update(kart, defaultInput, defaultDrift, () => 0, 0.01)
    kart.position = { x: 2, y: 0, z: 0 }
    manager.update(kart, defaultInput, defaultDrift, () => 0, 0.01)

    expect(manager.state.currentLap).toBe(2)
    expect(manager.state.lapTimes.length).toBe(1)
    expect(manager.state.phase).toBe('racing')
  })

  it('rejects lap completion if cutting track and missing a mandatory checkpoint', () => {
    const manager = new RaceManager(checkpoints, { countdownSeconds: 0, totalLaps: 2 })
    const kart = createKartState({ x: 0, y: 0, z: -2 }, 0)
    manager.update(kart, defaultInput, defaultDrift, () => 0, 0.01)

    // Skip checkpoint 1 & 3 entirely, cross start/finish immediately
    kart.position = { x: -2, y: 0, z: 0 }
    manager.update(kart, defaultInput, defaultDrift, () => 0, 0.01)
    kart.position = { x: 2, y: 0, z: 0 }
    manager.update(kart, defaultInput, defaultDrift, () => 0, 0.01)

    expect(manager.state.currentLap).toBe(1)
    expect(manager.state.lapTimes.length).toBe(0)
  })

  it('finishes race after completing total laps', () => {
    const manager = new RaceManager(checkpoints, { countdownSeconds: 0, totalLaps: 1 })
    const kart = createKartState({ x: 0, y: 0, z: -2 }, 0)
    manager.update(kart, defaultInput, defaultDrift, () => 0, 0.01)

    // Cross cp 1
    kart.position = { x: 50, y: 0, z: -2 }
    manager.update(kart, defaultInput, defaultDrift, () => 0, 0.01)
    kart.position = { x: 50, y: 0, z: 2 }
    manager.update(kart, defaultInput, defaultDrift, () => 0, 0.01)

    // Cross cp 3
    kart.position = { x: 0, y: 0, z: 52 }
    manager.update(kart, defaultInput, defaultDrift, () => 0, 0.01)
    kart.position = { x: 0, y: 0, z: 48 }
    manager.update(kart, defaultInput, defaultDrift, () => 0, 0.01)

    // Cross finish line
    kart.position = { x: -2, y: 0, z: 0 }
    manager.update(kart, defaultInput, defaultDrift, () => 0, 0.01)
    kart.position = { x: 2, y: 0, z: 0 }
    manager.update(kart, defaultInput, defaultDrift, () => 0, 0.01)

    expect(manager.state.phase).toBe('finished')
    expect(manager.state.lapTimes.length).toBe(1)
  })

  it('respawns kart if it falls below threshold', () => {
    const manager = new RaceManager(checkpoints, { countdownSeconds: 0, fallThreshold: -5.0 })
    const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
    manager.update(kart, defaultInput, defaultDrift, () => 0, 0.01)

    // Pass cp 1
    kart.position = { x: 50, y: 0, z: -2 }
    manager.update(kart, defaultInput, defaultDrift, () => 0, 0.01)
    kart.position = { x: 50, y: 0, z: 2 }
    manager.update(kart, defaultInput, defaultDrift, () => 0, 0.01)

    // Fall into void
    kart.position = { x: 80, y: -10, z: 80 }
    kart.velocity = { x: 10, y: -20, z: 5 }
    manager.update(kart, defaultInput, defaultDrift, () => 2.0, 0.01)

    expect(kart.position.x).toBe(50)
    expect(kart.position.y).toBeCloseTo(2.2) // ground + 0.2
    expect(kart.position.z).toBe(0)
    expect(kart.velocity).toEqual({ x: 0, y: 0, z: 0 })
  })
})
