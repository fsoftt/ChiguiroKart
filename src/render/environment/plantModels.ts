import * as THREE from 'three'
import type { PlantModel, VegetationLayerName } from '../../config/tracks/environment'
import { seededRandom } from '../scenery/random'
import { MeshBuilder } from './meshBuilder'
import {
  blade,
  broadleafTreeGeometry,
  bushGeometry,
  cypressGeometry,
  distantTreeGeometry,
  fernGeometry,
  flowerGeometry,
  frond,
  grassTuftGeometry,
  waxPalmGeometry,
} from './vegetationModels'

type V3 = readonly [number, number, number]
type Palette3 = readonly [string, string, string]

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

/** Home layer of each model: the one it is sized for (see `PlantModel`). */
export const PLANT_LAYER: Record<PlantModel, VegetationLayerName> = {
  grass: 'grass',
  dryGrass: 'grass',
  snowGrass: 'grass',
  flowers: 'flowers',
  bush: 'bushes',
  dryBush: 'bushes',
  frailejon: 'bushes',
  fern: 'ferns',
  macarenia: 'ferns',
  agave: 'ferns',
  waxPalm: 'palms',
  coconutPalm: 'palms',
  moriche: 'palms',
  cardon: 'palms',
  ceiba: 'palms',
  broadleaf: 'trees',
  jungle: 'trees',
  saman: 'trees',
  dryTree: 'trees',
  eucalyptus: 'trees',
  cypress: 'cypress',
  snowPine: 'cypress',
  saltCrystal: 'cypress',
  rockSpire: 'cypress',
  distantTree: 'distant',
  distantPalm: 'distant',
  distantRock: 'distant',
}

/**
 * Tapered prism (or cone when `r1` is 0) from `p0` to `p1` in any direction. Colors by ring.
 * Open at both ends.
 */
function limb(
  b: MeshBuilder,
  p0: V3,
  p1: V3,
  r0: number,
  r1: number,
  sides: number,
  c0: string,
  c1: string = c0,
  tint = 1,
): void {
  const axis = norm(sub(p1, p0))
  const helper: V3 = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const u = norm(cross(axis, helper))
  const v = cross(axis, u)
  const ring = (p: V3, r: number, s: number): V3 => {
    const a = (s / sides) * Math.PI * 2
    return add(p, add(mul(u, Math.cos(a) * r), mul(v, Math.sin(a) * r)))
  }
  for (let s = 0; s < sides; s++) {
    const a = ring(p0, r0, s)
    const bb = ring(p0, r0, s + 1)
    if (r1 <= 0.001) {
      b.tri(a, bb, p1, c0, c0, c1, tint)
    } else {
      b.quad(a, bb, ring(p1, r1, s + 1), ring(p1, r1, s), c0, c0, c1, c1, tint)
    }
  }
}

