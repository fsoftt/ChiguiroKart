import { describe, expect, it } from 'vitest'
import { defaultItems } from '../src/config/items'
import type { EntityKind } from '../src/sim/items/itemTypes'
import { wrapAngle } from '../src/sim/math'
import { at, makeItemWorld, SPACING, withItems, type ItemWorld } from './helpers/itemWorld'

/** Slots by position: 0 leads, 3 is last (thrower in most tests). */
const LAST = 3

function entitiesOf(world: ItemWorld, kind: EntityKind) {
  return world.system.entities.filter((entity) => entity.kind === kind)
}

function isHit(world: ItemWorld, slot: number): boolean {
  return at(world, slot).items.status.hit !== null
}

describe('coco bomba', () => {
  it('flies ahead, explodes on the kart in front and flips it', () => {
    const world = makeItemWorld()
    world.give(at(world, LAST), 'coco')
    world.press(at(world, LAST))
    expect(entitiesOf(world, 'coco')).toHaveLength(1)
    expect(entitiesOf(world, 'coco')[0]?.id).toBe(1)
    expect(at(world, LAST).items.slot.power).toBeNull()
    expect(world.eventsOf('powerUsed')[0]).toMatchObject({ slot: LAST, power: 'coco' })

    world.run(1)
    expect(isHit(world, 2)).toBe(true)
    expect(at(world, 2).items.status.hit).toBe('flip')
    expect(at(world, 2).kart.velocity.y).toBeGreaterThan(0)
    expect(at(world, 2).kart.onGround).toBe(false)
    expect(isHit(world, 1)).toBe(false)
    expect(isHit(world, LAST)).toBe(false)
    expect(entitiesOf(world, 'coco')).toHaveLength(0)
    expect(world.eventsOf('explosion')).toHaveLength(1)
  })

  it('throws backwards while look back is held', () => {
    const world = makeItemWorld()
    world.give(at(world, 0), 'coco')
    world.press(at(world, 0), { lookBack: true })
    world.run(1)
    // The kart right behind the leader takes it
    expect(isHit(world, 1)).toBe(true)
    expect(isHit(world, 0)).toBe(false)
  })

  it('explodes on a wall and after the fuse', () => {
    const wall = makeItemWorld({ count: 1 })
    at(wall, 0).kart.heading = 0
    wall.give(at(wall, 0), 'coco')
    wall.press(at(wall, 0))
    wall.run(0.5)
    expect(wall.eventsOf('explosion')).toHaveLength(1)

    const fuse = makeItemWorld({ count: 1 })
    fuse.give(at(fuse, 0), 'coco')
    fuse.press(at(fuse, 0))
    fuse.run(defaultItems.powers.coco.fuse - 0.2)
    expect(fuse.eventsOf('explosion')).toHaveLength(0)
    fuse.run(0.4)
    expect(fuse.eventsOf('explosion')).toHaveLength(1)
  })

  it('has a bigger blast when charged', () => {
    const blast = (charged: boolean): boolean => {
      const world = makeItemWorld()
      world.place(at(world, 1), 750, 5.5)
      world.give(at(world, LAST), 'coco', charged)
      world.press(at(world, LAST))
      world.run(1)
      expect(isHit(world, 2)).toBe(true)
      return isHit(world, 1)
    }
    expect(blast(false)).toBe(false)
    expect(blast(true)).toBe(true)
  })

  it('spares its owner for a moment after the throw', () => {
    const run = (ownerImmunity: number): number => {
      const world = makeItemWorld({
        count: 1,
        config: withItems({
          powers: { spawnDistance: 0, coco: { ...defaultItems.powers.coco, ownerImmunity } },
        }),
      })
      world.give(at(world, 0), 'coco')
      world.press(at(world, 0))
      world.run(0.2)
      return world.eventsOf('explosion').length
    }
    expect(run(0.3)).toBe(0)
    expect(run(0)).toBe(1)
  })
})

