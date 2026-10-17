/**
 * Playable characters (docs/diseno.md §3): four stats from 1 to 5 plus one passive perk each.
 * Stats are plain numbers here; `characterTuning` says how a stat point maps to physics and
 * holds the numbers of every perk, so everything is tunable from this file.
 */

export type CharacterId =
  'chiguiro' | 'oso' | 'titi' | 'condor' | 'jaguar' | 'guacamaya' | 'delfin' | 'perezoso'

/** Every character, in menu order. */
export const characterIds: readonly CharacterId[] = [
  'chiguiro',
  'oso',
  'titi',
  'condor',
  'jaguar',
  'guacamaya',
  'delfin',
  'perezoso',
]

/** Stats from 1 to 5. */
export interface CharacterStats {
  speed: number
  acceleration: number
  handling: number
  weight: number
}

export interface CharacterDefinition {
  id: CharacterId
  /** Spanish display name. */
  name: string
  stats: CharacterStats
  perk: { name: string; description: string }
}

export const characters: Record<CharacterId, CharacterDefinition> = {
  chiguiro: {
    id: 'chiguiro',
    name: 'Chigüiro',
    stats: { speed: 3, acceleration: 3, handling: 3, weight: 3 },
    perk: { name: 'Tranquilo', description: 'Se recupera de golpes un 30 % más rápido.' },
  },
  oso: {
    id: 'oso',
    name: 'Oso de anteojos',
    stats: { speed: 4, acceleration: 2, handling: 2, weight: 5 },
    perk: {
      name: 'Aplanadora',
      description: 'Empuja a los rivales al chocar y resiste mejor los empujones.',
    },
  },
  titi: {
    id: 'titi',
    name: 'Tití',
    stats: { speed: 2, acceleration: 5, handling: 4, weight: 1 },
    perk: { name: 'Ágil', description: 'Carga el derrape más rápido.' },
  },
  condor: {
    id: 'condor',
    name: 'Cóndor',
    stats: { speed: 3, acceleration: 3, handling: 3, weight: 2 },
    perk: {
      name: 'Planeo',
      description: 'Más tiempo en el aire y control en saltos; turbo de aterrizaje mayor.',
    },
  },
  jaguar: {
    id: 'jaguar',
    name: 'Jaguar',
    stats: { speed: 5, acceleration: 3, handling: 2, weight: 3 },
    perk: {
      name: 'Depredador',
      description: 'Gana velocidad extra al ir detrás de un rival (rebufo).',
    },
  },
  guacamaya: {
    id: 'guacamaya',
    name: 'Guacamaya',
    stats: { speed: 3, acceleration: 4, handling: 3, weight: 2 },
    perk: { name: 'Coleccionista', description: 'Los poderes de sus cajas duran un 25 % más.' },
  },
  delfin: {
    id: 'delfin',
    name: 'Delfín rosado',
    stats: { speed: 3, acceleration: 3, handling: 4, weight: 3 },
    perk: { name: 'Anfibio', description: 'Sin penalización en agua y barro.' },
  },
  perezoso: {
    id: 'perezoso',
    name: 'Perezoso',
    stats: { speed: 2, acceleration: 2, handling: 4, weight: 3 },
    perk: {
      name: 'Calma total',
      description: 'Nitros más largos; su tercer nitro dura el doble.',
    },
  },
}

/** Surfaces that have a penalty to ignore (kept as strings so config does not import the sim). */
export type PenaltySurface = 'mud' | 'water' | 'dirt' | 'grass'

export interface CharacterTuning {
  stats: {
    /** The stat value that changes nothing. */
    neutral: number
    /** Max speed change per stat point (fraction). */
    speedPerPoint: number
    /** Acceleration change per stat point (fraction). */
    accelerationPerPoint: number
    /** Turn rate and lateral grip change per stat point (fraction). */
    handlingPerPoint: number
    /** Kart-vs-kart mass change per weight point (fraction of the neutral mass 1). */
    massPerPoint: number
    /** Lowest mass allowed, so a very light kart never gets a tiny or negative mass. */
    minMass: number
  }
  perks: {
    /** Chigüiro: hit, spin, flip and dizzy timers advance this many times faster. */
    tranquilo: { recoveryRate: number }
    /** Oso: multiplies its collision mass on top of its weight stat. */
    aplanadora: { massFactor: number }
    /** Tití: multiplies the drift charge rate. */
    agil: { driftChargeFactor: number }
    /** Cóndor: air control and landing. */
    planeo: {
      /** Gravity multiplier while airborne (below 1 = more hang time). */
      airGravityFactor: number
      /** Yaw rate (rad/s) at full steer while airborne. */
      airSteerRate: number
      /** Multiplies the landing boost duration. */
      landingBoostFactor: number
    }
    /** Jaguar: slipstream behind a rival. */
    depredador: {
      /** Farthest rival ahead that gives a slipstream (m). */
      range: number
      /** Half angle of the cone in front of the kart (rad). */
      coneHalfAngle: number
      /** Extra top speed at point-blank range (fraction); falls off linearly with distance. */
      speedBonus: number
      /** Extra acceleration at point-blank range (fraction). */
      accelerationBonus: number
      /** Rivals whose height differs more than this (m) give no slipstream. */
      maxHeightGap: number
    }
    /** Guacamaya: multiplies the duration of timed powers it uses. */
    coleccionista: { durationFactor: number }
    /** Delfín: surfaces whose speed, acceleration and grip penalty is ignored. */
    anfibio: { surfaces: readonly PenaltySurface[] }
    /** Perezoso: nitro durations. */
    calmaTotal: {
      /** Multiplies every nitro the kart fires. */
      nitroDurationFactor: number
      /** Multiplies the third nitro of a chain, on top of the factor above. */
      thirdNitroDurationFactor: number
    }
  }
}

export const characterTuning: CharacterTuning = {
  stats: {
    neutral: 3,
    speedPerPoint: 0.025,
    accelerationPerPoint: 0.08,
    handlingPerPoint: 0.06,
    massPerPoint: 0.25,
    minMass: 0.2,
  },
  perks: {
    tranquilo: { recoveryRate: 1.3 },
    aplanadora: { massFactor: 1.3 },
    agil: { driftChargeFactor: 1.3 },
    planeo: { airGravityFactor: 0.75, airSteerRate: 1.2, landingBoostFactor: 1.5 },
    depredador: {
      range: 14,
      coneHalfAngle: (14 * Math.PI) / 180,
      speedBonus: 0.06,
      accelerationBonus: 0.2,
      maxHeightGap: 1.5,
    },
    coleccionista: { durationFactor: 1.25 },
    anfibio: { surfaces: ['mud', 'water'] },
    // 1.25 * 1.6 = 2 for the third nitro: "double"
    calmaTotal: { nitroDurationFactor: 1.25, thirdNitroDurationFactor: 1.6 },
  },
}
