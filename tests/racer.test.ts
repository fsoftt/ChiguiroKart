import { describe, expect, it } from 'vitest'
import { defaultDrift } from '../src/config/drift'
import { defaultKartPhysics } from '../src/config/kartPhysics'
import { NEUTRAL_INPUT } from '../src/input/kartInput'
import { SimpleBot } from '../src/input/botInput'
import { BotManager } from '../src/sim/botManager'
import { createKartState } from '../src/sim/kart/kartState'
import type { Checkpoint } from '../src/sim/race/checkpoint'
import { createRacer, gridPose, stepRacer } from '../src/sim/racer'
import { Track, type TrackDefinition } from '../src/sim/track'
import { RaceWorld } from '../src/sim/world'

const DT = 1 / 60
const FULL_THROTTLE = { ...NEUTRAL_INPUT, throttle: 1 }

/** Square loop 100 m a side with one checkpoint per corner. */
const gate = (index: number, x: number, z: number): Checkpoint => ({
  index,
  position: { x, z },
  forward: { x: 0, z: 1 },
  width: 10,
  mandatory: true,
})
const squareDefinition: TrackDefinition = {
  name: 'square',
  centerline: [
    { x: -50, z: -50 },
    { x: 50, z: -50 },
    { x: 50, z: 50 },
    { x: -50, z: 50 },
  ],
  halfWidth: 5,
  checkpoints: [gate(0, -50, -50), gate(1, 50, -50), gate(2, 50, 50), gate(3, -50, 50)],
}
const square = new Track(squareDefinition)

function makeWorld(countdownSeconds = 1): RaceWorld {
  return new RaceWorld(squareDefinition, defaultKartPhysics, defaultDrift, { countdownSeconds })
}

describe('Racer', () => {
  it('starts on the grid with a fresh race state in countdown', () => {
    const racer = createRacer(square, { countdownSeconds: 2 })
    const pose = gridPose(square, 0)

    expect(racer.kart.position).toEqual(pose.position)
    expect(racer.kart.heading).toBe(pose.heading)
    expect(racer.race.state.phase).toBe('countdown')
    expect(racer.race.state.countdown).toBe(2)
    expect(racer.race.state.currentLap).toBe(1)
  })

  it('stays parked during the countdown and moves once racing', () => {
    const racer = createRacer(square, { countdownSeconds: 0.5 })
    const start = { ...racer.kart.position }

    for (let i = 0; i < 10; i++) {
      stepRacer(racer, FULL_THROTTLE, square, defaultKartPhysics, defaultDrift, DT)
    }
    expect(racer.race.state.phase).toBe('countdown')
    expect(racer.kart.velocity).toEqual({ x: 0, y: 0, z: 0 })
    expect(racer.kart.position).toEqual(start)

    for (let i = 0; i < 120; i++) {
      stepRacer(racer, FULL_THROTTLE, square, defaultKartPhysics, defaultDrift, DT)
    }
    expect(racer.race.state.phase).toBe('racing')
    expect(Math.hypot(racer.kart.velocity.x, racer.kart.velocity.z)).toBeGreaterThan(0)
  })

  it('keeps race progress independent between two racers', () => {
    const a = createRacer(square, { countdownSeconds: 0 })
    const b = createRacer(square, { countdownSeconds: 0 })
    expect(a.race.state).not.toBe(b.race.state)

    // Enter racing, then drive racer A across checkpoint 1 (forward = +z)
    a.race.update(a.kart, NEUTRAL_INPUT, defaultDrift, () => 0, DT)
    b.race.update(b.kart, NEUTRAL_INPUT, defaultDrift, () => 0, DT)
    a.kart.position = { x: 50, y: 0, z: -52 }
    a.race.update(a.kart, NEUTRAL_INPUT, defaultDrift, () => 0, DT)
    a.kart.position = { x: 50, y: 0, z: -48 }
    a.race.update(a.kart, NEUTRAL_INPUT, defaultDrift, () => 0, DT)

    expect(a.race.state.lastPassedCheckpoint).toBe(1)
    expect(a.race.state.passedMandatoryCheckpoints.has(1)).toBe(true)
    expect(b.race.state.lastPassedCheckpoint).toBe(0)
    expect(b.race.state.passedMandatoryCheckpoints.has(1)).toBe(false)
    expect(b.race.state.currentLap).toBe(1)
  })
})

