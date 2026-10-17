import { describe, expect, it } from 'vitest'
import { ItemControl, type ItemCommand } from '../src/ai/itemControl'
import { RacingBot } from '../src/ai/racingBot'
import { createRng } from '../src/ai/random'
import { botBehavior, botDifficulties, type BotDifficultyConfig } from '../src/config/bots'
import type { BotContext } from '../src/input/botInput'
import type { PowerId } from '../src/sim/items/itemTypes'
import { forwardOf } from '../src/sim/math'
import { createRacer, type Racer } from '../src/sim/racer'
import { DT, makeWorld } from './helpers/botSim'

const world = makeWorld(3, 0)

/** Fast reaction so most tests do not wait. */
const skill: BotDifficultyConfig = {
  ...botDifficulties.normal,
  itemReactionDelay: 0.2,
  itemDefensiveChance: 1,
}

function makeRacer(slot: number): Racer {
  const racer = createRacer(world.track, { totalLaps: 3, countdownSeconds: 0 }, slot)
  racer.race.state.phase = 'racing'
  return racer
}

/** Self at the pole and a rival `ahead` meters in front (negative = behind), `lateral` to the right. */
function setup(ahead: number | null, lateral = 0) {
  const self = makeRacer(0)
  const racers = [self]
  let rival: Racer | null = null
  if (ahead !== null) {
    rival = makeRacer(1)
    const f = forwardOf(self.kart.heading)
    const r = { x: -f.z, z: f.x }
    rival.kart.position = {
      ...self.kart.position,
      x: self.kart.position.x + f.x * ahead + r.x * lateral,
      z: self.kart.position.z + f.z * ahead + r.z * lateral,
    }
    racers.push(rival)
  }
  const ctx: BotContext = { world, self, racers }
  return { self, rival, ctx }
}

function give(self: Racer, power: PowerId, uses = 1): void {
  self.items.slot.power = power
  self.items.slot.uses = uses
}

function makeControl(overrides: Partial<BotDifficultyConfig> = {}, seed = 1): ItemControl {
  return new ItemControl({ ...skill, ...overrides }, botBehavior, createRng(seed))
}

/** Runs the control for `seconds`; returns the commands per step. */
function run(control: ItemControl, ctx: BotContext, seconds: number, turn = 0): ItemCommand[] {
  const out: ItemCommand[] = []
  for (let i = 0; i < Math.round(seconds / DT); i++) out.push(control.update(DT, ctx, turn))
  return out
}

const pressed = (cmds: ItemCommand[]): boolean => cmds.some((c) => c.useItem)

