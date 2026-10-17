import * as THREE from 'three'
import type { DecorationKind } from '../../config/tracks/theme'
import { SceneryKit, type SceneryPart } from './sceneryKit'

/** A scenery prop ready to instance. */
export interface SceneryModel {
  parts: SceneryPart[]
  /**
   * Instance colors, picked per instance. The geometry is painted white where it should take
   * the tint (pastel crystals, ice), so the tint multiplies it.
   */
  tints?: readonly string[]
}

const models = new Map<DecorationKind, SceneryModel>()

/** Builds (once) the prop of a decoration kind. Props stand on y = 0 and face +z. */
export function sceneryModel(kind: DecorationKind): SceneryModel {
  let model = models.get(kind)
  if (!model) {
    model = build(kind)
    models.set(kind, model)
  }
  return model
}

function build(kind: DecorationKind): SceneryModel {
  const kit = new SceneryKit()
  switch (kind) {
    case 'tree':
      tree(kit)
      break
    case 'waxPalm':
      waxPalm(kit)
      break
    case 'pine':
      pine(kit, false)
      break
    case 'snowPine':
      pine(kit, true)
      break
    case 'fumarole':
      fumarole(kit)
      break
    case 'saltColumn':
      saltColumn(kit)
      return { parts: kit.build(), tints: ['#ffd6e8', '#cfe6ff', '#e4d4ff', '#ffe9c4', '#d4fff0'] }
    case 'colonialHouse':
      colonialHouse(kit)
      break
    case 'palm':
      palm(kit)
      break
    case 'cannon':
      cannon(kit)
      break
    case 'stoneTerrace':
      stoneTerrace(kit)
      break
    case 'jungleTree':
      jungleTree(kit)
      break
    case 'ceiba':
      ceiba(kit)
      break
    case 'moriche':
      moriche(kit)
      break
    case 'cow':
      cow(kit, 'all')
      break
    case 'redPlant':
      redPlant(kit)
      break
    case 'cactus':
      cactus(kit)
      break
    case 'rock':
      rock(kit)
      return { parts: kit.build(), tints: ['#ffffff', '#e6dccf', '#cfd6dc', '#efe4d2'] }
    case 'confetti':
      confetti(kit)
      break
  }
  return { parts: kit.build() }
}

function tree(kit: SceneryKit): void {
  kit.cylinder('#8b5a2b', 0.3, 0.4, 2)
  kit.cone('#2f8f3a', 1.8, 4, { position: [0, 2, 0] })
  kit.cone('#3aa047', 1.2, 2.4, { position: [0, 4.2, 0] })
}

function waxPalm(kit: SceneryKit): void {
  // Tall cream trunk and a tuft of fronds, Cocora's signature
  kit.cylinder('#cfcbbd', 0.2, 0.35, 14)
  kit.cone('#207833', 2.8, 2, { position: [0, 13, 0] })
  kit.cone('#2a8f40', 1.2, 1.6, { position: [0, 14.4, 0] })
}

function pine(kit: SceneryKit, snow: boolean): void {
  const tiers: readonly (readonly [number, number, number])[] = [
    [2.4, 3.2, 1.4],
    [1.9, 2.8, 3.2],
    [1.3, 2.4, 5],
  ]
  kit.cylinder('#6b4a2b', 0.28, 0.38, 1.8)
  for (const [radius, height, base] of tiers) {
    kit.cone(snow ? '#2c6b45' : '#1f6b34', radius, height, { position: [0, base, 0] }, 8)
    if (snow) {
      // Snow cap hugging the upper part of the tier
      kit.cone('#f4f9ff', radius * 0.62, height * 0.6, { position: [0, base + height * 0.4, 0] }, 8)
    }
  }
  if (snow) kit.cone('#f4f9ff', 0.45, 0.9, { position: [0, 7.1, 0] }, 8)
}

