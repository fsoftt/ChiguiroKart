import type { CharacterId } from '../../config/characters'
import { addKart, gripPoint, SEAT, type KartPalette, type KartStyle } from './kartModel'
import {
  condorDriver,
  delfinDriver,
  guacamayaDriver,
  jaguarDriver,
  perezosoDriver,
  titiDriver,
} from './animalPilots'
import { osoDriver } from './heroPilots'
import { cone, sphere, type ModelKit } from './modelKit'

export type DanceStyle = 'cumbia' | 'champeta' | 'joropo'

export interface CharacterModelSpec {
  kart: KartPalette
  kartStyle: KartStyle
  /** Victory dance of the `victory` clip. */
  dance: DanceStyle
  /** How far the head swings in the clips (1 = normal); calm or nervous characters. */
  energy: number
  /** How far the eyelids travel from their resting angle to fully closed (rad); default 1.3. */
  lidTravel?: number
  /** Adds the driver's parts and sets the driver bones. */
  driver(kit: ModelKit): void
}

const WHITE = '#fbfbf7'
const BLACK = '#1b1b1d'

interface EyeOptions {
  /** Distance from the center line. */
  x: number
  y: number
  z: number
  radius: number
  iris?: string
  /** Turns the eyes outward (rad). */
  spread?: number
}

/** Big cartoon eyes: white, iris or pupil, and a highlight. */
function eyes(kit: ModelKit, { x, y, z, radius, iris, spread = 0.25 }: EyeOptions): void {
  const front = radius * 0.62
  const outward = Math.sin(spread) * front
  kit.addMirrored('head', 'head', sphere(radius, 10), WHITE, { position: [x, y, z] })
  kit.addMirrored('head', 'head', sphere(radius * 0.6, 8), iris ?? BLACK, {
    position: [x + outward, y, z + front],
    scale: [1, 1, 0.6],
  })
  if (iris) {
    kit.addMirrored('head', 'head', sphere(radius * 0.32, 6), BLACK, {
      position: [x + outward * 1.15, y, z + front + radius * 0.2],
      scale: [0.7, 1, 0.5],
    })
  }
  kit.addMirrored('head', 'head', sphere(radius * 0.18, 4), WHITE, {
    position: [x + outward + radius * 0.15, y + radius * 0.25, z + front + radius * 0.3],
  })
}

/** Arms from the shoulders to the steering wheel, with round hands or paws. */
function arms(
  kit: ModelKit,
  shoulder: readonly [number, number, number],
  radius: number,
  color: string,
  hand: string,
): void {
  const [sx, sy, sz] = shoulder
  const [gripX, wheelY, wheelZ] = gripPoint(1)
  kit.bone('armL', sx, sy, sz).bone('armR', -sx, sy, sz)
  kit.segment('armL', [sx, sy, sz], [gripX, wheelY, wheelZ], radius, color)
  kit.segment('armR', [-sx, sy, sz], [-gripX, wheelY, wheelZ], radius, color)
  kit.addMirrored('armL', 'armR', sphere(radius * 1.15, 8), hand, {
    position: [gripX, wheelY, wheelZ],
  })
}

function driverBones(kit: ModelKit, headY: number, headZ: number, tail?: [number, number]): void {
  kit
    .bone('body', 0, SEAT.y, SEAT.z)
    .bone('head', 0, headY, headZ)
    .bone('earL', 0.15, headY + 0.2, headZ)
    .bone('earR', -0.15, headY + 0.2, headZ)
    .bone('tail', 0, tail?.[0] ?? 0.85, tail?.[1] ?? -0.65)
}