/** Stiff pointed leaf: a quad to the widest point and a triangle to the tip. */
function spear(
  b: MeshBuilder,
  base: V3,
  yaw: number,
  pitch: number,
  length: number,
  width: number,
  droop: number,
  colors: Palette3,
  tint = 1,
): void {
  const dir: V3 = [
    Math.cos(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.sin(yaw) * Math.cos(pitch),
  ]
  const side: V3 = [-Math.sin(yaw), 0, Math.cos(yaw)]
  const mid = add(add(base, mul(dir, length * 0.5)), [0, -droop * length * 0.12, 0])
  const tip = add(add(base, mul(dir, length)), [0, -droop * length * 0.45, 0])
  const w0 = width * 0.35
  const w1 = width * 0.5
  b.quad(
    sub(base, mul(side, w0)),
    add(base, mul(side, w0)),
    add(mid, mul(side, w1)),
    sub(mid, mul(side, w1)),
    colors[0],
    colors[0],
    colors[1],
    colors[1],
    tint,
  )
  b.tri(
    sub(mid, mul(side, w1)),
    add(mid, mul(side, w1)),
    tip,
    colors[1],
    colors[1],
    colors[2],
    tint,
  )
}

/** Fan-shaped leaf (palmate): `spread` radians wide, rim curling down at the sides. */
function fan(
  b: MeshBuilder,
  base: V3,
  yaw: number,
  pitch: number,
  length: number,
  spread: number,
  curl: number,
  colors: readonly [string, string],
  tint = 1,
): void {
  const rim: V3[] = []
  const steps = 4
  for (let i = 0; i <= steps; i++) {
    const t = i / steps - 0.5
    const a = yaw + t * spread
    const edge = Math.abs(t) * 2
    rim.push([
      base[0] + Math.cos(a) * Math.cos(pitch) * length,
      base[1] + Math.sin(pitch) * length - curl * edge * edge * length,
      base[2] + Math.sin(a) * Math.cos(pitch) * length,
    ])
  }
  for (let i = 0; i < steps; i++) {
    b.tri(base, rim[i] as V3, rim[i + 1] as V3, colors[0], colors[1], colors[1], tint)
  }
}

/** Thin strip hanging from `top` with a kink, ending in a point (vine, drooping leaf). */
function hang(
  b: MeshBuilder,
  top: V3,
  length: number,
  width: number,
  sway: V3,
  colors: Palette3,
  tint = 1,
): void {
  const side: V3 = norm(cross(sway, [0, 1, 0]))
  const w = width / 2
  const mid = add(add(top, [0, -length * 0.55, 0]), mul(sway, 0.5))
  const end = add(add(top, [0, -length, 0]), sway)
  b.quad(
    sub(top, mul(side, w)),
    add(top, mul(side, w)),
    add(mid, mul(side, w * 0.8)),
    sub(mid, mul(side, w * 0.8)),
    colors[0],
    colors[0],
    colors[1],
    colors[1],
    tint,
  )
  b.tri(
    sub(mid, mul(side, w * 0.8)),
    add(mid, mul(side, w * 0.8)),
    end,
    colors[1],
    colors[1],
    colors[2],
    tint,
  )
}

/** Column with a star-shaped section (ribs), tapering from `r0` to `r1`, with a domed top. */
function fluted(
  b: MeshBuilder,
  base: V3,
  height: number,
  r0: number,
  r1: number,
  ribs: number,
  depth: number,
  crest: string,
  valley: string,
  cap: string,
): void {
  const points = ribs * 2
  const at = (i: number, y: number, r: number): V3 => {
    const a = (i / points) * Math.PI * 2
    const rr = i % 2 === 0 ? r : r * (1 - depth)
    return [base[0] + Math.cos(a) * rr, base[1] + y, base[2] + Math.sin(a) * rr]
  }
  const top = base[1] + height
  for (let i = 0; i < points; i++) {
    const c = i % 2 === 0 ? crest : valley
    const c2 = (i + 1) % 2 === 0 ? crest : valley
    b.quad(at(i, 0, r0), at(i + 1, 0, r0), at(i + 1, height, r1), at(i, height, r1), c, c2, c2, c)
    b.tri(at(i, height, r1), at(i + 1, height, r1), [base[0], top + r1 * 0.5, base[2]], c, c2, cap)
  }
}

/** Hexagonal crystal with a pointed tip, in any direction. */
function crystal(
  b: MeshBuilder,
  base: V3,
  dir: V3,
  length: number,
  radius: number,
  c: Palette3,
): void {
  const axis = norm(dir)
  const shoulder = add(base, mul(axis, length))
  const tip = add(base, mul(axis, length + radius * 1.6))
  const mid = add(base, mul(axis, length * 0.7))
  const helper: V3 = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const u = norm(cross(axis, helper))
  const v = cross(axis, u)
  const ring = (p: V3, r: number, s: number): V3 => {
    const a = (s / 6) * Math.PI * 2
    return add(p, add(mul(u, Math.cos(a) * r), mul(v, Math.sin(a) * r)))
  }
  for (let s = 0; s < 6; s++) {
    // Alternate faces get a lighter shade so the facets catch the eye
    const lift = s % 2 === 0 ? c[1] : c[0]
    b.quad(
      ring(base, radius, s),
      ring(base, radius, s + 1),
      ring(mid, radius * 0.98, s + 1),
      ring(mid, radius * 0.98, s),
      c[0],
      c[0],
      lift,
      lift,
    )
    b.quad(
      ring(mid, radius * 0.98, s),
      ring(mid, radius * 0.98, s + 1),
      ring(shoulder, radius * 0.92, s + 1),
      ring(shoulder, radius * 0.92, s),
      lift,
      lift,
      c[1],
      c[1],
    )
    b.tri(
      ring(shoulder, radius * 0.92, s),
      ring(shoulder, radius * 0.92, s + 1),
      tip,
      c[1],
      c[1],
      c[2],
    )
  }
}

/** Tuft of blades with its own palette; the grass variants share this. */
function tuft(
  seed: number,
  blades: number,
  tall: number,
  lean: number,
  colors: Palette3,
): THREE.BufferGeometry {
  const random = seededRandom(seed)
  const b = new MeshBuilder()
  for (let i = 0; i < blades; i++) {
    const angle = random() * Math.PI * 2
    const radius = random() * 0.17
    blade(
      b,
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      random() * Math.PI * 2,
      tall * (0.55 + random() * 0.6) + (radius < 0.06 ? 0.12 : 0),
      0.09 + random() * 0.05,
      lean * (0.5 + random()),
      colors,
    )
  }
  return b.build()
}

/** Straw-yellow tuft of the plains and the desert. */
export function dryGrassGeometry(): THREE.BufferGeometry {
  return tuft(101, 8, 0.8, 0.3, ['#7a5a1e', '#c4a03c', '#efd987'])
}

/** Pale frosty tuft of the high moor, blue-white at the tips. */
export function snowGrassGeometry(): THREE.BufferGeometry {
  return tuft(103, 8, 0.75, 0.25, ['#5d7a6c', '#a8c4bc', '#eef7ff'])
}

/** Olive-brown scrub: angular lumps with dead twigs poking out. */
export function dryBushGeometry(): THREE.BufferGeometry {
  const random = seededRandom(107)
  const b = new MeshBuilder()
  b.blob([0, 0.5, 0], 0.85, [1.2, 0.7, 1.1], '#4a3d1e', '#8f8038', 0)
  b.blob([0.7, 0.38, 0.3], 0.6, [1, 0.75, 1], '#54421f', '#9a8a3e', 0)
  b.blob([-0.6, 0.35, -0.35], 0.55, [1, 0.8, 1], '#4a3d1e', '#827432', 0)
  for (let i = 0; i < 6; i++) {
    const a = random() * Math.PI * 2
    const base: V3 = [Math.cos(a) * 0.5, 0.7, Math.sin(a) * 0.5]
    const tip: V3 = [Math.cos(a) * 1.15, 1.0 + random() * 0.5, Math.sin(a) * 1.15]
    limb(b, base, tip, 0.04, 0, 3, '#5e4a2c', '#9b8660', 0)
  }
  return b.build()
}

/** Frailejon (Espeletia): hairy trunk in a skirt of dead leaves, silvery rosette on top. */
export function frailejonGeometry(): THREE.BufferGeometry {
  const random = seededRandom(109)
  const b = new MeshBuilder()
  const trunkTop = 0.8
  b.tube(0, 0, 0, trunkTop, 0.2, 0.15, 6, '#6e5232', '#8a6a3e', 0)
  // Skirt of dead, drooping leaves in two rings
  for (let ring = 0; ring < 2; ring++) {
    const y = trunkTop - 0.1 - ring * 0.33
    const count = 7
    for (let i = 0; i < count; i++) {
      const a = ((i + ring * 0.5) / count) * Math.PI * 2
      const r0 = 0.15 + ring * 0.02
      const r1 = 0.36 + ring * 0.04
      const w = 0.11
      const s: V3 = [-Math.sin(a), 0, Math.cos(a)]
      const p0: V3 = [Math.cos(a) * r0, y, Math.sin(a) * r0]
      const p1: V3 = [Math.cos(a) * r1, y - 0.42, Math.sin(a) * r1]
      b.tri(sub(p0, mul(s, w)), add(p0, mul(s, w)), p1, '#b39a62', '#b39a62', '#6b5430', 0)
    }
  }
  // Silvery-green rosette of thick fuzzy leaves
  const colors: Palette3 = ['#6f8e5c', '#a9c4a0', '#e4efdc']
  const top: V3 = [0, trunkTop, 0]
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + random() * 0.3
    spear(b, top, a, 0.25 + random() * 0.15, 0.85, 0.26, 0.5, colors)
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4
    spear(b, top, a, 0.8 + random() * 0.15, 0.7, 0.22, 0.25, colors)
  }
  return b.build()
}