function fumarole(kit: SceneryKit): void {
  // Dark volcanic cone with a glowing vent and a steam puff
  kit.cone('#4b4545', 2.2, 2.4, { position: [0, 0, 0] }, 7)
  kit.cone('#5d5656', 1.4, 1.2, { position: [0.3, 0, -0.9] }, 6)
  kit.cylinder('#2a2424', 0.7, 0.9, 0.3, { position: [0, 2.3, 0] }, 7)
  kit.ball('#ffb347', 0.5, { position: [0, 2.6, 0], scale: [1, 0.4, 1] }, 'bright', 0)
  kit.ball('#ffffff', 0.9, { position: [0, 3.5, 0] }, 'glass')
  kit.ball('#f1f3f5', 1.2, { position: [0.3, 4.8, 0.1] }, 'glass')
  kit.ball('#e5e9ec', 1.5, { position: [-0.2, 6.4, 0] }, 'glass')
}

function saltColumn(kit: SceneryKit): void {
  // Cluster of hexagonal crystal pillars; the instance tint picks the pastel
  const pillars: readonly (readonly [number, number, number, number, number])[] = [
    [0, 0, 0.9, 6, 0],
    [1.3, 0.6, 0.6, 3.6, 0.12],
    [-1.1, -0.5, 0.55, 4.4, -0.1],
  ]
  for (const [x, z, radius, height, lean] of pillars) {
    kit.cylinder(
      '#ffffff',
      radius * 0.85,
      radius,
      height,
      { position: [x, 0, z], rotation: [lean, 0, -lean] },
      6,
      'glow',
    )
    kit.cone(
      '#f4f0ff',
      radius * 0.85,
      radius * 1.6,
      {
        position: [
          x + height * Math.sin(lean),
          height * Math.cos(lean) ** 2 * 0.98,
          z + height * Math.cos(lean) * Math.sin(lean),
        ],
        rotation: [lean, 0, -lean],
      },
      6,
      'glow',
    )
  }
  kit.cylinder('#d9d2c8', 1.9, 2.2, 0.4, {}, 7)
}

function colonialHouse(kit: SceneryKit): void {
  // Front faces +z: white walls, red tile roof, colored balcony, wooden door
  kit.box('#f7f2e6', 7, 4.2, 6)
  kit.cone('#b5412e', 5.6, 2.4, { position: [0, 4.2, 0], rotation: [0, Math.PI / 4, 0] }, 4)
  kit.box('#6b4226', 1.1, 2.1, 0.15, { position: [-1.8, 0, 3.02] })
  kit.box('#3b82c4', 1.0, 1.2, 0.15, { position: [1.7, 1.5, 3.02] })
  kit.box('#2a9d8f', 4.2, 0.18, 1.3, { position: [0.4, 2.7, 3.6] })
  kit.box('#2a9d8f', 4.2, 0.7, 0.12, { position: [0.4, 2.88, 4.2] })
  kit.box('#e9a23b', 0.18, 2.7, 0.18, { position: [-1.6, 0, 4.1] })
  kit.box('#e9a23b', 0.18, 2.7, 0.18, { position: [2.4, 0, 4.1] })
  kit.box('#3b82c4', 1.0, 1.2, 0.15, { position: [-2.2, 2.9, 3.02] })
}

/** A frond: a flat blade starting at the origin, pitched and turned around y. */
function frond(
  length: number,
  width: number,
  pitch: number,
  yaw: number,
  lift = 0,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(width, 0.07, length)
  g.translate(0, 0, length / 2)
  g.rotateX(pitch)
  g.rotateY(yaw)
  g.translate(0, lift, 0)
  return g
}

