import * as THREE from 'three'
import { seededRandom } from '../scenery/random'
import { MeshBuilder } from './meshBuilder'

type V3 = readonly [number, number, number]

/** Height of the wax palm model (m); instances scale it. */
export const PALM_HEIGHT = 18

function blade(
  b: MeshBuilder,
  x: number,
  z: number,
  yaw: number,
  height: number,
  width: number,
  lean: number,
  colors: readonly [string, string, string],
): void {
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  // Blade plane spans local X; it leans along local Z
  const at = (lx: number, y: number, lz: number): V3 => [
    x + lx * cos + lz * sin,
    y,
    z - lx * sin + lz * cos,
  ]
  const mid = height * 0.55
  const w = width / 2
  b.quad(
    at(-w, 0, 0),
    at(w, 0, 0),
    at(w * 0.7, mid, lean * 0.35),
    at(-w * 0.7, mid, lean * 0.35),
    colors[0],
    colors[0],
    colors[1],
    colors[1],
  )
  b.tri(
    at(-w * 0.7, mid, lean * 0.35),
    at(w * 0.7, mid, lean * 0.35),
    at(0, height, lean),
    colors[1],
    colors[1],
    colors[2],
  )
}

/** A tuft of grass blades, taller at the center. */
export function grassTuftGeometry(): THREE.BufferGeometry {
  const random = seededRandom(11)
  const b = new MeshBuilder()
  for (let i = 0; i < 7; i++) {
    const angle = random() * Math.PI * 2
    const radius = random() * 0.16
    blade(
      b,
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      random() * Math.PI * 2,
      0.45 + random() * 0.5 + (radius < 0.06 ? 0.15 : 0),
      0.1 + random() * 0.05,
      0.12 + random() * 0.22,
      ['#2c6a1c', '#5aab2a', '#a4de45'],
    )
  }
  return b.build()
}

/** Three flowers on stems with leaves; the instance color paints the petals only. */
export function flowerGeometry(): THREE.BufferGeometry {
  const random = seededRandom(23)
  const b = new MeshBuilder()
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + random()
    const x = Math.cos(angle) * 0.12
    const z = Math.sin(angle) * 0.12
    const height = 0.5 + random() * 0.3
    blade(b, x, z, random() * 6, height, 0.04, 0.05, ['#2c6a1c', '#4f9a2a', '#6bb534'])
    for (const side of [-1, 1]) {
      blade(b, x, z, random() * 6 + side, 0.3, 0.1, 0.18, ['#2c6a1c', '#4f9a2a', '#7cc43e'])
    }
    // Petal star, tilted a little toward the viewer
    const tilt = (random() - 0.5) * 0.4
    const petals = 6
    const radius = 0.13 + random() * 0.04
    for (let p = 0; p < petals; p++) {
      const a0 = (p / petals) * Math.PI * 2
      const a1 = ((p + 1) / petals) * Math.PI * 2
      const aMid = (a0 + a1) / 2
      b.tri(
        [x, height, z],
        [x + Math.cos(a0) * radius * 0.55, height + tilt * 0.05, z + Math.sin(a0) * radius * 0.55],
        [x + Math.cos(aMid) * radius, height + 0.02, z + Math.sin(aMid) * radius],
        '#ffffff',
      )
      b.tri(
        [x, height, z],
        [x + Math.cos(aMid) * radius, height + 0.02, z + Math.sin(aMid) * radius],
        [x + Math.cos(a1) * radius * 0.55, height + tilt * 0.05, z + Math.sin(a1) * radius * 0.55],
        '#ffffff',
      )
      b.tri(
        [x, height + 0.03, z],
        [x + Math.cos(a0) * radius * 0.3, height + 0.03, z + Math.sin(a0) * radius * 0.3],
        [x + Math.cos(a1) * radius * 0.3, height + 0.03, z + Math.sin(a1) * radius * 0.3],
        '#f5c518',
        '#f5c518',
        '#f5c518',
        0,
      )
    }
  }
  return b.build()
}

/** Round shrub made of three overlapping lumps. */
export function bushGeometry(): THREE.BufferGeometry {
  const b = new MeshBuilder()
  b.blob([0, 0.55, 0], 0.9, [1.15, 0.8, 1.1], '#1d5a26', '#4f9d37', 1)
  b.blob([0.7, 0.4, 0.35], 0.65, [1, 0.8, 1], '#1f6029', '#5aa83c', 1)
  b.blob([-0.6, 0.38, -0.3], 0.6, [1, 0.8, 1], '#1d5a26', '#47912f', 1)
  return b.build()
}

/** Fern: a rosette of arching fronds. */
export function fernGeometry(): THREE.BufferGeometry {
  const random = seededRandom(37)
  const b = new MeshBuilder()
  const fronds = 9
  for (let f = 0; f < fronds; f++) {
    const yaw = (f / fronds) * Math.PI * 2 + random() * 0.4
    frond(b, 0, 0.1, 0, yaw, 1.15 + random() * 0.35, 0.28, 0.55, 0.9, 1, [
      '#235f27',
      '#3d8a33',
      '#79c24a',
    ])
  }
  return b.build()
}

/**
 * One arching leaf: rises by `rise`, then droops by `droop`; the width swells and tapers.
 * `(x, y, z)` is its base, `yaw` the direction it points.
 */