describe('tejo con mecha', () => {
  it('lies behind the kart and flips whoever steps on it', () => {
    const world = makeItemWorld()
    world.give(at(world, 0), 'tejo')
    world.press(at(world, 0))
    const tejo = entitiesOf(world, 'tejo')[0]
    expect(tejo?.position.x).toBeCloseTo(
      at(world, 0).kart.position.x - defaultItems.powers.dropDistance,
      0,
    )
    world.run(1)
    expect(entitiesOf(world, 'tejo')).toHaveLength(1)
    expect(isHit(world, 1)).toBe(false)

    world.place(at(world, 1), tejo?.position.x ?? 0)
    world.tick()
    expect(at(world, 1).items.status.hit).toBe('flip')
    expect(entitiesOf(world, 'tejo')).toHaveLength(0)
  })

  it('does not go off under its owner right away', () => {
    const world = makeItemWorld({ count: 1, config: withItems({ powers: { dropDistance: 0 } }) })
    world.give(at(world, 0), 'tejo')
    world.press(at(world, 0))
    world.run(0.8)
    expect(entitiesOf(world, 'tejo')).toHaveLength(1)
    world.run(0.4)
    expect(entitiesOf(world, 'tejo')).toHaveLength(0)
    expect(isHit(world, 0)).toBe(true)
  })

  it('drops two when charged', () => {
    const world = makeItemWorld()
    world.give(at(world, 0), 'tejo', true, 2)
    world.press(at(world, 0))
    expect(at(world, 0).items.slot.power).toBe('tejo')
    expect(at(world, 0).items.slot.uses).toBe(1)
    world.press(at(world, 0))
    expect(entitiesOf(world, 'tejo')).toHaveLength(2)
    expect(at(world, 0).items.slot.power).toBeNull()
  })
})

describe('mango maduro', () => {
  it('spins the kart that steps on it and disappears', () => {
    const world = makeItemWorld()
    world.give(at(world, 0), 'mango')
    world.press(at(world, 0))
    const mango = entitiesOf(world, 'mango')[0]
    world.place(at(world, 1), mango?.position.x ?? 0)
    world.tick()
    expect(at(world, 1).items.status.hit).toBe('spin')
    expect(entitiesOf(world, 'mango')).toHaveLength(0)
    world.run(0.5)
    expect(at(world, 1).items.status.spinAngle).toBeGreaterThan(1)
  })

  it('drops three when charged', () => {
    const world = makeItemWorld()
    world.give(at(world, 0), 'mango', true, 3)
    for (let i = 0; i < 3; i++) world.press(at(world, 0))
    expect(entitiesOf(world, 'mango')).toHaveLength(3)
    expect(at(world, 0).items.slot.power).toBeNull()
  })
})

describe('panela turbo', () => {
  it('gives a level 2 nitro, or level 3 when charged', () => {
    const world = makeItemWorld()
    world.give(at(world, 0), 'panela')
    world.give(at(world, 1), 'panela', true)
    world.press(at(world, 0))
    world.press(at(world, 1))
    expect(at(world, 0).kart.boost.level).toBe(2)
    expect(at(world, 1).kart.boost.level).toBe(3)
    expect(at(world, 0).kart.boost.timeLeft).toBeGreaterThan(1)
    expect(at(world, 0).items.slot.power).toBeNull()
  })
})