function palm(kit: SceneryKit): void {
  // Leaning coconut palm: three trunk segments bending to one side, drooping fronds
  kit.cylinder('#a9825a', 0.28, 0.38, 2.6, { rotation: [0.05, 0, 0.04] })
  kit.cylinder('#a9825a', 0.24, 0.28, 2.6, {
    position: [0.1, 2.55, 0.14],
    rotation: [0.1, 0, 0.09],
  })
  kit.cylinder('#a9825a', 0.2, 0.24, 2.6, {
    position: [0.33, 5.1, 0.4],
    rotation: [0.16, 0, 0.14],
  })
  const top: readonly [number, number, number] = [0.72, 7.6, 0.85]
  for (let i = 0; i < 7; i++) {
    const yaw = (i / 7) * Math.PI * 2
    kit.add('solid', frond(3.4, 0.7, 0.55, yaw), i % 2 ? '#2f9a3f' : '#3dad4c', { position: top })
  }
  kit.ball('#6b4226', 0.26, { position: [top[0] + 0.25, top[1] - 0.3, top[2]] })
  kit.ball('#6b4226', 0.26, { position: [top[0] - 0.2, top[1] - 0.3, top[2] + 0.2] })
}

function cannon(kit: SceneryKit): void {
  // Barrel on a wooden carriage, pointing +z and slightly up
  kit.box('#8a7f72', 2.4, 0.5, 3.2)
  kit.box('#6b4226', 1.7, 0.45, 2.4, { position: [0, 0.5, 0] })
  kit.cylinder(
    '#2c2f36',
    0.5,
    0.65,
    3,
    { position: [0, 1.3, -0.6], rotation: [Math.PI / 2.3, 0, 0] },
    8,
  )
  kit.ball('#2c2f36', 0.72, { position: [0, 1.25, -0.7] })
  kit.cylinder(
    '#4a3322',
    0.6,
    0.6,
    0.25,
    { position: [-1.0, 0.1, 0], rotation: [0, 0, Math.PI / 2] },
    8,
  )
  kit.cylinder(
    '#4a3322',
    0.6,
    0.6,
    0.25,
    { position: [0.85, 0.1, 0], rotation: [0, 0, Math.PI / 2] },
    8,
  )
  kit.ball('#2c2f36', 0.3, { position: [1.8, 0.3, 1.1] }, 'solid', 0)
  kit.ball('#2c2f36', 0.3, { position: [2.2, 0.3, 0.6] }, 'solid', 0)
}

function stoneTerrace(kit: SceneryKit): void {
  // Round stone platform of Ciudad Perdida with a grassy top and a few stepping stones
  kit.cylinder('#8f8676', 3.7, 3.9, 0.9, {}, 12)
  kit.cylinder('#a39a88', 3.0, 3.2, 0.7, { position: [0, 0.9, 0] }, 12)
  kit.cylinder('#5e9b44', 2.8, 2.8, 0.12, { position: [0, 1.6, 0] }, 12)
  kit.ball('#b4ab98', 0.5, { position: [1.3, 1.9, 0.6], scale: [1, 0.7, 1] }, 'solid', 0)
  kit.ball('#b4ab98', 0.4, { position: [-1.1, 1.8, -0.9], scale: [1, 0.7, 1] }, 'solid', 0)
}

function jungleTree(kit: SceneryKit): void {
  kit.cylinder('#6d4a2d', 0.4, 0.6, 6, {}, 7)
  kit.ball('#1f6b2d', 2.4, { position: [0, 7, 0] })
  kit.ball('#2a8238', 1.9, { position: [1.6, 6.4, 0.8] })
  kit.ball('#18592a', 1.8, { position: [-1.5, 6.6, -0.6] })
  kit.ball('#2f8f3a', 1.5, { position: [0.2, 8.6, 0.3] })
}

function ceiba(kit: SceneryKit): void {
  // Giant: flared trunk with buttress roots and a broad flat crown
  kit.cylinder('#8a7a66', 1.3, 2.3, 13, {}, 8)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 0.4
    kit.box('#7d6e5b', 0.5, 4, 2.4, {
      position: [Math.sin(angle) * 1.9, 0, Math.cos(angle) * 1.9],
      rotation: [0, angle, 0],
    })
  }
  kit.ball('#2a7a35', 5.5, { position: [0, 16, 0], scale: [1.3, 0.6, 1.3] })
  kit.ball('#2f8f3a', 4, { position: [4.2, 14.8, 1.5], scale: [1.2, 0.6, 1.2] })
  kit.ball('#1f6b2d', 4, { position: [-4, 15, -1.8], scale: [1.2, 0.6, 1.2] })
  kit.ball('#38a046', 3, { position: [0.5, 18.2, 0.4], scale: [1.2, 0.6, 1.2] })
}