/** Macarenia clavigera: waving red and magenta ribbons with moss-like clumps. */
export function macareniaGeometry(): THREE.BufferGeometry {
  const random = seededRandom(113)
  const b = new MeshBuilder()
  b.blob([0, 0.08, 0], 0.3, [1.2, 0.3, 1.2], '#8c0f30', '#d8206a', 0)
  for (let i = 0; i < 17; i++) {
    const angle = random() * Math.PI * 2
    const radius = random() * 0.32
    blade(
      b,
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      random() * Math.PI * 2,
      0.55 + random() * 0.55,
      0.14 + random() * 0.08,
      0.25 + random() * 0.5,
      i % 3 === 0 ? ['#a01a40', '#e0245e', '#ff8fb8'] : ['#b02048', '#ff3a6e', '#ffb2cc'],
    )
  }
  // A few yellow-green algae strands between the red ribbons
  for (let i = 0; i < 3; i++) {
    blade(b, 0.12 * (i - 1), 0.1, i * 2.1, 0.45, 0.07, 0.25, ['#6a5a1a', '#b9a734', '#e8dc7a'])
  }
  return b.build()
}

/** Agave / fique: a rosette of stiff, pointed, blue-green leaves. */
export function agaveGeometry(): THREE.BufferGeometry {
  const random = seededRandom(127)
  const b = new MeshBuilder()
  const base: V3 = [0, 0.08, 0]
  const outer: Palette3 = ['#2c5f52', '#4d9a84', '#a3d2c0']
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + random() * 0.3
    spear(b, base, a, 0.35 + random() * 0.15, 1.3 + random() * 0.2, 0.34, 0.25, outer)
  }
  const inner: Palette3 = ['#336b5c', '#58a890', '#b4dccb']
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3
    spear(b, base, a, 0.95 + random() * 0.15, 1.15, 0.26, 0.05, inner)
  }
  spear(b, base, 0, 1.5, 1.0, 0.2, 0, ['#3d7d6a', '#69b59d', '#c4e8d6'])
  return b.build()
}

