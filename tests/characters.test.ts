import { describe, expect, it } from 'vitest'
import {
  characterIds,
  characters,
  characterTuning,
  type CharacterId,
} from '../src/config/characters'
import { defaultDrift } from '../src/config/drift'
import { defaultItems } from '../src/config/items'
import { defaultKartPhysics } from '../src/config/kartPhysics'
import { RacingBot } from '../src/ai/racingBot'
import { NEUTRAL_INPUT } from '../src/input/kartInput'
import { BotManager } from '../src/sim/botManager'
import {
  characterMass,
  characterPerks,
  characterPhysics,
  slipstream,
  statMultiplier,
} from '../src/sim/characters'
import { tickStatus } from '../src/sim/items/statusTimers'
import { NEUTRAL_KART_PERKS } from '../src/sim/kart/kartPerks'
import { updateDrift } from '../src/sim/kart/drift'
import { resolveKartCollisions } from '../src/sim/kart/kartCollision'
import { forwardSpeed, stepKart } from '../src/sim/kart/kartPhysics'
import { createKartState } from '../src/sim/kart/kartState'
import type { SurfaceType } from '../src/sim/race/surface'
import { createRacer, resetRacer, stepRacer, type Racer } from '../src/sim/racer'
import { Track, type TrackDefinition } from '../src/sim/track'
import { RaceWorld } from '../src/sim/world'
import { at, DT, makeItemWorld } from './helpers/itemWorld'

const physics = defaultKartPhysics
const GAS = { ...NEUTRAL_INPUT, throttle: 1 }

/** A 2 km flat road along +x closed by a return lane; every point has the given surface. */
function straightDefinition(surface?: SurfaceType): TrackDefinition {
  const out = Array.from({ length: 21 }, (_, i) => ({ x: i * 100, z: 0 }))
  const back = Array.from({ length: 21 }, (_, i) => ({ x: 2000 - i * 100, z: 60 }))
  return {
    name: 'straight',
    centerline: [...out, ...back],
    halfWidth: 9,
    ...(surface ? { surfaceAt: () => surface } : {}),
  }
}

function straightTrack(surface?: SurfaceType): Track {
  return new Track(straightDefinition(surface))
}

function racerOn(track: Track, character: CharacterId, x = 100, z = 0): Racer {
  const racer = createRacer(track, { totalLaps: 3, countdownSeconds: 0 }, 0, character)
  racer.race.state.phase = 'racing'
  racer.kart.position = { x, y: 0, z }
  racer.kart.heading = Math.PI / 2
  racer.race.state.lastPassedCheckpoint = Math.floor(x / 500)
  return racer
}

function drive(racer: Racer, track: Track, seconds: number, others: readonly Racer[] = []): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    stepRacer(racer, GAS, track, physics, defaultDrift, DT, defaultItems, others)
  }
}

describe('character data', () => {
  it('lists the eight characters with stats from 1 to 5', () => {
    expect(characterIds).toHaveLength(8)
    for (const id of characterIds) {
      const def = characters[id]
      expect(def.id).toBe(id)
      expect(def.name.length).toBeGreaterThan(0)
      expect(def.perk.name.length).toBeGreaterThan(0)
      for (const value of Object.values(def.stats)) {
        expect(value).toBeGreaterThanOrEqual(1)
        expect(value).toBeLessThanOrEqual(5)
      }
    }
  })
})