function moriche(kit: SceneryKit): void {
  // Slender trunk and a crown of big fan leaves pointing up and out
  kit.cylinder('#8a7455', 0.3, 0.45, 9.5)
  const top: readonly [number, number, number] = [0, 9.3, 0]
  for (let i = 0; i < 9; i++) {
    const yaw = (i / 9) * Math.PI * 2
    kit.add('solid', frond(3.6, 1.3, -0.5, yaw), i % 2 ? '#4fa03a' : '#5bb044', { position: top })
  }
  kit.ball('#d9822b', 0.3, { position: [0.4, 9, 0.2] }, 'solid', 0)
  kit.ball('#d9822b', 0.3, { position: [-0.3, 8.9, -0.3] }, 'solid', 0)
}

/** Which part of the cow to build: the whole cow, or its body and two diagonal leg pairs. */
export type CowPart = 'all' | 'body' | 'legsA' | 'legsB'

/** Height of the cow's hip, where the legs swing from. */
export const COW_HIP = 0.62

/** Length of a cow from nose to tail (m) at scale 1. */
export const COW_LENGTH = 2.3

/**
 * A Holstein cow facing +z. As separate parts the legs are built hanging from y = 0 (the hip),
 * so they can be swung around it; in `all` they are already in place.
 */
export function cow(kit: SceneryKit, part: CowPart): void {
  const white = '#f6f3ec'
  const black = '#2b2b2f'
  if (part === 'all' || part === 'body') {
    kit.box(white, 0.85, 0.75, 1.7, { position: [0, COW_HIP, 0] })
    kit.box(black, 0.9, 0.5, 0.6, { position: [0, COW_HIP + 0.25, -0.35] })
    kit.box(black, 0.9, 0.4, 0.5, { position: [0, COW_HIP + 0.35, 0.5] })
    kit.box(white, 0.55, 0.55, 0.6, { position: [0, COW_HIP + 0.4, 1.05] })
    kit.box('#e8b4b8', 0.4, 0.22, 0.2, { position: [0, COW_HIP + 0.4, 1.4] })
    kit.box(black, 0.12, 0.2, 0.1, { position: [0.3, COW_HIP + 0.97, 1.0] })
    kit.box(black, 0.12, 0.2, 0.1, { position: [-0.3, COW_HIP + 0.97, 1.0] })
    kit.box(white, 0.1, 0.5, 0.1, { position: [0, COW_HIP + 0.1, -0.9] })
    kit.box('#e8b4b8', 0.3, 0.2, 0.4, { position: [0, COW_HIP - 0.2, -0.5] })
  }
  const legs: readonly (readonly [number, number, 'legsA' | 'legsB'])[] = [
    [0.28, 0.6, 'legsA'],
    [-0.28, -0.6, 'legsA'],
    [-0.28, 0.6, 'legsB'],
    [0.28, -0.6, 'legsB'],
  ]
  for (const [x, z, group] of legs) {
    if (part !== 'all' && part !== group) continue
    const base = part === 'all' ? 0 : -COW_HIP
    kit.box(white, 0.2, COW_HIP, 0.2, { position: [x, base, z] })
    kit.box(black, 0.22, 0.12, 0.22, { position: [x, base, z] })
  }
}