function frond(
  b: MeshBuilder,
  x: number,
  y: number,
  z: number,
  yaw: number,
  length: number,
  width: number,
  rise: number,
  droop: number,
  tint: number,
  colors: readonly [string, string, string],
): void {
  const dx = Math.cos(yaw)
  const dz = Math.sin(yaw)
  const segments = 5
  const sideX = -dz
  const sideZ = dx
  let previous: [V3, V3] | null = null
  for (let s = 0; s <= segments; s++) {
    const t = s / segments
    const reach = length * t
    const height =
      y + rise * Math.sin(t * Math.PI * 0.6) * length * 0.5 - droop * t * t * length * 0.45
    const half = (width / 2) * Math.sin(Math.PI * (0.12 + 0.88 * t)) * (1 - t * 0.3)
    const cx = x + dx * reach
    const cz = z + dz * reach
    const current: [V3, V3] = [
      [cx - sideX * half, height, cz - sideZ * half],
      [cx + sideX * half, height, cz + sideZ * half],
    ]
    if (previous) {
      const c0 = t < 0.5 ? colors[0] : colors[1]
      const c1 = t < 0.5 ? colors[1] : colors[2]
      b.quad(previous[0], previous[1], current[1], current[0], c0, c0, c1, c1, tint)
    }
    previous = current
  }
}

/**
 * Quindio wax palm: a very tall, thin, pale ringed trunk and a small crown of drooping fronds.
 * The trunk is not tinted by the instance color; the fronds are.
 */
export function waxPalmGeometry(): THREE.BufferGeometry {
  const random = seededRandom(53)
  const b = new MeshBuilder()
  const rings = 12
  const top = PALM_HEIGHT - 1.4
  for (let r = 0; r < rings; r++) {
    const y0 = (top * r) / rings
    const y1 = (top * (r + 1)) / rings
    const radius0 = 0.4 - 0.13 * (y0 / top) + (r === 0 ? 0.12 : 0)
    const radius1 = 0.4 - 0.13 * (y1 / top)
    const tone = r % 2 === 0 ? '#e4dfcf' : '#c9c2ad'
    b.tube(0, 0, y0, y1, radius0, radius1, 7, tone, tone, 0)
  }
  // Green crownshaft under the leaves
  b.tube(0, 0, top, PALM_HEIGHT - 0.1, 0.27, 0.3, 7, '#5f9c3a', '#3f8a2e', 0)
  const fronds = 10
  for (let f = 0; f < fronds; f++) {
    const yaw = (f / fronds) * Math.PI * 2 + (random() - 0.5) * 0.4
    frond(b, 0, PALM_HEIGHT - 0.2, 0, yaw, 3.6 + random() * 0.9, 0.9, 0.7, 1.7, 1, [
      '#27702b',
      '#3f9139',
      '#74bb4d',
    ])
  }
  // Young upright spears at the center
  for (let f = 0; f < 3; f++) {
    frond(b, 0, PALM_HEIGHT - 0.1, 0, f * 2.1, 2.4, 0.5, 2.4, 0.1, 1, [
      '#3d8a33',
      '#74bb4d',
      '#a4de45',
    ])
  }
  return b.build()
}

/** Broadleaf cloud-forest tree: forked trunk and a lumpy canopy. */
export function broadleafTreeGeometry(): THREE.BufferGeometry {
  const random = seededRandom(67)
  const b = new MeshBuilder()
  b.tube(0, 0, 0, 3.6, 0.38, 0.24, 6, '#6e4a2d', '#7a5535', 0)
  for (const [x, z] of [
    [0.9, 0.3],
    [-0.7, -0.5],
  ] as const) {
    b.tri([0, 3, 0], [x * 0.2 + 0.2, 3.2, 0], [x, 4.6, z], '#6e4a2d', '#6e4a2d', '#7a5535', 0)
    b.tri([0, 3, 0], [x, 4.6, z], [x * 0.2 - 0.2, 3.2, 0], '#6e4a2d', '#7a5535', '#6e4a2d', 0)
  }
  const lumps: readonly (readonly [number, number, number, number])[] = [
    [0, 6.2, 0, 2.7],
    [1.7, 5.3, 0.6, 2.0],
    [-1.6, 5.4, -0.7, 2.1],
    [0.3, 5.1, -1.7, 1.9],
    [-0.4, 7.6, 0.5, 1.8],
  ]
  for (const [x, y, z, radius] of lumps) {
    const wobble = 0.9 + random() * 0.25
    b.blob([x, y, z], radius, [wobble, 0.78, wobble], '#1a5226', '#5fae3e', 1)
  }
  return b.build()
}

/** Dark, narrow conifer for the slopes. */
export function cypressGeometry(): THREE.BufferGeometry {
  const b = new MeshBuilder()
  b.tube(0, 0, 0, 1.6, 0.28, 0.2, 5, '#5b3f26', '#5b3f26', 0)
  const tiers: readonly (readonly [number, number, number])[] = [
    [1.0, 2.2, 3.3],
    [2.8, 1.8, 3.0],
    [4.7, 1.3, 2.6],
    [6.3, 0.9, 2.4],
  ]
  for (const [base, radius, height] of tiers) {
    b.tube(0, 0, base, base + height, radius, 0.02, 7, '#17452e', '#2f7a47')
  }
  return b.build()
}

/** Cheap far silhouette: a squat cone on a stub. */
export function distantTreeGeometry(): THREE.BufferGeometry {
  const b = new MeshBuilder()
  b.tube(0, 0, 0, 2, 0.35, 0.3, 4, '#4a3a2a', '#4a3a2a', 0)
  b.tube(0, 0, 1.5, 11, 3.0, 0.05, 5, '#1f5a35', '#3d8a52')
  return b.build()
}
