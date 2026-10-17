import type { CharacterId } from '../../config/characters'
import { addKart, SEAT, STEERING_WHEEL, type KartPalette, type KartStyle } from './kartModel'
import { box, cone, sphere, torus, type ModelKit } from './modelKit'

export type DanceStyle = 'cumbia' | 'champeta' | 'joropo'

export interface CharacterModelSpec {
  kart: KartPalette
  kartStyle: KartStyle
  /** Victory dance of the `victory` clip. */
  dance: DanceStyle
  /** How far the head swings in the clips (1 = normal); calm or nervous characters. */
  energy: number
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
  const gripX = STEERING_WHEEL.radius * 0.9
  const wheelY = STEERING_WHEEL.y + 0.02
  const wheelZ = STEERING_WHEEL.z - 0.02
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
  kart: { body: '#f2c230', accent: '#2f9e44' },
  kartStyle: 'classic',
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
  kart: { body: '#d8342c', accent: '#f2f2f2' },
  kartStyle: 'classic',
  dance: 'joropo',
  energy: 0.8,
  driver(kit) {
    const fur = '#2b2624'
    const cream = '#ecd3a0'
    driverBones(kit, 1.5, -0.18)
    kit.add('body', sphere(1, 12), fur, { position: [0, 1.02, -0.35], scale: [0.5, 0.48, 0.5] })
    kit.add('body', sphere(1, 10), cream, {
      position: [0, 1.16, 0.06],
      rotation: [0.3, 0, 0],
      scale: [0.24, 0.12, 0.08],
    })
    kit.add('head', sphere(0.36, 12), fur, { position: [0, 1.56, -0.15] })
    kit.add('head', sphere(1, 10), '#c9a77a', {
      position: [0, 1.48, 0.13],
      scale: [0.18, 0.14, 0.17],
    })
    kit.add('head', sphere(1, 8), BLACK, { position: [0, 1.53, 0.29], scale: [0.07, 0.05, 0.05] })
    // The "spectacles": cream rings around the eyes
    kit.addMirrored('head', 'head', torus(0.1, 0.035, 12), cream, {
      position: [0.13, 1.64, 0.12],
      rotation: [0, 0.35, 0],
    })
    eyes(kit, { x: 0.13, y: 1.64, z: 0.1, radius: 0.065 })
    kit.addMirrored('earL', 'earR', sphere(1, 8), fur, {
      position: [0.26, 1.86, -0.2],
      scale: [0.11, 0.11, 0.07],
    })
    kit.addMirrored('earL', 'earR', sphere(1, 8), '#5a4a40', {
      position: [0.26, 1.86, -0.15],
      scale: [0.06, 0.06, 0.03],
    })
    arms(kit, [0.36, 1.18, -0.18], 0.13, fur, '#3d3430')
  },
}

const titi: CharacterModelSpec = {
  kart: { body: '#f07a1a', accent: '#ffd23f' },
  kartStyle: 'sport',
  dance: 'champeta',
  energy: 1.5,
  driver(kit) {
    const back = '#6b4630'
    const white = '#f1ebe0'
    driverBones(kit, 1.36, -0.2, [0.85, -0.62])
    kit.add('body', sphere(1, 10), back, { position: [0, 0.98, -0.34], scale: [0.3, 0.36, 0.32] })
    kit.add('body', sphere(1, 10), white, { position: [0, 0.98, -0.18], scale: [0.24, 0.3, 0.2] })
    kit.add('head', sphere(1, 12), '#3b2a20', {
      position: [0, 1.4, -0.2],
      scale: [0.26, 0.25, 0.25],
    })
    kit.add('head', sphere(1, 10), BLACK, { position: [0, 1.38, -0.05], scale: [0.2, 0.19, 0.12] })
    eyes(kit, { x: 0.1, y: 1.43, z: 0.02, radius: 0.085, iris: '#5a3a1a' })
    // Cotton-top crest flowing back
    kit.add('earL', cone(0.13, 0.42, 7), WHITE, {
      position: [0, 1.72, -0.24],
      rotation: [-0.55, 0, 0],
    })
    kit.addMirrored('earL', 'earR', cone(0.1, 0.36, 7), WHITE, {
      position: [0.11, 1.66, -0.26],
      rotation: [-0.7, 0, -0.45],
    })
    kit.addMirrored('earL', 'earR', cone(0.08, 0.3, 6), WHITE, {
      position: [0.18, 1.56, -0.3],
      rotation: [-0.9, 0, -0.9],
    })
    arms(kit, [0.24, 1.08, -0.22], 0.065, white, '#2b211c')
    // Long curly tail
    kit.segment('tail', [0, 0.85, -0.62], [0.05, 1.2, -1.0], 0.06, back)
    kit.segment('tail', [0.05, 1.2, -1.0], [0.1, 1.55, -0.92], 0.055, back)
    kit.add('tail', sphere(0.07, 8), '#2b211c', { position: [0.1, 1.58, -0.88] })
  },
}

