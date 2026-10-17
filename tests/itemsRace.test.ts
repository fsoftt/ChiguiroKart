import { describe, expect, it } from 'vitest'
import { RacingBot } from '../src/ai/racingBot'
import { createRng } from '../src/ai/random'
import { botDifficulties } from '../src/config/bots'
import { defaultDrift } from '../src/config/drift'
import { defaultItems } from '../src/config/items'
import { defaultKartPhysics } from '../src/config/kartPhysics'
import { NEUTRAL_INPUT } from '../src/input/kartInput'
import { BotManager } from '../src/sim/botManager'
import { ItemSystem } from '../src/sim/items/itemSystem'
import type { ItemEvent } from '../src/sim/items/itemTypes'
import { DT, makeWorld } from './helpers/botSim'

const LAPS = 2
const MAX_SECONDS = 260

interface RaceOutcome {
  allFinished: boolean
  badPositions: number
  events: Record<string, number>
  maxEntities: number
  maxUchuvas: number
  snapshot: string
}

/** Eight karts on Cocora (player driven by a bot) spamming the use button at random. */
function raceWithItems(seed: number): RaceOutcome {
  const world = makeWorld(LAPS, 3)
  const manager = new BotManager(world, defaultKartPhysics, defaultDrift)
  for (let n = 0; n < 7; n++) {
    manager.addBot(new RacingBot({ skill: botDifficulties.normal, seed: 10 + n }))
  }
  const driver = new RacingBot({ skill: botDifficulties.facil, seed: 99 })
  const items = new ItemSystem(world.track, defaultItems, seed, defaultDrift)
  const spam = createRng(seed + 1000)
  const racers = manager.allRacers()
  const outcome: RaceOutcome = {
    allFinished: false,
    badPositions: 0,
    events: {},
    maxEntities: 0,
    maxUchuvas: 0,
    snapshot: '',
  }
  const log: ItemEvent[] = []

  for (let step = 0; step < Math.ceil(MAX_SECONDS / DT); step++) {
    const playerInput = driver.nextInput(DT, { world, self: world.player, racers })
    world.step(playerInput, DT)
    manager.update(DT)
    manager.resolveCollisions()

    const inputs = [playerInput, ...manager.getBotInfos().map((info) => info.input)]
    items.update(
      racers.map((racer, i) => ({
        racer,
        input: { ...(inputs[i] ?? NEUTRAL_INPUT), useItem: spam() < 0.06, lookBack: spam() < 0.15 },
      })),
      DT,
    )
    log.push(...items.drainEvents())

    outcome.maxEntities = Math.max(outcome.maxEntities, items.entities.length)
    if (step % 20 === 0) {
      for (const racer of racers) {
        const { x, y, z } = racer.kart.position
        if (![x, y, z].every(Number.isFinite)) outcome.badPositions++
        outcome.maxUchuvas = Math.max(outcome.maxUchuvas, racer.items.uchuvas)
      }
    }
    if (racers.every((racer) => racer.race.state.phase === 'finished')) {
      outcome.allFinished = true
      break
    }
  }
  for (const event of log) outcome.events[event.type] = (outcome.events[event.type] ?? 0) + 1
  outcome.snapshot = JSON.stringify(
    racers.map((racer) => [racer.kart.position, racer.race.state.totalRaceTime, racer.items]),
  )
  return outcome
}

describe('a full race with every kart using items at random', () => {
  const race = raceWithItems(1)

  it('uses plenty of powers and lands hits', () => {
    expect(race.events.boxTaken).toBeGreaterThan(20)
    expect(race.events.uchuvaTaken).toBeGreaterThan(10)
    expect(race.events.powerUsed).toBeGreaterThan(20)
    expect(race.events.hit).toBeGreaterThan(5)
  })

  it('finishes with every kart, no NaN and no runaway entities or uchuvas', () => {
    expect(race.badPositions).toBe(0)
    expect(race.allFinished).toBe(true)
    expect(race.maxEntities).toBeLessThan(60)
    expect(race.maxUchuvas).toBeLessThanOrEqual(defaultItems.uchuvas.max)
  })

  it('replays identically with the same seed', () => {
    expect(raceWithItems(1).snapshot).toBe(race.snapshot)
  })
})
