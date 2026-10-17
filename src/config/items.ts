/**
 * Powers, boxes and uchuvas (docs/diseno.md §4.5 and §5). Distances in meters, time in seconds.
 * Values to be tuned in play tests.
 */
import type { PowerId } from '../sim/items/itemTypes'

export interface UchuvaConfig {
  /** Most uchuvas a kart can carry; reaching it turns on Bien Cargado. */
  max: number
  /** Extra top speed per uchuva, as a fraction of the top speed. */
  speedBonusPerUchuva: number
  /** Uchuvas lost on every hit that lands. */
  lostPerHit: number
  /** Uchuvas a box gives besides the power. */
  perBox: number
  /** Seconds until a taken uchuva reappears. */
  respawnTime: number
  /** Pickup distance from the kart center. */
  pickupRadius: number
}

export interface BoxConfig {
  /** Seconds until a broken box reappears. */
  respawnTime: number
  /** Pickup distance from the kart center. */
  pickupRadius: number
  /** Seconds the roulette spins before the power is ready. */
  rouletteTime: number
  /** Seconds each power stays on the roulette display while it spins. */
  rouletteTick: number
}

export interface HitConfig {
  /** Seconds of a spin-out (no control). */
  spinTime: number
  /** Full turns the kart view makes while spinning out. */
  spinTurns: number
  /** Seconds of a flip (launched into the air, no control). */
  flipTime: number
  /** Upward speed of a flip (m/s). */
  flipLaunchSpeed: number
  /** How fast a hit kart loses horizontal speed (1/s). */
  hitDamping: number
  /** Seconds of reduced top speed after a hit. */
  dizzyTime: number
  /** Share of the top speed kept while dizzy. */
  dizzySpeedFactor: number
  /** Seconds after a hit during which no other hit lands. */
  invulnerableTime: number
}

/** Tunables of every power: normal version and Bien Cargado where it changes a number. */
export interface PowerConfig {
  coco: {
    speed: number
    /** Seconds before it explodes on its own. */
    fuse: number
    radius: number
    chargedRadius: number
  }
  tejo: { uses: number; chargedUses: number; radius: number; triggerRadius: number }
  mango: { uses: number; chargedUses: number; triggerRadius: number }
  panela: { level: 2; chargedLevel: 3; duration: number }
  armadillo: {
    /** Seconds the shield lasts around the kart. */
    duration: number
    hits: number
    chargedHits: number
    throwSpeed: number
    /** Seconds a thrown shield rolls before vanishing. */
    lifetime: number
  }
  avispa: { speed: number; turnRate: number; lifetime: number; stolenUchuvas: number }
  colibri: { speed: number; targets: number; chargedTargets: number }
  mosquitos: { duration: number; chargedDuration: number; zigzagAmplitude: number }
  sombrero: {
    speed: number
    /** Seconds it flies out before turning back. */
    outTime: number
    laps: number
    chargedLaps: number
  }
  hormigas: { speed: number; range: number; stolen: number; chargedStolen: number }
  aguacero: {
    duration: number
    /** Share of the lateral grip kept under the rain. */
    gripFactor: number
    /** Share of the top speed kept under the rain (Bien Cargado). */
    chargedSpeedFactor: number
  }
  rayo: { hit: 'spin' | 'flip' }
  mascara: { duration: number; chargedDuration: number; speedBonus: number }
  /** Radius of a moving power (or a mask-wearing kart) when it touches a kart. */
  contactRadius: number
}

/** Weight of each power in the roulette for one band of race positions. */
export interface PowerBand {
  /** Highest position (1-based) this band covers, as a fraction of the field (1 = last). */
  upTo: number
  weights: Partial<Record<PowerId, number>>
}

export interface ItemsConfig {
  uchuvas: UchuvaConfig
  boxes: BoxConfig
  hit: HitConfig
  powers: PowerConfig
  /** Bands from the leader backwards (docs/diseno.md §5, "Reparto sugerido por posición"). */
  distribution: readonly PowerBand[]
}

export const defaultItems: ItemsConfig = {
  uchuvas: {
    max: 10,
    speedBonusPerUchuva: 0.008,
    lostPerHit: 3,
    perBox: 1,
    respawnTime: 8,
    pickupRadius: 1.6,
  },
  boxes: { respawnTime: 2, pickupRadius: 1.8, rouletteTime: 1.5, rouletteTick: 0.08 },
  hit: {
    spinTime: 1.1,
    spinTurns: 2,
    flipTime: 1.3,
    flipLaunchSpeed: 9,
    hitDamping: 2.5,
    dizzyTime: 0.8,
    dizzySpeedFactor: 0.7,
    invulnerableTime: 1.5,
  },
  powers: {
    coco: { speed: 42, fuse: 3, radius: 4, chargedRadius: 7 },
    tejo: { uses: 1, chargedUses: 2, radius: 4, triggerRadius: 1.6 },
    mango: { uses: 1, chargedUses: 3, triggerRadius: 1.5 },
    panela: { level: 2, chargedLevel: 3, duration: 1.5 },
    armadillo: { duration: 12, hits: 1, chargedHits: 2, throwSpeed: 45, lifetime: 4 },
    avispa: { speed: 48, turnRate: 4, lifetime: 8, stolenUchuvas: 3 },
    colibri: { speed: 60, targets: 1, chargedTargets: 2 },
    mosquitos: { duration: 2, chargedDuration: 3, zigzagAmplitude: 0.5 },
    sombrero: { speed: 40, outTime: 1.2, laps: 1, chargedLaps: 2 },
    hormigas: { speed: 50, range: 60, stolen: 2, chargedStolen: 4 },
    aguacero: { duration: 3, gripFactor: 0.3, chargedSpeedFactor: 0.75 },
    rayo: { hit: 'spin' },
    mascara: { duration: 6, chargedDuration: 8, speedBonus: 0.2 },
    contactRadius: 1.6,
  },
  distribution: [
    { upTo: 0.25, weights: { mango: 3, tejo: 3, armadillo: 3, coco: 2 } },
    {
      upTo: 0.625,
      weights: { coco: 3, avispa: 3, sombrero: 2, panela: 2, hormigas: 2, mango: 1 },
    },
    {
      upTo: 1,
      weights: { colibri: 2, aguacero: 3, mosquitos: 3, rayo: 1, mascara: 1, panela: 2 },
    },
  ],
}

/** Display name of each power (HUD). */
export const POWER_NAMES: Record<PowerId, string> = {
  coco: 'Coco bomba',
  tejo: 'Tejo con mecha',
  mango: 'Mango maduro',
  panela: 'Panela turbo',
  armadillo: 'Escudo de armadillo',
  avispa: 'Avispa teledirigida',
  colibri: 'Colibrí del líder',
  mosquitos: 'Nube de mosquitos',
  sombrero: 'Sombrero vueltiao',
  hormigas: 'Hormigas culonas',
  aguacero: 'Aguacero',
  rayo: 'Rayo del Catatumbo',
  mascara: 'Máscara del Carnaval',
}