describe('stats to physics', () => {
  const neutral = { speed: 3, acceleration: 3, handling: 3, weight: 3 }

  it('leaves the base physics untouched at stat 3', () => {
    expect(characterPhysics(physics, neutral)).toEqual(physics)
    expect(statMultiplier(3, 0.1, 3)).toBe(1)
  })

  it('grows monotonically with each stat', () => {
    const at = (stats: Partial<typeof neutral>) =>
      characterPhysics(physics, { ...neutral, ...stats })
    for (let v = 1; v < 5; v++) {
      expect(at({ speed: v + 1 }).maxSpeed).toBeGreaterThan(at({ speed: v }).maxSpeed)
      expect(at({ acceleration: v + 1 }).acceleration).toBeGreaterThan(
        at({ acceleration: v }).acceleration,
      )
      expect(at({ handling: v + 1 }).turnRate).toBeGreaterThan(at({ handling: v }).turnRate)
      expect(at({ handling: v + 1 }).lateralGrip).toBeGreaterThan(at({ handling: v }).lateralGrip)
    }
  })

  it('keeps the speed spread small and the roster average near neutral', () => {
    const fastest = characterPhysics(physics, characters.jaguar.stats).maxSpeed
    expect(fastest / physics.maxSpeed).toBeLessThan(1.06)
    let sum = 0
    for (const id of characterIds) sum += characterPhysics(physics, characters[id].stats).maxSpeed
    expect(sum / characterIds.length / physics.maxSpeed).toBeCloseTo(1, 1)
  })

  it('makes heavier characters heavier and chigüiro the reference mass', () => {
    expect(characterMass('chiguiro')).toBe(1)
    expect(characterMass('oso')).toBeGreaterThan(characterMass('chiguiro'))
    expect(characterMass('titi')).toBeLessThan(characterMass('condor'))
    expect(characterMass('condor')).toBeLessThan(characterMass('chiguiro'))
  })

  it('a faster character reaches a higher top speed on the road', () => {
    const track = straightTrack()
    const jaguar = racerOn(track, 'jaguar')
    const titi = racerOn(track, 'titi')
    drive(jaguar, track, 8)
    drive(titi, track, 8)
    expect(forwardSpeed(jaguar.kart)).toBeGreaterThan(forwardSpeed(titi.kart))
  })
})

describe('racer character', () => {
  it('defaults to chigüiro, is kept by resetRacer, bots get distinct characters', () => {
    const track = straightTrack()
    expect(createRacer(track).character).toBe('chiguiro')
    const racer = createRacer(track, undefined, 2, 'condor')
    racer.kart.position.x += 50
    resetRacer(racer, track)
    expect(racer.character).toBe('condor')

    const world = new RaceWorld(straightDefinition(), physics, defaultDrift)
    const manager = new BotManager(world, physics, defaultDrift)
    for (let i = 0; i < 4; i++) manager.addBot(new RacingBot({ seed: i }))
    manager.addBot(new RacingBot(), 'perezoso')
    const picked = manager.getBotRacers().map((r) => r.character)
    expect(new Set(picked).size).toBe(5)
    expect(picked[4]).toBe('perezoso')
  })
})

describe('kart collision mass', () => {
  const pair = (massA: number, massB: number) => {
    const a = createKartState({ x: 0, y: 0, z: 0 }, 0)
    const b = createKartState({ x: 1, y: 0, z: 0 }, 0)
    a.velocity.x = 10
    b.velocity.x = -10
    resolveKartCollisions([a, b], physics, [massA, massB])
    return { a, b }
  }

  it('equal masses behave like the default', () => {
    const explicit = pair(1, 1)
    const a = createKartState({ x: 0, y: 0, z: 0 }, 0)
    const b = createKartState({ x: 1, y: 0, z: 0 }, 0)
    a.velocity.x = 10
    b.velocity.x = -10
    resolveKartCollisions([a, b], physics)
    expect(explicit.a.position).toEqual(a.position)
    expect(explicit.b.velocity).toEqual(b.velocity)
  })

  it('the lighter kart is pushed more, in position and speed, and momentum is conserved', () => {
    const { a, b } = pair(3, 1)
    expect(Math.abs(b.position.x - 1)).toBeGreaterThan(Math.abs(a.position.x))
    expect(Math.abs(b.velocity.x - -10)).toBeGreaterThan(Math.abs(a.velocity.x - 10))
    expect(3 * a.velocity.x + b.velocity.x).toBeCloseTo(3 * 10 - 10)
    expect(b.position.x - a.position.x).toBeCloseTo(physics.kartRadius * 2)
  })

  it('the oso pushes a titi further than a chigüiro would, and resists more', () => {
    const hit = (heavy: CharacterId, light: CharacterId) =>
      pair(characterMass(heavy), characterMass(light)).b.velocity.x
    expect(hit('oso', 'titi')).toBeGreaterThan(hit('chiguiro', 'titi'))
    expect(hit('oso', 'chiguiro')).toBeGreaterThan(hit('chiguiro', 'chiguiro'))
    // The extra Aplanadora mass is on top of weight 5
    const base = 1 + (5 - 3) * characterTuning.stats.massPerPoint
    expect(characterMass('oso')).toBeCloseTo(base * characterTuning.perks.aplanadora.massFactor)
  })
})