describe('escudo de armadillo', () => {
  it('absorbs one hit, then leaves the slot empty', () => {
    const world = makeItemWorld()
    const racer = at(world, 1)
    world.give(racer, 'armadillo')
    world.press(racer)
    expect(racer.items.status.shieldHits).toBe(1)
    expect(racer.items.slot.power).toBe('armadillo')

    world.give(at(world, 0), 'rayo')
    world.give(at(world, LAST), 'rayo')
    world.press(at(world, LAST))
    expect(world.eventsOf('blocked').some((event) => event.slot === 1)).toBe(true)
    expect(racer.items.status.hit).toBeNull()
    expect(racer.items.status.shieldHits).toBe(0)
    expect(racer.items.slot.power).toBeNull()
  })

  it('lasts two hits when charged and ends with time', () => {
    const world = makeItemWorld()
    const racer = at(world, 1)
    world.give(racer, 'armadillo', true)
    world.press(racer)
    expect(racer.items.status.shieldHits).toBe(2)
    world.run(defaultItems.powers.armadillo.duration + 0.1)
    expect(racer.items.status.shieldHits).toBe(0)
    expect(racer.items.status.shieldTime).toBe(0)
    expect(racer.items.slot.power).toBeNull()
  })

  it('is thrown by a second press and spins the first kart it touches', () => {
    const world = makeItemWorld()
    const thrower = at(world, LAST)
    world.give(thrower, 'armadillo')
    world.press(thrower)
    world.press(thrower)
    expect(entitiesOf(world, 'armadillo')).toHaveLength(1)
    expect(thrower.items.status.shieldHits).toBe(0)
    expect(thrower.items.slot.power).toBeNull()
    world.run(1)
    expect(at(world, 2).items.status.hit).toBe('spin')
    expect(isHit(world, 1)).toBe(false)
    expect(entitiesOf(world, 'armadillo')).toHaveLength(0)
  })

  it('bounces off the wall and keeps rolling', () => {
    const world = makeItemWorld({ count: 1 })
    at(world, 0).kart.heading = 0
    world.give(at(world, 0), 'armadillo')
    world.press(at(world, 0))
    world.press(at(world, 0))
    // It reaches the wall at about 0.15 s and comes back across the road
    world.run(0.2)
    const shield = entitiesOf(world, 'armadillo')[0]
    expect(shield).toBeDefined()
    expect(Math.abs(wrapAngle((shield?.heading ?? 0) - Math.PI))).toBeLessThan(0.2)
    expect(Math.abs(shield?.position.z ?? 99)).toBeLessThan(
      defaultItems.powers.armadillo.wallMargin + 9,
    )
  })
})

describe('avispa teledirigida', () => {
  it('chases the kart directly ahead and spins it', () => {
    const world = makeItemWorld()
    world.give(at(world, LAST), 'avispa')
    world.press(at(world, LAST))
    expect(entitiesOf(world, 'avispa')[0]?.targetSlot).toBe(2)
    world.run(1.5)
    expect(at(world, 2).items.status.hit).toBe('spin')
    expect(isHit(world, 1)).toBe(false)
    expect(entitiesOf(world, 'avispa')).toHaveLength(0)
  })

  it('flies on and expires when nobody is ahead', () => {
    const world = makeItemWorld({ count: 2 })
    world.give(at(world, 0), 'avispa')
    world.press(at(world, 0))
    expect(entitiesOf(world, 'avispa')[0]?.targetSlot).toBe(-1)
    world.run(defaultItems.powers.avispa.lifetime + 0.5)
    expect(entitiesOf(world, 'avispa')).toHaveLength(0)
    expect(isHit(world, 1)).toBe(false)
  })

  it('steals uchuvas when charged', () => {
    const world = makeItemWorld()
    at(world, 2).items.uchuvas = 9
    world.give(at(world, LAST), 'avispa', true)
    world.press(at(world, LAST))
    world.run(1.5)
    const { lostPerHit } = defaultItems.uchuvas
    const { stolenUchuvas } = defaultItems.powers.avispa
    expect(at(world, 2).items.uchuvas).toBe(9 - lostPerHit - stolenUchuvas)
    expect(at(world, LAST).items.uchuvas).toBe(stolenUchuvas)
    expect(world.eventsOf('uchuvasStolen')[0]).toMatchObject({ from: 2, to: LAST, amount: 3 })
  })
})