describe('ItemControl', () => {
  it('fires coco at a kart straight ahead, not forward when it is off to the side or far', () => {
    const near = setup(15)
    give(near.self, 'coco')
    const cmds = run(makeControl(), near.ctx, 1)
    expect(pressed(cmds)).toBe(true)
    expect(cmds.some((c) => c.lookBack)).toBe(false)

    const far = setup(60)
    give(far.self, 'coco')
    expect(pressed(run(makeControl(), far.ctx, 3))).toBe(false)

    const side = setup(15, 12)
    give(side.self, 'coco')
    expect(pressed(run(makeControl(), side.ctx, 3))).toBe(false)
  })

  it('does nothing when nobody is near', () => {
    const { self, ctx } = setup(null)
    give(self, 'coco')
    expect(pressed(run(makeControl(), ctx, 3))).toBe(false)
  })

  it('throws coco backwards at a kart close behind', () => {
    const { self, ctx } = setup(-8)
    give(self, 'coco')
    const press = run(makeControl(), ctx, 1).find((c) => c.useItem)
    expect(press?.lookBack).toBe(true)
  })

  it('drops mango with a kart behind and keeps dropping all uses with a gap', () => {
    const { self, ctx: base } = setup(-8)
    const racers = [...base.racers]
    const ctx: BotContext = { ...base, racers }
    give(self, 'mango', 3)
    const control = makeControl()
    let drops = 0
    let steps = 0
    let first = -1
    for (let i = 0; i < 4 / DT; i++) {
      const cmd = control.update(DT, ctx, 0)
      if (cmd.useItem) {
        drops++
        if (first < 0) first = steps
        self.items.slot.uses--
        if (self.items.slot.uses === 0) self.items.slot.power = null
        // The rival leaves, later drops must not need it
        racers.length = 1
      }
      steps++
    }
    expect(drops).toBe(3)
  })

  it('does not drop a mango when nobody is behind (until the hold timeout)', () => {
    const { self, ctx } = setup(20)
    give(self, 'mango')
    const control = makeControl()
    expect(pressed(run(control, ctx, 7))).toBe(false)
    expect(pressed(run(control, ctx, 2))).toBe(true)
  })

  it('never presses with an empty slot, during the roulette, countdown or a hit', () => {
    const { self, ctx } = setup(10)
    const control = makeControl()
    expect(pressed(run(control, ctx, 2))).toBe(false)

    give(self, 'coco')
    self.items.slot.rouletteTime = 1
    expect(pressed(run(control, ctx, 0.5))).toBe(false)
    self.items.slot.rouletteTime = 0

    self.race.state.phase = 'countdown'
    expect(pressed(run(makeControl(), ctx, 1))).toBe(false)
    self.race.state.phase = 'racing'

    self.items.status.hit = 'spin'
    expect(pressed(run(makeControl(), ctx, 1))).toBe(false)
    self.items.status.hit = null
    expect(pressed(run(makeControl(), ctx, 1))).toBe(true)
  })

  it('waits the reaction delay after getting a power', () => {
    const { self, ctx } = setup(10)
    give(self, 'coco')
    const cmds = run(makeControl({ itemReactionDelay: 1 }), ctx, 2)
    const first = cmds.findIndex((c) => c.useItem)
    expect(first * DT).toBeGreaterThanOrEqual(0.95)
    expect(first * DT).toBeLessThan(1.1)
  })

  it('presses in single-step pulses (rising edges)', () => {
    const { self, ctx } = setup(10)
    give(self, 'coco')
    const cmds = run(makeControl(), ctx, 3)
    for (let i = 1; i < cmds.length; i++) {
      if (cmds[i]?.useItem) expect(cmds[i - 1]?.useItem).toBe(false)
    }
    expect(cmds.filter((c) => c.useItem).length).toBeGreaterThan(1)
  })

  it('uses any power after the hold timeout', () => {
    const { self, ctx } = setup(null)
    give(self, 'sombrero')
    const cmds = run(makeControl(), ctx, 10)
    const first = cmds.findIndex((c) => c.useItem)
    expect(first * DT).toBeGreaterThanOrEqual(botBehavior.itemHoldTimeout - 0.1)
    expect(first * DT).toBeLessThan(botBehavior.itemHoldTimeout + 0.2)
  })

  it('uses mascara at once and panela only on a straight when required', () => {
    const a = setup(null)
    give(a.self, 'mascara')
    expect(pressed(run(makeControl(), a.ctx, 0.5))).toBe(true)

    const b = setup(null)
    give(b.self, 'panela')
    expect(pressed(run(makeControl({ panelaNeedsStraight: true }), b.ctx, 1, 1))).toBe(false)
    expect(pressed(run(makeControl({ panelaNeedsStraight: true }), b.ctx, 1, 0))).toBe(true)
    expect(pressed(run(makeControl({ panelaNeedsStraight: false }), b.ctx, 1, 1))).toBe(true)
  })

  it('uses global powers only when not leading', () => {
    const lead = setup(null)
    give(lead.self, 'mosquitos')
    expect(pressed(run(makeControl(), lead.ctx, 2))).toBe(false)

    const behind = setup(30)
    give(behind.self, 'mosquitos')
    const rival = behind.rival as Racer
    rival.race.state.lastPassedCheckpoint = 3
    expect(pressed(run(makeControl(), behind.ctx, 1))).toBe(true)
  })

  it('armadillo: shield with a kart behind, throw forward once one is ahead', () => {
    const { self, rival, ctx } = setup(-8)
    give(self, 'armadillo', 1)
    const control = makeControl()
    expect(pressed(run(control, ctx, 1))).toBe(true)
    self.items.status.shieldHits = 1
    // Move the rival in front of the bot
    const f = forwardOf(self.kart.heading)
    const other = rival as Racer
    other.kart.position = {
      ...self.kart.position,
      x: self.kart.position.x + f.x * 10,
      z: self.kart.position.z + f.z * 10,
    }
    expect(pressed(run(control, ctx, 1))).toBe(true)
  })

  it('is deterministic', () => {
    const play = (): boolean[] => {
      const { self, ctx } = setup(-8)
      give(self, 'mango', 1)
      const control = makeControl({ itemDefensiveChance: 0.5 }, 7)
      return run(control, ctx, 10).map((c) => c.useItem)
    }
    expect(play()).toEqual(play())
  })
})

describe('RacingBot with items', () => {
  it('presses use when holding a power and a kart is right ahead', () => {
    const { self, ctx } = setup(12)
    give(self, 'coco')
    const bot = new RacingBot({ skill: { ...skill, itemReactionDelay: 0.1 }, seed: 3 })
    let used = false
    for (let i = 0; i < 120; i++) used ||= bot.nextInput(DT, ctx).useItem
    expect(used).toBe(true)
  })

  it('does not press anything without a power', () => {
    const { ctx } = setup(12)
    const bot = new RacingBot({ seed: 3 })
    for (let i = 0; i < 120; i++) expect(bot.nextInput(DT, ctx).useItem).toBe(false)
  })

  it('does not reverse because of a spin-out', () => {
    const { self, ctx } = setup(null)
    const bot = new RacingBot({ seed: 3 })
    self.items.status.hit = 'spin'
    for (let i = 0; i < 240; i++) {
      const input = bot.nextInput(DT, ctx)
      expect(input.brake).toBe(0)
    }
  })
})