describe('perks', () => {
  it('Tranquilo: the chigüiro recovers from a hit 30 % faster', () => {
    const recoverySteps = (id: CharacterId): number => {
      const racer = createRacer(straightTrack(), undefined, 0, id)
      racer.items.status.hit = 'spin'
      racer.items.status.hitTime = defaultItems.hit.spinTime
      let steps = 0
      while (
        (racer.items.status.hit !== null || racer.items.status.dizzyTime > 0) &&
        steps < 1000
      ) {
        tickStatus(racer, defaultItems.hit, DT)
        steps++
      }
      return steps
    }
    const chiguiro = recoverySteps('chiguiro')
    const other = recoverySteps('condor')
    expect(chiguiro).toBeLessThan(other)
    expect(other / chiguiro).toBeCloseTo(characterTuning.perks.tranquilo.recoveryRate, 1)
  })

  it('Ágil: the tití charges the drift faster', () => {
    const charge = (id: CharacterId): number => {
      const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
      kart.drift.direction = 1
      for (let i = 0; i < 20; i++) updateDrift(kart, false, defaultDrift, DT, characterPerks(id))
      return kart.drift.charge
    }
    expect(charge('titi')).toBeGreaterThan(charge('chiguiro'))
    expect(charge('titi') / charge('chiguiro')).toBeCloseTo(
      characterTuning.perks.agil.driftChargeFactor,
    )
  })

  it('Planeo: the cóndor hangs longer, steers in the air and lands with a bigger boost', () => {
    const hop = (id: CharacterId, steer: number) => {
      const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
      kart.velocity.z = 20
      const perks = characterPerks(id)
      const input = { ...NEUTRAL_INPUT, throttle: 1, jump: true, steer }
      let air = 0
      let boost = 0
      for (let i = 0; i < 400; i++) {
        stepKart(kart, input, physics, defaultDrift, () => 0, DT, perks)
        if (!kart.onGround) air += DT
        else if (air > 0) {
          boost = kart.boost.timeLeft
          break
        }
        input.jump = false
        // Launch higher than a plain hop so the landing boost threshold is reached
        if (i === 0) kart.velocity.y = 12
      }
      return { air, boost, heading: kart.heading }
    }
    const condor = hop('condor', 0)
    const base = hop('chiguiro', 0)
    expect(condor.air).toBeGreaterThan(base.air)
    expect(condor.boost).toBeGreaterThan(base.boost)
    expect(base.boost).toBeGreaterThan(0)
    expect(hop('condor', 1).heading).toBeLessThan(condor.heading)
    // Without the perk only the first grounded step turns the kart
    expect(Math.abs(hop('chiguiro', 1).heading)).toBeLessThan(0.05)
    expect(Math.abs(hop('condor', 1).heading)).toBeGreaterThan(0.5)
  })

  it('Depredador: the jaguar gets a slipstream only right behind a rival', () => {
    const track = straightTrack()
    const jaguar = racerOn(track, 'jaguar', 100)
    const ahead = racerOn(track, 'chiguiro', 108)
    const aside = racerOn(track, 'chiguiro', 108, 8)
    const far = racerOn(track, 'chiguiro', 200)
    const behind = racerOn(track, 'chiguiro', 92)

    expect(slipstream(jaguar, [jaguar, ahead])).toBeGreaterThan(0)
    expect(slipstream(jaguar, [aside])).toBe(0)
    expect(slipstream(jaguar, [far])).toBe(0)
    expect(slipstream(jaguar, [behind])).toBe(0)
    expect(slipstream(ahead, [jaguar, jaguar])).toBe(0)
    expect(slipstream(jaguar, [ahead])).toBeGreaterThan(
      slipstream(jaguar, [racerOn(track, 'oso', 112)]),
    )

    // Same car, same road: the draft lets it pull past the free-running one
    const drafting = racerOn(track, 'jaguar', 100)
    const free = racerOn(track, 'jaguar', 100)
    const leader = racerOn(track, 'chiguiro', 108)
    for (let i = 0; i < 60; i++) {
      leader.kart.position.x = drafting.kart.position.x + 8
      leader.kart.velocity.x = drafting.kart.velocity.x
      stepRacer(drafting, GAS, track, physics, defaultDrift, DT, defaultItems, [leader])
      stepRacer(free, GAS, track, physics, defaultDrift, DT, defaultItems, [])
    }
    expect(forwardSpeed(drafting.kart)).toBeGreaterThan(forwardSpeed(free.kart))
  })

  it('Coleccionista: the guacamaya keeps timed powers 25 % longer', () => {
    const duration = (id: CharacterId, power: 'mascara' | 'panela' | 'armadillo'): number => {
      const world = makeItemWorld({ count: 1, character: id })
      const racer = at(world, 0)
      world.give(racer, power)
      world.press(racer)
      const status = racer.items.status
      if (power === 'mascara') return status.maskTime
      if (power === 'armadillo') return status.shieldTime
      return racer.kart.boost.timeLeft
    }
    for (const power of ['mascara', 'panela', 'armadillo'] as const) {
      const ratio = duration('guacamaya', power) / duration('condor', power)
      expect(ratio).toBeCloseTo(characterTuning.perks.coleccionista.durationFactor, 1)
    }
  })

  it('Anfibio: the delfín is not slowed by mud, the others are', () => {
    const speedOn = (surface: SurfaceType, id: CharacterId): number => {
      const track = straightTrack(surface)
      const racer = racerOn(track, id)
      drive(racer, track, 8)
      return forwardSpeed(racer.kart)
    }
    expect(speedOn('mud', 'delfin')).toBeCloseTo(speedOn('asphalt', 'delfin'), 5)
    expect(speedOn('mud', 'condor')).toBeLessThan(speedOn('asphalt', 'condor') * 0.9)
    expect(speedOn('grass', 'delfin')).toBeLessThan(speedOn('asphalt', 'delfin') * 0.7)
  })

  it('Calma total: the perezoso fires longer nitros, and the third lasts double', () => {
    const nitro = (id: CharacterId, fired: number): number => {
      const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
      kart.drift.direction = 1
      kart.drift.nitrosInChain = fired
      kart.drift.charge = defaultDrift.redZoneStart + 0.1
      updateDrift(kart, true, defaultDrift, 0, characterPerks(id))
      return kart.boost.timeLeft
    }
    expect(nitro('perezoso', 0)).toBeCloseTo(
      defaultDrift.levels[0].duration * characterTuning.perks.calmaTotal.nitroDurationFactor,
    )
    expect(nitro('perezoso', 2)).toBeCloseTo(defaultDrift.levels[2].duration * 2)
    expect(nitro('chiguiro', 2)).toBeCloseTo(defaultDrift.levels[2].duration)
  })

  it('other characters have neutral kart perks', () => {
    for (const id of ['chiguiro', 'oso', 'jaguar', 'guacamaya', 'delfin'] as const) {
      expect(characterPerks(id)).toEqual(NEUTRAL_KART_PERKS)
    }
  })
})

describe('determinism', () => {
  it('the same characters on the same inputs give identical karts', () => {
    const run = (): string => {
      const track = straightTrack()
      const racers = characterIds.map((id, i) => racerOn(track, id, 100 + i * 6, (i % 2) * 3))
      for (let step = 0; step < 300; step++) {
        for (const racer of racers) {
          const input = { ...GAS, steer: Math.sin(step / 20), jump: step % 90 < 30 }
          stepRacer(racer, input, track, physics, defaultDrift, DT, defaultItems, racers)
        }
        resolveKartCollisions(
          racers.map((r) => r.kart),
          physics,
          racers.map((r) => characterMass(r.character)),
        )
      }
      return JSON.stringify(racers.map((r) => [r.kart.position, r.kart.velocity, r.kart.heading]))
    }
    expect(run()).toBe(run())
  })
})