describe('colibri del líder', () => {
  it('flies straight to the leader and ignores the karts in between', () => {
    const world = makeItemWorld()
    world.give(at(world, LAST), 'colibri')
    world.press(at(world, LAST))
    expect(entitiesOf(world, 'colibri')).toHaveLength(1)
    world.run(2)
    expect(at(world, 0).items.status.hit).toBe('flip')
    expect(isHit(world, 1)).toBe(false)
    expect(isHit(world, 2)).toBe(false)
  })

  it('goes for the first two when charged, and skips its owner when it leads', () => {
    const world = makeItemWorld()
    world.give(at(world, LAST), 'colibri', true)
    world.press(at(world, LAST))
    expect(entitiesOf(world, 'colibri').map((entity) => entity.targetSlot)).toEqual([0, 1])

    const leading = makeItemWorld()
    leading.give(at(leading, 0), 'colibri', true)
    leading.press(at(leading, 0))
    expect(entitiesOf(leading, 'colibri').map((entity) => entity.targetSlot)).toEqual([1, 2])
    leading.run(1.1)
    expect(isHit(leading, 1) && isHit(leading, 2)).toBe(true)
    expect(isHit(leading, 0)).toBe(false)
  })
})

describe('nube de mosquitos', () => {
  it('blinds the karts ahead for 2 s, and 3 s with a weave when charged', () => {
    const world = makeItemWorld()
    world.give(at(world, 2), 'mosquitos')
    world.press(at(world, 2))
    expect(at(world, 0).items.status.blindTime).toBeCloseTo(2, 1)
    expect(at(world, 1).items.status.blindTime).toBeCloseTo(2, 1)
    expect(at(world, 0).items.status.zigzag).toBe(false)
    expect(at(world, 3).items.status.blindTime).toBe(0)

    const charged = makeItemWorld()
    charged.give(at(charged, 2), 'mosquitos', true)
    charged.press(at(charged, 2))
    expect(at(charged, 0).items.status.blindTime).toBeCloseTo(3, 1)
    expect(at(charged, 0).items.status.zigzag).toBe(true)
    charged.run(3.1)
    expect(at(charged, 0).items.status.blindTime).toBe(0)
    expect(at(charged, 0).items.status.zigzag).toBe(false)
  })
})

describe('sombrero vueltiao', () => {
  it('flies out, spins whoever it touches once, and comes back', () => {
    const world = makeItemWorld({ config: withItems({ hit: { invulnerableTime: 0 } }) })
    world.give(at(world, LAST), 'sombrero')
    world.press(at(world, LAST))
    world.run(1.4)
    expect(at(world, 2).items.status.hit).toBe('spin')
    expect(world.eventsOf('hit').filter((event) => event.slot === 2)).toHaveLength(1)
    expect(isHit(world, LAST)).toBe(false)
    expect(entitiesOf(world, 'sombrero')).toHaveLength(1)

    world.run(3)
    expect(entitiesOf(world, 'sombrero')).toHaveLength(0)
    expect(world.eventsOf('hit').filter((event) => event.slot === 2)).toHaveLength(1)
    expect(isHit(world, LAST)).toBe(false)
  })

  it('does two laps when charged', () => {
    const run = (charged: boolean): number => {
      const world = makeItemWorld({ count: 1 })
      world.give(at(world, 0), 'sombrero', charged)
      world.press(at(world, 0))
      world.run(3)
      return entitiesOf(world, 'sombrero').length
    }
    expect(run(false)).toBe(0)
    expect(run(true)).toBe(1)
  })
})