const condor: CharacterModelSpec = {
  kart: { body: '#2d6cdf', accent: '#f2c230' },
  kartStyle: 'sport',
  dance: 'joropo',
  energy: 0.7,
  driver(kit) {
    const feathers = '#1f1f24'
    const skin = '#9e4b45'
    driverBones(kit, 1.58, -0.1, [0.85, -0.7])
    kit.add('body', sphere(1, 12), feathers, {
      position: [0, 1.02, -0.35],
      scale: [0.42, 0.5, 0.44],
    })
    // White ruff and bare neck
    kit.add('body', torus(0.19, 0.09, 12), WHITE, {
      position: [0, 1.36, -0.25],
      rotation: [Math.PI / 2, 0, 0],
    })
    kit.segment('head', [0, 1.36, -0.25], [0, 1.55, -0.14], 0.08, skin)
    kit.add('head', sphere(1, 10), skin, { position: [0, 1.6, -0.1], scale: [0.18, 0.18, 0.22] })
    kit.add('head', sphere(1, 8), '#6e2a28', {
      position: [0, 1.77, -0.07],
      scale: [0.04, 0.08, 0.14],
    })
    // Hooked beak
    kit.add('head', cone(0.07, 0.24, 7), '#e9dcc0', {
      position: [0, 1.56, 0.19],
      rotation: [Math.PI / 2 + 0.25, 0, 0],
    })
    kit.add('head', sphere(0.03, 5), '#555048', { position: [0, 1.51, 0.3] })
    eyes(kit, { x: 0.12, y: 1.65, z: 0.0, radius: 0.06, iris: '#8a2a1e' })
    kit.addMirrored('earL', 'earR', cone(0.05, 0.22, 5), feathers, {
      position: [0.08, 1.68, -0.3],
      rotation: [-1.9, 0, -0.3],
    })
    // Wings as arms, with the white patches
    arms(kit, [0.36, 1.18, -0.22], 0.1, feathers, feathers)
    kit.addMirrored('armL', 'armR', box(0.05, 0.16, 0.36), WHITE, {
      position: [0.33, 1.1, 0.02],
      rotation: [0.25, 0, 0.2],
    })
    kit.add('tail', box(0.42, 0.05, 0.4), feathers, {
      position: [0, 0.82, -0.88],
      rotation: [-0.35, 0, 0],
    })
  },
}

const jaguar: CharacterModelSpec = {
  kart: { body: '#262636', accent: '#e9a23b' },
  kartStyle: 'sport',
  dance: 'champeta',
  energy: 1,
  driver(kit) {
    const coat = '#f0b13a'
    const spot = '#3a2616'
    const cream = '#f7ecd8'
    driverBones(kit, 1.48, -0.15, [0.82, -0.65])
    kit.add('body', sphere(1, 12), coat, { position: [0, 1.0, -0.33], scale: [0.42, 0.45, 0.46] })
    kit.add('body', sphere(1, 10), cream, { position: [0, 0.98, -0.05], scale: [0.3, 0.32, 0.2] })
    kit.add('head', sphere(1, 12), coat, { position: [0, 1.5, -0.15], scale: [0.33, 0.29, 0.3] })
    kit.add('head', sphere(1, 10), cream, { position: [0, 1.42, 0.08], scale: [0.18, 0.12, 0.14] })
    kit.add('head', sphere(1, 6), '#7a3b3b', {
      position: [0, 1.5, 0.2],
      scale: [0.055, 0.035, 0.035],
    })
    eyes(kit, { x: 0.13, y: 1.56, z: 0.07, radius: 0.075, iris: '#c8b832' })
    kit.addMirrored('earL', 'earR', cone(0.1, 0.16, 6), coat, {
      position: [0.22, 1.74, -0.2],
      rotation: [0, 0, -0.45],
      scale: [1, 1, 0.5],
    })
    kit.addMirrored('earL', 'earR', cone(0.05, 0.09, 5), spot, {
      position: [0.215, 1.73, -0.17],
      rotation: [0, 0, -0.45],
      scale: [1, 1, 0.4],
    })
    // Whisker pad dots, then rosette spots on the head and back
    kit.addMirrored('head', 'head', sphere(0.012, 4), spot, { position: [0.08, 1.43, 0.2] })
    kit.addMirrored('head', 'head', sphere(0.012, 4), spot, { position: [0.11, 1.41, 0.18] })
    for (const [x, y, z] of [
      [0.06, 1.72, 0.02],
      [0.16, 1.7, -0.02],
      [0.25, 1.58, -0.04],
      [0.0, 1.76, -0.08],
      [0.28, 1.45, -0.1],
      [0.12, 1.78, -0.16],
      [0.3, 1.5, -0.22],
    ] as const) {
      kit.addMirrored('head', 'head', sphere(0.035, 6), spot, { position: [x, y, z] })
    }
    for (const [x, y, z] of [
      [0.3, 1.2, -0.45],
      [0.38, 0.98, -0.4],
      [0.2, 1.3, -0.55],
      [0.32, 0.85, -0.6],
      [0.0, 1.38, -0.5],
    ] as const) {
      kit.addMirrored('body', 'body', sphere(0.045, 6), spot, { position: [x, y, z] })
    }
    arms(kit, [0.32, 1.12, -0.2], 0.1, coat, cream)
    kit.segment('tail', [0, 0.82, -0.65], [0.15, 1.05, -1.1], 0.07, coat)
    kit.segment('tail', [0.15, 1.05, -1.1], [0.3, 1.35, -1.2], 0.065, coat)
    kit.add('tail', sphere(0.08, 8), spot, { position: [0.3, 1.38, -1.2] })
  },
}