/** Coconut palm: leaning curved trunk, a bunch of coconuts and long arching fronds. */
export function coconutPalmGeometry(): THREE.BufferGeometry {
  const random = seededRandom(131)
  const b = new MeshBuilder()
  const segments = 7
  const height = 11.5
  const lean = 3.4
  const at = (t: number): V3 => [lean * t * t, height * t, 0.3 * Math.sin(t * 3)]
  for (let i = 0; i < segments; i++) {
    const t0 = i / segments
    const t1 = (i + 1) / segments
    const tone = i % 2 === 0 ? '#a49a86' : '#857b68'
    const r0 = 0.38 - 0.17 * t0 + (i === 0 ? 0.1 : 0)
    limb(b, at(t0), at(t1), r0, 0.38 - 0.17 * t1, 6, tone, tone, 0)
  }
  const crown = at(1)
  for (const [x, z] of [
    [0.3, 0.1],
    [-0.25, 0.25],
    [0.05, -0.32],
  ] as const) {
    const nut: V3 = [crown[0] + x, crown[1] - 0.35, crown[2] + z]
    b.blob(nut, 0.26, [1, 1, 1], '#4a3820', '#7a8a38', 0, 0)
  }
  const palette: Palette3 = ['#2c7430', '#4a9e3e', '#8ccb52']
  for (let f = 0; f < 9; f++) {
    const yaw = (f / 9) * Math.PI * 2 + (random() - 0.5) * 0.4
    const length = 4.8 + random() * 1.0
    frond(b, crown[0], crown[1] - 0.1, crown[2], yaw, length, 1.1, 0.75, 1.6, 1, palette)
  }
  frond(b, crown[0], crown[1], crown[2], 0.5, 2.2, 0.5, 2.4, 0.1, 1, [
    '#4a9e3e',
    '#8ccb52',
    '#b6e060',
  ])
  return b.build()
}

/** Moriche (Mauritia flexuosa): straight grey trunk and a round crown of big fan leaves. */
export function moricheGeometry(): THREE.BufferGeometry {
  const random = seededRandom(137)
  const b = new MeshBuilder()
  const top = 13
  const rings = 5
  for (let r = 0; r < rings; r++) {
    const y0 = (top * r) / rings
    const y1 = (top * (r + 1)) / rings
    const tone = r % 2 === 0 ? '#8d8b80' : '#767468'
    const r0 = 0.36 - 0.1 * (r / rings) + (r === 0 ? 0.1 : 0)
    b.tube(0, 0, y0, y1, r0, 0.36 - 0.1 * ((r + 1) / rings), 7, tone, tone, 0)
  }
  // Hanging bunches of reddish fruit
  b.blob([0.3, top - 0.9, 0.1], 0.42, [0.8, 1.2, 0.8], '#6a2a18', '#a8452a', 0, 0)
  b.blob([-0.25, top - 0.7, -0.2], 0.35, [0.8, 1.2, 0.8], '#6a2a18', '#a8452a', 0, 0)
  const crown: V3 = [0, top - 0.2, 0]
  const count = 14
  for (let i = 0; i < count; i++) {
    const yaw = (i / count) * Math.PI * 2 + random() * 0.3
    const tier = i % 3
    const pitch = tier === 0 ? 0.7 : tier === 1 ? 0.25 : -0.2
    fan(b, crown, yaw, pitch, 3.4 + random() * 0.6, 1.2, 0.5, ['#256a2c', '#79bb48'])
  }
  return b.build()
}