const chiguiro: CharacterModelSpec = {
  kart: { body: '#f2c230', accent: '#2f9e44', dark: '#2e3a2a', number: 7 },
  kartStyle: 'leafy',
  dance: 'cumbia',
  energy: 0.6,
  driver(kit) {
    const fur = '#a5683c'
    const dark = '#6e4224'
    driverBones(kit, 1.36, -0.18)
    kit.add('body', sphere(1, 12), fur, { position: [0, 1.0, -0.32], scale: [0.42, 0.42, 0.46] })
    kit.add('body', sphere(1, 10), '#c18a5a', {
      position: [0, 0.98, -0.02],
      scale: [0.3, 0.3, 0.16],
    })
    // Long blocky head with a big dark snout
    kit.add('head', sphere(1, 12), fur, {
      position: [0, 1.44, -0.12],
      rotation: [0.12, 0, 0],
      scale: [0.3, 0.28, 0.42],
    })
    kit.add('head', sphere(1, 10), '#9a5e34', {
      position: [0, 1.39, 0.2],
      rotation: [0.15, 0, 0],
      scale: [0.23, 0.2, 0.3],
    })
    kit.addMirrored('head', 'head', sphere(1, 6), dark, {
      position: [0.06, 1.5, 0.42],
      rotation: [0, 0, 0.5],
      scale: [0.035, 0.018, 0.03],
    })
    eyes(kit, { x: 0.17, y: 1.56, z: 0.04, radius: 0.085 })
    kit.addMirrored('earL', 'earR', sphere(1, 8), dark, {
      position: [0.2, 1.68, -0.24],
      scale: [0.08, 0.09, 0.05],
    })
    arms(kit, [0.3, 1.1, -0.2], 0.09, fur, dark)
    // Its friend: a little cattle egret riding on its head
    kit.add('earL', sphere(1, 8), WHITE, { position: [0, 1.76, -0.22], scale: [0.09, 0.08, 0.13] })
    kit.add('earL', sphere(0.06, 8), WHITE, { position: [0, 1.85, -0.13] })
    kit.add('earL', cone(0.02, 0.1, 5), '#f29a2e', {
      position: [0, 1.85, -0.05],
      rotation: [Math.PI / 2, 0, 0],
    })
    kit.add('earL', sphere(0.012, 4), BLACK, { position: [0.03, 1.87, -0.1] })
  },
}

const oso: CharacterModelSpec = {
  kart: { body: '#d8342c', accent: '#7a4a2b', dark: '#2b211c', number: 3 },
  kartStyle: 'heavy',
  dance: 'joropo',
  energy: 0.8,
  lidTravel: 2.6,
  driver: osoDriver,
}

const titi: CharacterModelSpec = {
  kart: { body: '#f07a1a', accent: '#ffd23f' },
  kartStyle: 'sport',
  dance: 'champeta',
  energy: 1.5,
  lidTravel: 2.6,
  driver: titiDriver,
}

const condor: CharacterModelSpec = {
  kart: { body: '#2d6cdf', accent: '#f2c230' },
  kartStyle: 'sport',
  dance: 'joropo',
  energy: 0.7,
  lidTravel: 2.6,
  driver: condorDriver,
}

const jaguar: CharacterModelSpec = {
  kart: { body: '#262636', accent: '#e9a23b' },
  kartStyle: 'sport',
  dance: 'champeta',
  energy: 1,
  lidTravel: 2.6,
  driver: jaguarDriver,
}

const guacamaya: CharacterModelSpec = {
  kart: { body: '#3fb54a', accent: '#ffcc1a' },
  kartStyle: 'classic',
  dance: 'cumbia',
  energy: 1.3,
  lidTravel: 2.6,
  driver: guacamayaDriver,
}

const delfin: CharacterModelSpec = {
  kart: { body: '#22b0cf', accent: '#ffffff' },
  kartStyle: 'boat',
  dance: 'cumbia',
  energy: 1.1,
  lidTravel: 2.6,
  driver: delfinDriver,
}

const perezoso: CharacterModelSpec = {
  kart: { body: '#5f8a35', accent: '#a7d46f', dark: '#4a3523' },
  kartStyle: 'leafy',
  dance: 'joropo',
  energy: 0.4,
  lidTravel: 1.25,
  driver: perezosoDriver,
}

export const characterModels: Record<CharacterId, CharacterModelSpec> = {
  chiguiro,
  oso,
  titi,
  condor,
  jaguar,
  guacamaya,
  delfin,
  perezoso,
}

/** Adds kart and driver of a character to a fresh kit. */
export function buildCharacterParts(kit: ModelKit, id: CharacterId): void {
  const spec = characterModels[id]
  addKart(kit, spec.kart, spec.kartStyle)
  spec.driver(kit)
}