const guacamaya: CharacterModelSpec = {
  kart: { body: '#3fb54a', accent: '#ffcc1a' },
  kartStyle: 'classic',
  dance: 'cumbia',
  energy: 1.3,
  driver(kit) {
    const red = '#e0262b'
    const yellow = '#ffcc1a'
    const blue = '#1f6fe0'
    driverBones(kit, 1.48, -0.15, [0.82, -0.66])
    kit.add('body', sphere(1, 12), red, { position: [0, 1.0, -0.33], scale: [0.36, 0.44, 0.38] })
    kit.add('head', sphere(0.27, 12), red, { position: [0, 1.5, -0.15] })
    kit.addMirrored('head', 'head', sphere(1, 8), '#f6f2ec', {
      position: [0.15, 1.5, -0.02],
      scale: [0.1, 0.12, 0.1],
    })
    // Big curved beak
    kit.add('head', sphere(1, 10), '#efe6d2', {
      position: [0, 1.48, 0.13],
      rotation: [0.4, 0, 0],
      scale: [0.11, 0.15, 0.14],
    })
    kit.add('head', cone(0.05, 0.14, 6), '#efe6d2', {
      position: [0, 1.36, 0.23],
      rotation: [Math.PI, 0, 0],
    })
    kit.add('head', sphere(1, 8), '#2a2a2a', {
      position: [0, 1.38, 0.1],
      scale: [0.08, 0.06, 0.08],
    })
    eyes(kit, { x: 0.16, y: 1.56, z: 0.04, radius: 0.06, iris: '#f2e6b0' })
    kit.addMirrored('earL', 'earR', cone(0.05, 0.2, 5), red, {
      position: [0.06, 1.78, -0.18],
      rotation: [-0.6, 0, -0.3],
    })
    arms(kit, [0.3, 1.12, -0.2], 0.085, red, red)
    // Yellow and blue wing feathers
    kit.addMirrored('armL', 'armR', box(0.05, 0.12, 0.34), yellow, {
      position: [0.3, 1.12, 0.0],
      rotation: [0.25, 0, 0.25],
    })
    kit.addMirrored('armL', 'armR', box(0.05, 0.1, 0.38), blue, {
      position: [0.33, 1.02, 0.0],
      rotation: [0.25, 0, 0.25],
    })
    // Long tail feathers hanging behind the seat
    kit.add('tail', box(0.12, 0.03, 0.9), red, {
      position: [0.05, 0.72, -1.05],
      rotation: [0.35, 0.08, 0],
    })
    kit.add('tail', box(0.1, 0.03, 0.75), blue, {
      position: [-0.08, 0.74, -1.0],
      rotation: [0.35, -0.08, 0],
    })
  },
}