/** Cardon: tall ribbed columnar cactus with upturned arms. */
export function cardonGeometry(): THREE.BufferGeometry {
  const b = new MeshBuilder()
  const crest = '#4d9a52'
  const valley = '#26603a'
  fluted(b, [0, 0, 0], 4.5, 0.62, 0.58, 7, 0.28, crest, valley, '#6dbb62')
  fluted(b, [0, 4.5, 0], 4.2, 0.58, 0.5, 7, 0.28, crest, valley, '#7fc86c')
  const arms: readonly (readonly [number, number, number, number])[] = [
    [1.0, 3.0, 0, 3.2],
    [-0.9, 4.6, 0.5, 2.6],
    [0.2, 5.8, -1, 2.0],
  ]
  for (const [dx, y, dz, rise] of arms) {
    const start: V3 = [0, y, 0]
    const elbow: V3 = [dx * 1.5, y + 0.45, dz * 1.5]
    limb(b, start, elbow, 0.34, 0.32, 8, '#2f7040', '#3f8a4a')
    const root: V3 = [elbow[0], elbow[1] - 0.1, elbow[2]]
    fluted(b, root, rise, 0.34, 0.28, 5, 0.26, crest, valley, '#7fc86c')
  }
  return b.build()
}

/** Ceiba: huge emergent tree with buttress roots and a wide, flat, layered canopy. */
export function ceibaGeometry(): THREE.BufferGeometry {
  const random = seededRandom(139)
  const b = new MeshBuilder()
  const trunkTop = 16
  for (let i = 0; i < 3; i++) {
    const y0 = (trunkTop * i) / 3
    const y1 = (trunkTop * (i + 1)) / 3
    const tone = i === 0 ? '#8c8873' : '#9a9680'
    b.tube(0, 0, y0, y1, 1.15 - 0.4 * (i / 3), 1.15 - 0.4 * ((i + 1) / 3), 8, tone, tone, 0)
  }
  // Buttress roots: tall thin wedges flaring out from the foot
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + random() * 0.4
    const c = Math.cos(a)
    const s = Math.sin(a)
    const foot: V3 = [c * 3.4, 0, s * 3.4]
    const inner: V3 = [c * 1.1, 0, s * 1.1]
    const hi: V3 = [c * 0.95, 5.2 + random() * 1.5, s * 0.95]
    const w: V3 = [-s * 0.3, 0, c * 0.3]
    b.tri(sub(foot, w), add(foot, w), hi, '#6f6a58', '#6f6a58', '#9a9680', 0)
    b.tri(add(foot, w), sub(foot, w), hi, '#6f6a58', '#6f6a58', '#9a9680', 0)
    b.tri(sub(foot, w), inner, hi, '#6f6a58', '#7e7a66', '#9a9680', 0)
    b.tri(inner, add(foot, w), hi, '#7e7a66', '#6f6a58', '#9a9680', 0)
  }
  const lumps: readonly (readonly [number, number, number, number, number])[] = [
    [0, 18.6, 0, 6.5, 1],
    [7.5, 17.4, 2, 4.8, 0],
    [-6.5, 17.6, -3.5, 5.0, 0],
    [2, 17.2, -7.5, 4.6, 0],
    [-2.5, 17.5, 7.2, 4.8, 0],
    [3.5, 21.4, 1.5, 4.2, 0],
    [-3.0, 21.0, -1.5, 3.8, 0],
  ]
  for (const [x, y, z, radius, detail] of lumps) {
    if (x !== 0 || z !== 0) {
      const from: V3 = [0, trunkTop - 1.2, 0]
      limb(b, from, [x * 0.7, trunkTop + 0.9, z * 0.7], 0.45, 0.28, 5, '#807b66', '#8c8873', 0)
    }
    const wobble = 0.9 + random() * 0.2
    b.blob([x, y, z], radius, [wobble * 1.5, 0.38, wobble * 1.5], '#1b5629', '#62b043', detail)
  }
  return b.build()
}