describe('BotManager', () => {
  it('gives every bot its own race state, separate from the player', () => {
    const world = makeWorld()
    const bots = new BotManager(world, defaultKartPhysics, defaultDrift)
    bots.addBot(new SimpleBot())
    bots.addBot(new SimpleBot())

    const [first, second] = bots.getBotInfos()
    expect(first?.race).toBeDefined()
    expect(first?.race).not.toBe(second?.race)
    expect(first?.race).not.toBe(world.raceManager.state)
    expect(second?.race).not.toBe(world.raceManager.state)
  })

  it('never stalls bots because they stay off the throttle in countdown', () => {
    const world = makeWorld(1)
    const bots = new BotManager(world, defaultKartPhysics, defaultDrift)
    bots.addBot(new SimpleBot())

    for (let i = 0; i < 90; i++) bots.update(DT)

    const info = bots.getBotInfos()[0]
    expect(info?.race.phase).toBe('racing')
    expect(info?.race.engineStallRemaining).toBe(0)
  })

  it('returns bots to the grid with a fresh race state on reset', () => {
    const world = makeWorld(0.2)
    const bots = new BotManager(world, defaultKartPhysics, defaultDrift)
    bots.addBot(new SimpleBot())
    for (let i = 0; i < 120; i++) bots.update(DT)

    const before = bots.getBotInfos()[0]
    expect(before?.race.phase).toBe('racing')
    expect(before?.race.totalRaceTime).toBeGreaterThan(0)

    bots.reset()

    const pose = gridPose(world.track, 1)
    const after = bots.getBotInfos()[0]
    expect(after?.kart.position).toEqual(pose.position)
    expect(after?.kart.heading).toBe(pose.heading)
    expect(after?.kart.velocity).toEqual({ x: 0, y: 0, z: 0 })
    expect(after?.race.phase).toBe('countdown')
    expect(after?.race.countdown).toBe(0.2)
    expect(after?.race.totalRaceTime).toBe(0)
    expect(after?.input).toEqual(NEUTRAL_INPUT)
  })
})

describe('SimpleBot', () => {
  it('aims at the checkpoint after its own last passed one, ignoring the player', () => {
    const world = makeWorld(0)
    const bot = new SimpleBot()
    // Kart at the origin facing +z (heading 0); positive steer turns right (lowers heading).
    const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
    const racing = createRacer(square, { countdownSeconds: 0 }).race.state
    racing.phase = 'racing'

    // Next gate is checkpoint 2 at (50, 50): target is toward +x, so steer left (negative)
    racing.lastPassedCheckpoint = 1
    world.raceManager.state.lastPassedCheckpoint = 3
    expect(bot.nextInput(DT, world, kart, racing).steer).toBeLessThan(0)

    // Next gate is checkpoint 3 at (-50, 50): target is toward -x, so steer right (positive)
    racing.lastPassedCheckpoint = 2
    world.raceManager.state.lastPassedCheckpoint = 0
    const input = bot.nextInput(DT, world, kart, racing)
    expect(input.steer).toBeGreaterThan(0)
    expect(input.throttle).toBeGreaterThan(0)
  })

  it('returns neutral input while the race is in countdown', () => {
    const world = makeWorld(3)
    const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
    const input = new SimpleBot().nextInput(DT, world, kart, world.raceManager.state)
    expect(input).toEqual(NEUTRAL_INPUT)
    expect(input.throttle).toBe(0)
  })
})
