import * as THREE from 'three'
import { SceneryKit, type SceneryPart } from './scenery/sceneryKit'
import { COW_LENGTH, cow } from './scenery/sceneryModels'

/** Radius of the carnival float model at scale 1, so a hazard scales by its contact radius. */
export const FLOAT_UNIT_RADIUS = 1
/** Contact radius of a cow at scale 1 (m). */
export const COW_UNIT_RADIUS = COW_LENGTH / 2

const CARNIVAL = ['#ff3b6b', '#ffd23f', '#3bceac', '#4d8bff', '#ff8c42', '#b45cff']

function carnivalColor(i: number): string {
  return CARNIVAL[i % CARNIVAL.length] ?? '#ffffff'
}

/** Body, and the two diagonal pairs of legs hanging from the hip, of a cow facing +z. */
export function cowParts(): {
  body: THREE.BufferGeometry
  legsA: THREE.BufferGeometry
  legsB: THREE.BufferGeometry
} {
  const build = (part: 'body' | 'legsA' | 'legsB'): THREE.BufferGeometry => {
    const kit = new SceneryKit()
    cow(kit, part)
    const geometry = kit.build()[0]?.geometry
    if (!geometry) throw new Error('Empty cow part')
    return geometry
  }
  return { body: build('body'), legsA: build('legsA'), legsB: build('legsB') }
}

/**
 * A carnival float facing +z, sized so its footprint fits a circle of radius 1: a colorful
 * chassis on wheels, a tower of flowers and a big marimonda mask on top, with streamers.
 */
export function floatParts(): SceneryPart[] {
  const kit = new SceneryKit()
  // Chassis and wheels
  kit.box('#ff3b6b', 1.15, 0.38, 1.7, { position: [0, 0.22, 0] })
  kit.box('#ffd23f', 1.2, 0.1, 1.75, { position: [0, 0.6, 0] })
  for (const x of [-0.56, 0.56]) {
    for (const z of [-0.6, 0.6]) {
      kit.cylinder(
        '#2b2b2f',
        0.21,
        0.21,
        0.16,
        { position: [x, 0.21, z], rotation: [0, 0, Math.PI / 2] },
        8,
      )
    }
  }
  // Tiered tower
  kit.cylinder('#3bceac', 0.5, 0.58, 0.55, { position: [0, 0.7, -0.15] }, 8)
  kit.cylinder('#4d8bff', 0.38, 0.46, 0.5, { position: [0, 1.25, -0.15] }, 8)
  // Marimonda mask: big face with long nose and ears
  kit.ball('#ffe3b8', 0.34, { position: [0, 1.95, -0.15] })
  kit.cone('#ff8c42', 0.1, 0.5, { position: [0, 1.9, 0.1], rotation: [Math.PI / 2, 0, 0] }, 6)
  kit.ball('#2b2b2f', 0.06, { position: [0.14, 2.02, 0.12] }, 'solid', 0)
  kit.ball('#2b2b2f', 0.06, { position: [-0.14, 2.02, 0.12] }, 'solid', 0)
  kit.cone('#b45cff', 0.2, 0.6, { position: [0.3, 2.1, -0.15], rotation: [0, 0, -0.5] }, 5)
  kit.cone('#b45cff', 0.2, 0.6, { position: [-0.3, 2.1, -0.15], rotation: [0, 0, 0.5] }, 5)
  // Flowers around the deck
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2
    kit.ball(
      carnivalColor(i),
      0.2,
      {
        position: [Math.sin(angle) * 0.62, 0.78, -0.15 + Math.cos(angle) * 0.75],
      },
      'solid',
      0,
    )
  }
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + 0.3
    kit.ball(
      carnivalColor(i + 2),
      0.17,
      {
        position: [Math.sin(angle) * 0.42, 1.55, -0.15 + Math.cos(angle) * 0.42],
      },
      'solid',
      0,
    )
  }
  // Streamers
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2
    const arm = new THREE.BoxGeometry(0.06, 0.04, 0.8)
    arm.translate(0, 0, 0.4)
    arm.rotateX(0.9)
    arm.rotateY(angle)
    kit.add('solid', arm, carnivalColor(i + 4), { position: [0, 2.1, -0.15] })
  }
  return kit.build()
}

/** A boulder with a couple of smaller rocks at its foot, about 1 m in radius. */
export function boulderParts(): SceneryPart[] {
  const kit = new SceneryKit()
  kit.ball(
    '#8d8b88',
    0.95,
    { position: [0, 0.6, 0], scale: [1, 0.85, 1.05], rotation: [0, 0.6, 0] },
    'solid',
    0,
  )
  kit.ball('#a09d99', 0.55, { position: [0.55, 1.05, 0.2] }, 'solid', 0)
  kit.ball('#777572', 0.35, { position: [-0.8, 0.25, 0.45] }, 'solid', 0)
  kit.ball('#6e8b57', 0.3, { position: [0.1, 1.45, -0.3], scale: [1.2, 0.5, 1.2] }, 'solid', 0)
  return kit.build()
}

/**
 * Wall of ice for a hazard of radius 1: a see-through block 2 wide with a frozen frost skin,
 * spiky shards on the top edge and a solid base. The wall spans x, thin along z.
 */
export function iceWallParts(): SceneryPart[] {
  const kit = new SceneryKit()
  kit.box('#9fe2f2', 2, 1.5, 0.7, { position: [0, 0, 0] }, 'glass')
  kit.box('#e8fbff', 2.04, 0.18, 0.74, { position: [0, 0, 0] })
  for (let i = 0; i < 5; i++) {
    const x = -0.8 + i * 0.4
    kit.cone('#d7f6ff', 0.2, 0.5 + (i % 3) * 0.25, { position: [x, 1.4, i % 2 ? 0.1 : -0.1] }, 4)
  }
  kit.ball('#ffffff', 0.32, { position: [-0.55, 0.65, 0.35], scale: [1, 0.25, 0.4] }, 'glass', 0)
  return kit.build()
}

/** A shard of ice for the break-up burst. */
export function shardGeometry(): THREE.BufferGeometry {
  const g = new THREE.TetrahedronGeometry(0.22)
  g.scale(1, 1.6, 0.6)
  return g
}