describe('hormigas culonas', () => {
  it('steal uchuvas from the nearest rival and slow it a little', () => {
    const world = makeItemWorld()
    at(world, 2).items.uchuvas = 5
    world.give(at(world, LAST), 'hormigas')
    world.press(at(world, LAST))
    expect(entitiesOf(world, 'hormigas')[0]?.targetSlot).toBe(2)
    world.run(1)
    expect(at(world, 2).items.uchuvas).toBe(5 - defaultItems.powers.hormigas.stolen)
    expect(at(world, LAST).items.uchuvas).toBe(defaultItems.powers.hormigas.stolen)
    expect(isHit(world, 2)).toBe(false)
    expect(at(world, 2).items.status.dizzyTime).toBeGreaterThan(0)
  })

  it('steal double when charged, also from a rival behind', () => {
    const world = makeItemWorld()
    at(world, LAST).items.uchuvas = 7
    world.give(at(world, 0), 'hormigas', true)
    world.place(at(world, 1), 100)
    world.place(at(world, 2), 200)
    world.place(at(world, LAST), 780)
    world.press(at(world, 0))
    world.run(1)
    expect(at(world, 0).items.uchuvas).toBe(defaultItems.powers.hormigas.chargedStolen)
    expect(at(world, LAST).items.uchuvas).toBe(7 - defaultItems.powers.hormigas.chargedStolen)
  })

  it('are kept when no rival is in range', () => {
    const world = makeItemWorld({ count: 2 })
    world.place(at(world, 1), 800 - defaultItems.powers.hormigas.range - 10)
    world.give(at(world, 0), 'hormigas')
    world.press(at(world, 0))
    expect(at(world, 0).items.slot.power).toBe('hormigas')
    expect(entitiesOf(world, 'hormigas')).toHaveLength(0)
  })
})

describe('aguacero', () => {
  it('rains on the karts ahead; charged also slows them', () => {
    const world = makeItemWorld()
    world.give(at(world, 2), 'aguacero')
    world.press(at(world, 2))
    expect(at(world, 0).items.status.rainTime).toBeCloseTo(defaultItems.powers.aguacero.duration, 1)
    expect(at(world, 1).items.status.slowed).toBe(false)
    expect(at(world, 3).items.status.rainTime).toBe(0)

    const charged = makeItemWorld()
    charged.give(at(charged, 2), 'aguacero', true)
    charged.press(at(charged, 2))
    expect(at(charged, 0).items.status.slowed).toBe(true)
    charged.run(3.2)
    expect(at(charged, 0).items.status.rainTime).toBe(0)
    expect(at(charged, 0).items.status.slowed).toBe(false)
  })
})

describe('rayo del Catatumbo', () => {
  it('hits everyone ahead, but not shields or masks', () => {
    const world = makeItemWorld()
    at(world, 1).items.status.shieldHits = 1
    at(world, 1).items.status.shieldTime = 5
    at(world, 0).items.status.maskTime = 5
    world.give(at(world, 2), 'rayo')
    world.give(at(world, 3), 'rayo')
    world.press(at(world, 3))
    expect(world.eventsOf('lightning')[0]?.slots).toEqual([0, 1, 2])
    expect(isHit(world, 2)).toBe(true)
    expect(at(world, 2).items.status.hit).toBe(defaultItems.powers.rayo.hit)
    expect(isHit(world, 1)).toBe(false)
    expect(isHit(world, 0)).toBe(false)
    expect(
      world
        .eventsOf('blocked')
        .map((event) => event.slot)
        .sort(),
    ).toEqual([0, 1])
  })

  it('also empties the slot and roulette of the victims when charged', () => {
    const world = makeItemWorld()
    world.give(at(world, 0), 'coco')
    at(world, 1).items.slot.rouletteTime = 1
    world.give(at(world, LAST), 'rayo', true)
    world.press(at(world, LAST))
    expect(at(world, 0).items.slot.power).toBeNull()
    expect(at(world, 1).items.slot.rouletteTime).toBe(0)

    const plain = makeItemWorld()
    plain.give(at(plain, 0), 'coco')
    plain.give(at(plain, LAST), 'rayo')
    plain.press(at(plain, LAST))
    expect(at(plain, 0).items.slot.power).toBe('coco')
  })
})