const delfin: CharacterModelSpec = {
  kart: { body: '#22b0cf', accent: '#ffffff' },
  kartStyle: 'boat',
  dance: 'cumbia',
  energy: 1.1,
  driver(kit) {
    const pink = '#f29bb6'
    const belly = '#fbd3df'
    driverBones(kit, 1.46, -0.16, [0.8, -0.65])
    kit.add('body', sphere(1, 12), pink, { position: [0, 1.04, -0.34], scale: [0.38, 0.5, 0.4] })
    kit.add('body', sphere(1, 10), belly, { position: [0, 1.0, -0.12], scale: [0.27, 0.38, 0.2] })
    kit.add('body', cone(0.12, 0.32, 6), pink, {
      position: [0, 1.38, -0.58],
      rotation: [-0.9, 0, 0],
      scale: [0.4, 1, 1],
    })
    kit.add('head', sphere(1, 12), pink, { position: [0, 1.5, -0.15], scale: [0.3, 0.28, 0.32] })
    // Round melon forehead and the long beak
    kit.add('head', sphere(1, 10), pink, { position: [0, 1.6, 0.02], scale: [0.22, 0.18, 0.18] })
    kit.segment('head', [0, 1.45, 0.1], [0, 1.41, 0.5], 0.065, belly)
    eyes(kit, { x: 0.2, y: 1.52, z: 0.04, radius: 0.06 })
    // Flippers as arms
    arms(kit, [0.32, 1.12, -0.2], 0.075, pink, pink)
    kit.addMirrored('armL', 'armR', sphere(1, 8), pink, {
      position: [0.34, 1.05, -0.05],
      rotation: [0.3, 0, 0.6],
      scale: [0.06, 0.16, 0.1],
    })
    // Tail fluke behind the seat
    kit.segment('tail', [0, 0.8, -0.65], [0, 0.82, -0.95], 0.09, pink)
    kit.add('tail', sphere(1, 8), pink, { position: [0, 0.83, -1.02], scale: [0.32, 0.04, 0.12] })
  },
}

const perezoso: CharacterModelSpec = {
  kart: { body: '#5f8a35', accent: '#a7d46f', dark: '#4a3523' },
  kartStyle: 'leafy',
  dance: 'joropo',
  energy: 0.4,
  driver(kit) {
    const fur = '#8f7d64'
    const face = '#e8dcc0'
    const mask = '#4a3a2a'
    driverBones(kit, 1.44, -0.18)
    kit.add('body', sphere(1, 12), fur, { position: [0, 1.0, -0.34], scale: [0.42, 0.46, 0.44] })
    // Shaggy fur clumps
    for (const [x, y, z] of [
      [0.3, 1.25, -0.3],
      [0.36, 0.95, -0.42],
      [0.15, 1.35, -0.55],
    ] as const) {
      kit.addMirrored('body', 'body', sphere(0.14, 6), '#9c8a70', { position: [x, y, z] })
    }
    kit.add('head', sphere(0.3, 12), fur, { position: [0, 1.46, -0.18] })
    kit.add('head', sphere(1, 10), face, { position: [0, 1.44, 0.0], scale: [0.25, 0.21, 0.14] })
    // Dark stripes and sleepy half-closed eyes
    kit.addMirrored('head', 'head', sphere(1, 8), mask, {
      position: [0.11, 1.47, 0.1],
      rotation: [0, 0, -0.35],
      scale: [0.1, 0.05, 0.04],
    })
    kit.addMirrored('head', 'head', sphere(1, 6), BLACK, {
      position: [0.11, 1.475, 0.135],
      rotation: [0, 0, -0.2],
      scale: [0.04, 0.015, 0.015],
    })
    kit.add('head', sphere(1, 8), mask, { position: [0, 1.4, 0.14], scale: [0.06, 0.045, 0.04] })
    kit.add('head', box(0.08, 0.012, 0.01), mask, { position: [0, 1.34, 0.12] })
    arms(kit, [0.33, 1.14, -0.2], 0.09, fur, fur)
    // Long claws over the steering wheel
    for (const offset of [-0.04, 0, 0.04]) {
      kit.addMirrored('armL', 'armR', cone(0.018, 0.12, 4), face, {
        position: [STEERING_WHEEL.radius * 0.9 + offset, STEERING_WHEEL.y + 0.08, 0.32],
        rotation: [0.9, 0, 0],
      })
    }
    // A hibiscus on its head
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2
      kit.add('earL', sphere(1, 6), '#ff5a7a', {
        position: [0.16 + Math.cos(angle) * 0.06, 1.72, -0.18 + Math.sin(angle) * 0.06],
        scale: [0.06, 0.02, 0.04],
        rotation: [0, -angle, 0],
      })
    }
    kit.add('earL', sphere(0.03, 6), '#ffd23f', { position: [0.16, 1.74, -0.18] })
  },
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