function redPlant(kit: SceneryKit): void {
  // Macarenia clavigera: a mat of red ribbons with yellow and green accents
  const blades = 14
  for (let i = 0; i < blades; i++) {
    const angle = (i / blades) * Math.PI * 2 + (i % 3) * 0.3
    const lean = 0.45 + (i % 4) * 0.12
    const color = i % 5 === 0 ? '#f2a516' : i % 3 === 0 ? '#e0405a' : '#cf1f2e'
    kit.cone(
      color,
      0.16,
      0.9 + (i % 3) * 0.25,
      {
        position: [Math.sin(angle) * 0.35, 0, Math.cos(angle) * 0.35],
        rotation: [Math.cos(angle) * lean, 0, -Math.sin(angle) * lean],
      },
      3,
    )
  }
  kit.cone('#3f7d3a', 0.12, 0.5, { position: [0, 0, 0] }, 3)
}

function cactus(kit: SceneryKit): void {
  kit.cylinder('#4f8f3a', 0.38, 0.42, 3.4, {}, 7)
  kit.ball('#4f8f3a', 0.38, { position: [0, 3.4, 0] }, 'solid', 0)
  // Two arms: sideways elbow, then up
  kit.cylinder(
    '#4f8f3a',
    0.24,
    0.24,
    0.9,
    { position: [0.3, 1.2, 0], rotation: [0, 0, -Math.PI / 2] },
    6,
  )
  kit.cylinder('#4f8f3a', 0.22, 0.24, 1.2, { position: [1.2, 1.1, 0] }, 6)
  kit.ball('#4f8f3a', 0.22, { position: [1.2, 2.3, 0] }, 'solid', 0)
  kit.cylinder(
    '#4f8f3a',
    0.24,
    0.24,
    0.8,
    { position: [-0.3, 1.9, 0], rotation: [0, 0, Math.PI / 2] },
    6,
  )
  kit.cylinder('#4f8f3a', 0.2, 0.22, 0.9, { position: [-1.1, 1.8, 0] }, 6)
  kit.ball('#4f8f3a', 0.2, { position: [-1.1, 2.7, 0] }, 'solid', 0)
  kit.ball('#e86a8a', 0.14, { position: [0, 3.8, 0] }, 'solid', 0)
}

function rock(kit: SceneryKit): void {
  kit.ball(
    '#8d8b88',
    1.2,
    { position: [0, 0.6, 0], scale: [1.2, 0.8, 1], rotation: [0, 0.5, 0] },
    'solid',
    0,
  )
  kit.ball('#a09d99', 0.7, { position: [1.1, 0.35, 0.5], scale: [1, 0.8, 1.1] }, 'solid', 0)
  kit.ball('#777572', 0.5, { position: [-0.9, 0.25, 0.9] }, 'solid', 0)
}

const CONFETTI_COLORS = ['#ff3b6b', '#ffd23f', '#3bceac', '#4d8bff', '#ff8c42', '#b45cff']

function confetti(kit: SceneryKit): void {
  // Striped streamer pole with ribbons, on a heap of colored paper
  const bands = 6
  for (let i = 0; i < bands; i++) {
    kit.cylinder(
      CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? '#ffffff',
      0.13,
      0.13,
      0.9,
      {
        position: [0, i * 0.9, 0],
      },
      6,
    )
  }
  kit.ball('#ffd23f', 0.3, { position: [0, 5.55, 0] }, 'solid', 0)
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2
    const color = CONFETTI_COLORS[(i + 2) % CONFETTI_COLORS.length] ?? '#ffffff'
    kit.add('solid', frond(2.4, 0.22, 1.1, angle), color, { position: [0, 5.3, 0] })
  }
  for (let i = 0; i < 16; i++) {
    const angle = i * 2.4
    const radius = 0.4 + (i % 5) * 0.28
    kit.box(CONFETTI_COLORS[(i * 5) % CONFETTI_COLORS.length] ?? '#ffffff', 0.45, 0.07, 0.45, {
      position: [Math.sin(angle) * radius, (i % 4) * 0.06, Math.cos(angle) * radius],
      rotation: [(i % 3) * 0.3, angle, (i % 2) * 0.35],
    })
  }
}