describe('máscara del Carnaval', () => {
  it('lasts 6 s (8 charged), blocks hits and flips karts it touches', () => {
    const world = makeItemWorld()
    world.give(at(world, 1), 'mascara')
    world.give(at(world, 2), 'mascara', true)
    world.press(at(world, 1))
    world.press(at(world, 2))
    expect(at(world, 1).items.status.maskTime).toBeCloseTo(defaultItems.powers.mascara.duration, 1)
    expect(at(world, 2).items.status.maskTime).toBeCloseTo(
      defaultItems.powers.mascara.chargedDuration,
      1,
    )

    world.place(at(world, LAST), at(world, 2).kart.position.x - 2)
    world.tick()
    expect(at(world, LAST).items.status.hit).toBe('flip')
    expect(isHit(world, 2)).toBe(false)

    world.place(at(world, LAST), 600)
    world.give(at(world, LAST), 'rayo')
    world.run(1.6)
    world.press(at(world, LAST))
    expect(isHit(world, 1)).toBe(false)
    expect(world.eventsOf('blocked').length).toBeGreaterThan(0)
  })
})

describe('hit rules', () => {
  it('gives a window of invulnerability and takes uchuvas away', () => {
    const world = makeItemWorld()
    at(world, 0).items.uchuvas = 8
    world.give(at(world, LAST), 'rayo')
    world.press(at(world, LAST))
    expect(at(world, 0).items.uchuvas).toBe(8 - defaultItems.uchuvas.lostPerHit)
    world.give(at(world, LAST), 'rayo')
    world.press(at(world, LAST))
    expect(world.eventsOf('hit').filter((event) => event.slot === 0)).toHaveLength(1)
    expect(at(world, 0).items.uchuvas).toBe(8 - defaultItems.uchuvas.lostPerHit)

    world.run(defaultItems.hit.invulnerableTime + 0.5)
    world.give(at(world, LAST), 'rayo')
    world.press(at(world, LAST))
    expect(world.eventsOf('hit').filter((event) => event.slot === 0)).toHaveLength(2)
  })

  it('never hits finished or not racing karts', () => {
    const world = makeItemWorld()
    at(world, 0).race.state.phase = 'finished'
    world.give(at(world, LAST), 'rayo')
    world.press(at(world, LAST))
    expect(isHit(world, 0)).toBe(false)
    expect(isHit(world, 1)).toBe(true)
  })

  it('does not let karts outside the racing phase use items', () => {
    const world = makeItemWorld()
    at(world, 0).race.state.phase = 'countdown'
    world.give(at(world, 0), 'panela')
    world.press(at(world, 0))
    expect(at(world, 0).items.slot.power).toBe('panela')
    expect(at(world, 0).kart.boost.level).toBe(0)
  })

  it('needs a fresh press: holding the button uses one power only', () => {
    const world = makeItemWorld()
    world.give(at(world, 0), 'mango', true, 3)
    world.run(0.5, new Map([[at(world, 0), { useItem: true }]]))
    expect(entitiesOf(world, 'mango')).toHaveLength(1)
  })

  it('numbers entities from 1 upwards and restarts after reset', () => {
    const world = makeItemWorld()
    world.give(at(world, 0), 'mango', true, 3)
    world.press(at(world, 0))
    world.press(at(world, 0))
    expect(world.system.entities.map((entity) => entity.id)).toEqual([1, 2])
    world.system.reset()
    expect(world.system.entities).toHaveLength(0)
    world.give(at(world, 0), 'mango')
    world.press(at(world, 0))
    expect(world.system.entities[0]?.id).toBe(1)
  })

  it('spaces the staged karts as the helpers promise', () => {
    const world = makeItemWorld()
    expect(at(world, 0).kart.position.x - at(world, 1).kart.position.x).toBe(SPACING)
  })
})