/** Rainforest tree: dark dense crown on a buttressed trunk, with lianas hanging down. */
export function jungleTreeGeometry(): THREE.BufferGeometry {
  const random = seededRandom(149)
  const b = new MeshBuilder()
  b.tube(0, 0, 0, 4.8, 0.45, 0.3, 6, '#5b4630', '#6e5638', 0)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4
    const hi: V3 = [Math.cos(a) * 0.4, 1.8, Math.sin(a) * 0.4]
    const foot: V3 = [Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4]
    const w: V3 = [-Math.sin(a) * 0.15, 0, Math.cos(a) * 0.15]
    b.tri(sub(foot, w), add(foot, w), hi, '#4d3a26', '#4d3a26', '#6e5638', 0)
  }
  const lumps: readonly (readonly [number, number, number, number, number])[] = [
    [0, 7.4, 0, 3.2, 1],
    [2.4, 6.4, 0.8, 2.4, 0],
    [-2.3, 6.5, -0.9, 2.5, 0],
    [0.4, 6.2, -2.5, 2.3, 0],
    [-0.5, 9.0, 0.6, 2.0, 1],
  ]
  for (const [x, y, z, radius, detail] of lumps) {
    const wobble = 0.9 + random() * 0.25
    b.blob([x, y, z], radius, [wobble, 0.85, wobble], '#0e4426', '#3f9638', detail)
  }
  // Lianas
  for (let i = 0; i < 9; i++) {
    const a = random() * Math.PI * 2
    const r = 1.4 + random() * 2.2
    const top: V3 = [Math.cos(a) * r, 5.8 + random() * 0.8, Math.sin(a) * r]
    const sway: V3 = [(random() - 0.5) * 0.6, 0, (random() - 0.5) * 0.6]
    hang(b, top, 3.5 + random() * 2.5, 0.16, sway, ['#2a5a26', '#4c8a30', '#8cc04a'])
  }
  return b.build()
}

/** Saman (rain tree): short thick trunk forking into a very wide umbrella canopy. */
export function samanGeometry(): THREE.BufferGeometry {
  const random = seededRandom(151)
  const b = new MeshBuilder()
  b.tube(0, 0, 0, 3.2, 0.62, 0.46, 7, '#6a5238', '#7a6042', 0)
  const heads: readonly V3[] = [
    [2.6, 6.0, 0.4],
    [-2.2, 5.8, 1.6],
    [-0.4, 5.9, -2.8],
  ]
  for (const head of heads) limb(b, [0, 2.8, 0], head, 0.34, 0.2, 5, '#6a5238', '#7a6042', 0)
  const lumps: readonly (readonly [number, number, number, number, number])[] = [
    [0, 7.6, 0, 4.6, 1],
    [4.8, 6.8, 0.8, 3.4, 0],
    [-4.4, 6.8, 2.0, 3.4, 0],
    [-0.8, 6.8, -4.8, 3.5, 0],
    [2.6, 6.8, 4.4, 3.2, 0],
    [-3.0, 7.0, -3.2, 3.1, 0],
  ]
  for (const [x, y, z, radius, detail] of lumps) {
    const wobble = 0.92 + random() * 0.18
    b.blob([x, y, z], radius, [wobble * 1.25, 0.55, wobble * 1.25], '#2a6a2c', '#86cc44', detail)
  }
  return b.build()
}

/** Leafless, twisted dry-forest tree: forking grey-brown limbs. */
export function dryTreeGeometry(): THREE.BufferGeometry {
  const random = seededRandom(157)
  const b = new MeshBuilder()
  const grow = (from: V3, dir: V3, length: number, radius: number, depth: number): void => {
    const to = add(from, mul(dir, length))
    const sides = depth === 3 ? 5 : 4
    const tip = depth === 0
    limb(
      b,
      from,
      to,
      radius,
      radius * 0.62,
      sides,
      tip ? '#8c7f6c' : '#5a4c3e',
      tip ? '#a69a86' : '#7a6a58',
    )
    if (tip) return
    const kids = depth === 3 ? 3 : 2
    for (let k = 0; k < kids; k++) {
      const spread: V3 = [random() - 0.5, random() * 0.4, random() - 0.5]
      const next = norm(add(add(mul(dir, 0.75), mul(spread, 1.3)), [0, 0.35, 0]))
      grow(to, next, length * 0.74, radius * 0.62, depth - 1)
    }
  }
  grow([0, 0, 0], norm([0.12, 1, 0.05]), 2.3, 0.3, 3)
  return b.build()
}

/** Eucalyptus: tall slender pale trunk with peeling bark and droopy grey-green foliage. */
export function eucalyptusGeometry(): THREE.BufferGeometry {
  const random = seededRandom(163)
  const b = new MeshBuilder()
  const height = 9
  const segments = 5
  const at = (t: number): V3 => [0.6 * Math.sin(t * 2.2), height * t, 0.25 * Math.sin(t * 3.4)]
  for (let i = 0; i < segments; i++) {
    const t0 = i / segments
    const t1 = (i + 1) / segments
    const light = '#ddd6bd'
    const dark = '#bdb69c'
    const r0 = 0.3 - 0.14 * t0 + (i === 0 ? 0.08 : 0)
    const r1 = 0.3 - 0.14 * t1
    limb(b, at(t0), at(t1), r0, r1, 6, i % 2 === 0 ? light : dark, i % 2 === 0 ? dark : light, 0)
  }
  const clusters: readonly (readonly [number, number, number, number])[] = [
    [0.6, 8.2, 0.3, 1.8],
    [-0.8, 6.9, 0.5, 1.8],
    [0.7, 5.8, -0.5, 1.6],
    [-0.1, 9.7, -0.2, 1.3],
  ]
  for (const [x, y, z, size] of clusters) {
    const from = at(Math.min(1, Math.max(0.5, (y - 1.5) / height)))
    limb(b, from, [x, y - 0.2, z], 0.1, 0.06, 4, '#a89f88', '#8c846f', 0)
    b.blob([x, y, z], size, [1, 1.15, 1], '#43604d', '#9db99b', 0)
    for (let k = 0; k < 3; k++) {
      const a = random() * Math.PI * 2
      const top: V3 = [x + Math.cos(a) * size * 0.7, y - 0.4, z + Math.sin(a) * size * 0.7]
      const sway: V3 = [Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15]
      hang(b, top, 1.8 + random() * 1.0, 0.4, sway, ['#4f6e58', '#7f9f84', '#b4cdb0'])
    }
  }
  return b.build()
}

/** Conifer of the high moor: tiers of dark green with snow resting on top of each. */
export function snowPineGeometry(): THREE.BufferGeometry {
  const b = new MeshBuilder()
  limb(b, [0, 0, 0], [0, 1.6, 0], 0.28, 0.2, 5, '#5b4a3a', '#5b4a3a', 0)
  const tiers: readonly (readonly [number, number, number])[] = [
    [1.0, 2.5, 3.3],
    [2.9, 2.0, 3.0],
    [4.7, 1.5, 2.6],
    [6.3, 1.0, 2.4],
  ]
  for (const [base, radius, height] of tiers) {
    limb(b, [0, base, 0], [0, base + height, 0], radius, 0, 7, '#14402c', '#2b7348')
    // Snow cap: the upper part of the cone, a little wider than the needles under it
    const f = 0.4
    const capRadius = radius * (1 - f) * 1.07
    const from: V3 = [0, base + height * f, 0]
    limb(b, from, [0, base + height + 0.15, 0], capRadius, 0, 7, '#dfe9f2', '#ffffff', 0)
  }
  return b.build()
}

/** Cluster of translucent-looking pink and white salt crystals on a salt mound. */
export function saltCrystalGeometry(): THREE.BufferGeometry {
  const random = seededRandom(167)
  const b = new MeshBuilder()
  b.blob([0, 0.3, 0], 1.3, [1.3, 0.35, 1.3], '#a9808a', '#d6b4ba', 0)
  const palettes: readonly Palette3[] = [
    ['#c98494', '#f1c3cc', '#ffffff'],
    ['#d6a8b8', '#f6dde4', '#ffffff'],
    ['#bfa0c8', '#e8d6ee', '#ffffff'],
  ]
  crystal(b, [0, 0.1, 0], [0.05, 1, 0.03], 4.6, 0.55, palettes[0] as Palette3)
  const around = 8
  for (let i = 0; i < around; i++) {
    const a = (i / around) * Math.PI * 2 + random() * 0.4
    const tilt = 0.4 + random() * 0.45
    const out = 0.7 + random() * 0.8
    crystal(
      b,
      [Math.cos(a) * out, 0.1, Math.sin(a) * out],
      [Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt)],
      1.6 + random() * 2.4,
      0.26 + random() * 0.16,
      palettes[i % palettes.length] as Palette3,
    )
  }
  return b.build()
}

/** Eroded red and grey rock pinnacle of the Tatacoa, with a smaller twin and rubble. */
export function rockSpireGeometry(): THREE.BufferGeometry {
  const random = seededRandom(173)
  const b = new MeshBuilder()
  const levels: readonly (readonly [number, number, string])[] = [
    [0, 2.3, '#8f4a2e'],
    [1.3, 1.7, '#b86a40'],
    [2.5, 2.0, '#8a817a'],
    [3.7, 1.15, '#c47a4a'],
    [5.0, 1.35, '#9a5232'],
    [6.4, 0.7, '#d9a070'],
  ]
  const sides = 7
  const spire = (cx: number, cz: number, scale: number, shift: number): void => {
    const rings = levels.map(([y, r]) => {
      const ring: V3[] = []
      for (let s = 0; s < sides; s++) {
        const a = (s / sides) * Math.PI * 2 + shift
        const rr = r * scale * (0.82 + random() * 0.36)
        ring.push([cx + Math.cos(a) * rr, y * scale, cz + Math.sin(a) * rr])
      }
      return ring
    })
    for (let l = 0; l < levels.length - 1; l++) {
      const lo = rings[l] as V3[]
      const hi = rings[l + 1] as V3[]
      const cLo = (levels[l] as readonly [number, number, string])[2]
      const cHi = (levels[l + 1] as readonly [number, number, string])[2]
      for (let s = 0; s < sides; s++) {
        const n = (s + 1) % sides
        b.quad(lo[s] as V3, lo[n] as V3, hi[n] as V3, hi[s] as V3, cLo, cLo, cHi, cHi)
      }
    }
    const last = rings[rings.length - 1] as V3[]
    for (let s = 0; s < sides; s++) {
      const apex: V3 = [cx, 7.8 * scale, cz]
      b.tri(last[s] as V3, last[(s + 1) % sides] as V3, apex, '#d9a070', '#d9a070', '#f0c898')
    }
  }
  spire(0, 0, 1, 0)
  spire(3.0, 1.2, 0.5, 0.4)
  b.blob([-2.4, 0.5, 1.4], 0.9, [1.2, 0.7, 1], '#7a4a34', '#a87456', 0)
  b.blob([1.4, 0.35, -2.4], 0.7, [1.2, 0.7, 1], '#7a4a34', '#a87456', 0)
  return b.build()
}

/** Cheap far palm: leaning stub and a few drooping leaf quads (about 20 triangles). */
export function distantPalmGeometry(): THREE.BufferGeometry {
  const b = new MeshBuilder()
  limb(b, [0, 0, 0], [0.6, 9.5, 0], 0.45, 0.25, 4, '#4a3a2a', '#4a3a2a', 0)
  const crown: V3 = [0.6, 9.5, 0]
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    const tip: V3 = [crown[0] + Math.cos(a) * 3.6, crown[1] - 1.5, crown[2] + Math.sin(a) * 3.6]
    const w: V3 = [-Math.sin(a) * 0.7, 0, Math.cos(a) * 0.7]
    b.tri(sub(crown, mul(w, 0.3)), add(crown, mul(w, 0.3)), tip, '#1f5a35', '#1f5a35', '#4f9a58')
    b.tri(add(crown, mul(w, 0.3)), sub(crown, mul(w, 0.3)), tip, '#1f5a35', '#1f5a35', '#4f9a58')
  }
  return b.build()
}

/** Cheap far rock mound: two squashed low-poly lumps (40 triangles). */
export function distantRockGeometry(): THREE.BufferGeometry {
  const b = new MeshBuilder()
  b.blob([0, 4.4, 0], 6.5, [1.35, 0.8, 1.1], '#5e5650', '#a89e8e', 0)
  b.blob([6.5, 2.6, 1.5], 4, [1.2, 0.75, 1], '#625a52', '#9c9284', 0)
  return b.build()
}

export const PLANT_GEOMETRIES: Record<PlantModel, () => THREE.BufferGeometry> = {
  grass: grassTuftGeometry,
  dryGrass: dryGrassGeometry,
  snowGrass: snowGrassGeometry,
  flowers: flowerGeometry,
  bush: bushGeometry,
  dryBush: dryBushGeometry,
  frailejon: frailejonGeometry,
  fern: fernGeometry,
  macarenia: macareniaGeometry,
  agave: agaveGeometry,
  waxPalm: waxPalmGeometry,
  coconutPalm: coconutPalmGeometry,
  moriche: moricheGeometry,
  cardon: cardonGeometry,
  ceiba: ceibaGeometry,
  broadleaf: broadleafTreeGeometry,
  jungle: jungleTreeGeometry,
  saman: samanGeometry,
  dryTree: dryTreeGeometry,
  eucalyptus: eucalyptusGeometry,
  cypress: cypressGeometry,
  snowPine: snowPineGeometry,
  saltCrystal: saltCrystalGeometry,
  rockSpire: rockSpireGeometry,
  distantTree: distantTreeGeometry,
  distantPalm: distantPalmGeometry,
  distantRock: distantRockGeometry,
}
