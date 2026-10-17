import * as THREE from 'three'
import type { PropKind } from '../../config/tracks/environment'
import { DecorBuilder, type Vec3Tuple } from './decorBuilder'

/**
 * Props of the tracks beyond Cocora. Every model is built in local space on the ground (y = 0),
 * centered on the origin and facing +z (the road). Everything is vertex-colored boxes, cylinders,
 * balls and triangles of the shared decor builder.
 */

const PI = Math.PI
const WOOD = '#8d5524'
const DARK_WOOD = '#5e3a1c'

/** Deterministic pseudo-random number in 0..1. */
function hash(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

function pick<T>(list: readonly T[], i: number): T {
  return list[i % list.length] as T
}

/** Gabled roof along x: two slabs from the ridge (y = eaveY + run * tan) down to the eaves. */
function gable(
  b: DecorBuilder,
  color: string,
  gableColor: string | null,
  width: number,
  halfDepth: number,
  eaveY: number,
  rise: number,
  over = 0.5,
): void {
  const run = halfDepth + over
  const t = Math.tan(rise)
  const length = run / Math.cos(rise) + 0.12
  const thick = 0.26
  for (const s of [-1, 1]) {
    b.box(
      color,
      width + 1,
      thick,
      length,
      [0, eaveY + (run * t) / 2 - thick / 2, (s * run) / 2],
      [s * rise, 0, 0],
    )
  }
  if (gableColor) {
    for (const x of [-width / 2, width / 2]) {
      b.triangle(
        gableColor,
        [x, eaveY, -halfDepth],
        [x, eaveY, halfDepth],
        [x, eaveY + halfDepth * t, 0],
      )
    }
  }
}

/** Cheaper person for big crowds: a body and a head. */
function fan(b: DecorBuilder, x: number, y: number, z: number, shirt: string, skin: string): void {
  b.box(shirt, 0.36, 0.5, 0.24, [x, y, z])
  b.box(skin, 0.26, 0.26, 0.26, [x, y + 0.5, z])
}

const SKINS = ['#e0ac84', '#c68642', '#8d5524', '#f1c27d', '#a86b3c']
const SHIRTS = ['#ffd23f', '#e63946', '#2a9df4', '#ffffff', '#2fb457', '#ff8c1a', '#f06cb0']

/** Triangle pennants along a sagging string from (x0, y) to (x1, y) at depth z. */
function bunting(
  b: DecorBuilder,
  x0: number,
  x1: number,
  y: number,
  z: number,
  sag: number,
  count: number,
  colors: readonly string[],
): void {
  const point = (t: number): Vec3Tuple => [x0 + (x1 - x0) * t, y - sag * (1 - (2 * t - 1) ** 2), z]
  for (let k = 0; k < count; k++) {
    const p0 = point(k / count)
    const p1 = point((k + 1) / count)
    b.triangle(pick(colors, k), p0, p1, [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 - 0.6, z])
  }
}

function flag(
  b: DecorBuilder,
  x: number,
  y: number,
  z: number,
  height: number,
  color: string,
  dir: 1 | -1 = 1,
): void {
  b.box('#eeeeee', 0.1, height, 0.1, [x, y, z])
  b.triangle(
    color,
    [x, y + height, z],
    [x, y + height - 0.8, z],
    [x + dir * 1.4, y + height - 0.4, z],
  )
}

function grandstand(b: DecorBuilder): void {
  const width = 17
  const rows = 5
  const deckColors = ['#d63a2f', '#2a9df4', '#ffd23f', '#2fb457']
  b.box('#6b6a66', width + 0.6, 0.3, 8.6, [0, -0.2, 0])
  for (let r = 0; r < rows; r++) {
    const z = -3.4 + r * 1.4
    const h = (rows - r) * 0.75
    b.box('#bdb8ac', width, h, 1.4, [0, 0, z])
    b.box(pick(deckColors, r), width, 0.1, 0.5, [0, h, z + 0.35])
    const n = 21
    for (let i = 0; i < n; i++) {
      if (hash(r * 40 + i) < 0.08) continue
      const x = -width / 2 + 0.5 + (i * (width - 1)) / (n - 1)
      fan(b, x, h + 0.1, z - 0.1, pick(SHIRTS, Math.floor(hash(i + r * 7) * 7)), pick(SKINS, i + r))
    }
  }
  // Side walls and the front advertising boards
  for (const s of [-1, 1])
    b.box('#cfc8b6', 0.4, rows * 0.75 + 0.5, 7.4, [s * (width / 2 + 0.2), 0, 0.4])
  const boards = ['#e63946', '#ffd23f', '#2a9df4', '#ffffff', '#2fb457', '#ff8c1a']
  for (let k = 0; k < 6; k++) {
    b.box(boards[k] as string, width / 6 - 0.05, 0.9, 0.12, [
      -width / 2 + (k + 0.5) * (width / 6),
      0,
      3.6,
    ])
  }
  // Roof on posts over the back rows, striped
  const roofY = 5.7
  for (const x of [-8.2, -4.1, 0, 4.1, 8.2])
    b.cylinder('#d9d9d9', 0.14, 0.14, roofY, [x, 0, -4.1], [0, 0, 0], 6)
  for (const s of [-1, 1])
    b.cylinder('#d9d9d9', 0.14, 0.14, roofY - 1.2, [s * 8.2, 0, 0.5], [0, 0, 0], 6)
  for (let k = 0; k < 10; k++) {
    b.box(
      k % 2 === 0 ? '#d63a2f' : '#ffffff',
      width / 10,
      0.25,
      5.4,
      [-width / 2 + (k + 0.5) * (width / 10) + 0, roofY - 0.35 + 0.1, -1.7],
      [0.12, 0, 0],
    )
  }
  // Corner flags
  flag(b, -8.9, 0, 3.7, 6.2, '#ffd23f')
  flag(b, 8.9, 0, 3.7, 6.2, '#2a9df4', -1)
}

function colonialHouse(b: DecorBuilder): void {
  const wall = '#f6ecd2'
  const accent = '#3fa7a0'
  const roofY = 6.4
  b.box('#c9bfa6', 9.6, 0.5, 6.8, [0, -0.2, 0])
  b.box(wall, 9, 3.2, 6.4, [0, 0.3, 0])
  b.box('#f2cf6b', 9, 3.1, 6.4, [0, 3.5, 0])
  b.box('#fffaf0', 9.3, 0.3, 6.7, [0, 3.35, 0])
  b.box('#fffaf0', 9.3, 0.3, 6.7, [0, 6.5, 0])
  b.box(accent, 9.05, 0.7, 6.45, [0, 0.3, 0])
  gable(b, '#c1562f', wall, 9, 3.2, roofY + 0.3, 0.42, 0.6)
  for (let k = 0; k < 5; k++)
    b.box('#a8431f', 10, 0.06, 0.1, [0, roofY + 0.45 + k * 0.01, -2.6 + k * 1.3 + 0.0])
  b.box('#e9d9b0', 0.9, 1.6, 0.9, [-2.6, roofY + 0.9, -0.8])
  b.box('#a8431f', 1.1, 0.2, 1.1, [-2.6, roofY + 2.4, -0.8])
  // Front door (arched look) and ground floor windows with iron bars
  b.box(DARK_WOOD, 1.7, 2.3, 0.14, [0, 0.3, 3.2])
  b.box('#3a2412', 1.3, 0.2, 0.16, [0, 2.6, 3.21])
  b.ball('#f2cf6b', 0.12, [0.5, 1.3, 3.34])
  for (const x of [-3, 3]) {
    b.box(accent, 1.7, 1.7, 0.1, [x, 1.0, 3.2])
    b.box('#5fb4e6', 1.3, 1.3, 0.12, [x, 1.2, 3.22])
    for (let k = 0; k < 4; k++) b.box('#222222', 0.05, 1.4, 0.06, [x - 0.5 + k * 0.33, 1.15, 3.32])
  }
  // Upper floor: balcony deck, balusters, flowers, shuttered doors
  b.box(WOOD, 7.6, 0.24, 1.5, [0, 3.45, 3.95])
  for (let k = 0; k < 4; k++) b.box('#6b3a1f', 0.28, 0.3, 0.8, [-3 + k * 2, 3.15, 3.5])
  for (let k = 0; k <= 15; k++) b.box('#fff6df', 0.09, 0.9, 0.09, [-3.7 + k * 0.49, 3.69, 4.65])
  b.box(WOOD, 7.7, 0.14, 0.2, [0, 4.6, 4.65])
  for (const s of [-1, 1]) b.box(WOOD, 0.14, 0.9, 1.5, [s * 3.75, 3.69, 3.95])
  const flowers = ['#ff4f9a', '#ff7a1a', '#e63946', '#ffd23f']
  for (let k = 0; k < 7; k++) {
    b.box('#4a8a3a', 0.9, 0.25, 0.3, [-3 + k, 4.6, 4.75])
    b.box(pick(flowers, k), 0.5, 0.35, 0.4, [-3 + k, 4.85, 4.75])
  }
  for (const x of [-2.4, 0, 2.4]) {
    b.box(DARK_WOOD, 1.3, 2.3, 0.1, [x, 3.7, 3.2])
    for (const s of [-1, 1]) b.box(accent, 0.45, 2.3, 0.12, [x + s * 0.9, 3.7, 3.22])
  }
  for (const s of [-1, 1]) b.ball('#ff4f9a', 0.7, [s * 4.2, 1.2, 3.4], [1, 1.3, 1])
}

function chiva(b: DecorBuilder): void {
  const stripes = ['#ffd23f', '#e63946', '#2a9df4', '#2fb457']
  // Chassis and wheels (the bus runs along x, the cab on the right)
  b.box('#222222', 6.6, 0.3, 1.9, [0, 0.55, 0])
  for (const x of [-2.1, 2.0]) {
    for (const s of [-1, 1]) {
      b.cylinder('#161616', 0.55, 0.55, 0.35, [x, 0.55, s * 1.0], [PI / 2, 0, 0], 8)
      b.cylinder('#ffd23f', 0.28, 0.28, 0.38, [x, 0.55, s * 1.0], [PI / 2, 0, 0], 5)
    }
  }
  // Painted side panels in stripes
  for (const s of [-1, 1]) {
    stripes.forEach((c, i) => {
      b.box(c, 5.0, 0.28, 0.12, [-0.5, 0.9 + i * 0.28, s * 1.1])
    })
    b.box('#7a4a28', 5.0, 0.12, 0.14, [-0.5, 2.0, s * 1.1])
  }
  b.box(DARK_WOOD, 5.0, 0.15, 2.2, [-0.5, 0.85, 0])
  // Open sides: posts, benches, passengers
  for (let k = 0; k < 6; k++) {
    for (const s of [-1, 1]) b.box('#7a4a28', 0.14, 1.3, 0.14, [-2.8 + k * 1.0, 1.95, s * 1.08])
  }
  for (let k = 0; k < 4; k++) {
    b.box('#a66a33', 0.5, 0.12, 1.8, [-2.4 + k * 1.25, 1.2, 0])
    b.box('#a66a33', 0.1, 0.55, 1.8, [-2.6 + k * 1.25, 1.3, 0])
    if (k !== 2) {
      fan(b, -2.4 + k * 1.25, 1.35, 0.5, pick(SHIRTS, k * 2), pick(SKINS, k))
      fan(b, -2.4 + k * 1.25, 1.35, -0.45, pick(SHIRTS, k * 3 + 1), pick(SKINS, k + 2))
    }
  }
  // Hood, cab, windshield and lights
  b.box('#e63946', 1.5, 0.95, 1.9, [3.0, 0.85, 0])
  b.box('#ffd23f', 1.52, 0.2, 1.92, [3.0, 1.4, 0])
  b.box('#2a9df4', 1.52, 0.2, 1.92, [3.0, 1.0, 0])
  b.box('#bbbbbb', 0.12, 0.6, 1.2, [3.78, 0.95, 0])
  for (const s of [-1, 1]) b.ball('#fff2b0', 0.2, [3.78, 1.55, s * 0.7])
  b.box('#5fb4e6', 0.1, 0.8, 1.7, [2.2, 1.8, 0], [0, 0, -0.2])
  // Canopy roof and rack
  b.box('#ffd23f', 5.6, 0.2, 2.5, [-0.7, 2.6, 0])
  b.box('#e63946', 5.6, 0.22, 0.5, [-0.7, 2.6, 1.0])
  b.box('#2a9df4', 5.6, 0.22, 0.5, [-0.7, 2.6, -1.0])
  for (let k = 0; k < 6; k++) b.box('#5e3a1c', 0.08, 0.5, 2.2, [-3.2 + k * 1.0, 2.8, 0])
  b.box('#5e3a1c', 5.4, 0.08, 0.08, [-0.7, 3.3, 1.1])
  b.box('#5e3a1c', 5.4, 0.08, 0.08, [-0.7, 3.3, -1.1])
  // Luggage on the roof
  b.ball('#d2b27a', 0.5, [-2.5, 3.1, 0.2], [1, 0.8, 0.9])
  b.ball('#c49a5e', 0.45, [-1.6, 3.1, -0.3], [1, 0.8, 0.9])
  b.box('#2a6fb0', 0.9, 0.6, 0.7, [-0.6, 2.8, 0.2])
  b.box('#d63a2f', 0.8, 0.5, 0.6, [0.4, 2.8, -0.3], [0, 0.3, 0])
  b.box('#2fb457', 0.6, 0.5, 0.5, [1.2, 2.8, 0.3])
  b.box('#ffb703', 0.5, 0.4, 0.5, [1.5, 2.8, -0.4])
  // Rear ladder and bumper
  b.box('#5e3a1c', 0.08, 2.2, 0.08, [-3.45, 0.8, 0.5])
  b.box('#5e3a1c', 0.08, 2.2, 0.08, [-3.45, 0.8, -0.5])
  b.box('#bbbbbb', 0.2, 0.18, 2.1, [-3.4, 0.5, 0])
}

function boat(b: DecorBuilder): void {
  const colors = ['#2a9df4', '#ffd23f', '#e63946']
  const steps = 8
  const halfBeam = (x: number): number => 0.16 + 0.8 * Math.sqrt(Math.max(0, 1 - (x / 3.05) ** 2))
  const tilt = 0.35
  b.box('#3a2412', 5.4, 0.12, 1.3, [0, 0.12, 0])
  for (let i = 0; i < steps; i++) {
    const x0 = -3 + (i * 6) / steps
    const x1 = -3 + ((i + 1) * 6) / steps
    const rise = (x: number): number => 0.05 * x * x
    for (const s of [-1, 1]) {
      const z0 = s * halfBeam(x0)
      const z1 = s * halfBeam(x1)
      const length = Math.hypot(x1 - x0, z1 - z0) + 0.04
      const yaw = -Math.atan2(z1 - z0, x1 - x0)
      const y = 0.1 + rise((x0 + x1) / 2)
      b.place(DecorBuilder.at((x0 + x1) / 2, y, (z0 + z1) / 2, yaw), () => {
        b.box(colors[0] as string, length, 0.62, 0.1, [0, 0, 0], [s * tilt, 0, 0])
        b.box(
          '#ffd23f',
          length,
          0.1,
          0.14,
          [0, 0.62 * Math.cos(tilt), s * 0.62 * Math.sin(tilt)],
          [s * tilt, 0, 0],
        )
      })
    }
  }
  b.box(colors[0] as string, 0.3, 0.5, 0.2, [-3.1, 0.5, 0], [0, 0, 0.4])
  // Seats, oars and cargo
  for (const x of [-1.2, 0.2, 1.3]) b.box(WOOD, 0.35, 0.1, 1.6, [x, 0.55, 0])
  b.box('#c49a5e', 0.08, 0.08, 2.6, [0.6, 0.6, 0.2], [0, 0.3, 0])
  b.ball('#d2b27a', 0.35, [-0.5, 0.35, 0.2], [1, 0.8, 1])
  b.ball('#ffb703', 0.2, [-0.5, 0.65, 0.2])
  // Outboard motor at the stern
  b.box('#e63946', 0.5, 0.55, 0.45, [2.75, 0.75, 0])
  b.box('#333333', 0.14, 0.9, 0.14, [2.9, -0.1, 0])
  b.box('#555555', 0.4, 0.2, 0.16, [2.9, -0.1, 0])
  b.box('#333333', 0.7, 0.08, 0.08, [3.2, 1.25, 0], [0, 0, 0.3])
  // Rocks propping the hull and a rope
  b.ball('#8a8a84', 0.4, [-1.5, 0.15, 0.95], [1.4, 0.6, 1])
  b.ball('#9a9a92', 0.4, [1.6, 0.15, -1.0], [1.4, 0.6, 1])
  b.cylinder('#d9c9a0', 0.25, 0.25, 0.12, [-1.7, 0.1, 1.9], [0, 0, 0], 8)
}

function mountainHut(b: DecorBuilder): void {
  const stones = ['#8a8a86', '#9b9a93', '#77777a', '#a8a59b']
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 7; i++) {
      const jitter = hash(i + j * 9)
      b.box(pick(stones, i + j), 0.95 + jitter * 0.1, 0.62, 0.3, [
        -2.9 + i * 0.97 + (j % 2) * 0.3,
        j * 0.6 - 0.1,
        2.25,
      ])
      b.box(pick(stones, i + j + 1), 0.95, 0.62, 0.3, [
        -2.9 + i * 0.97 + (j % 2) * 0.3,
        j * 0.6 - 0.1,
        -2.25,
      ])
    }
  }
  b.box('#8a8a86', 6.6, 1.9, 4.2, [0, -0.1, 0])
  b.box('#a8a59b', 6.8, 0.2, 4.4, [0, 1.75, 0])
  b.box('#7a4a28', 6.2, 1.1, 3.9, [0, 1.9, 0])
  gable(b, '#8a3b2e', '#7a4a28', 6.2, 1.95, 3.0, 0.95, 0.6)
  // Snow cap on the roof, with lumps at the eaves
  const run = 2.55
  const t = Math.tan(0.95)
  for (const s of [-1, 1]) {
    b.box(
      '#ffffff',
      7.0,
      0.32,
      (run / Math.cos(0.95)) * 0.85,
      [0, 3.0 + (run * t) / 2 + 0.2, (s * run) / 2 - s * 0.1],
      [s * 0.95, 0, 0],
    )
  }
  for (let k = 0; k < 7; k++) {
    for (const s of [-1, 1]) b.box('#f4f8ff', 0.9, 0.35, 0.5, [-3 + k, 2.75, s * 2.5])
  }
  // Chimney with snow
  b.box('#77777a', 0.8, 2, 0.8, [1.8, 3.4, -0.6])
  b.box('#ffffff', 0.95, 0.25, 0.95, [1.8, 5.35, -0.6])
  // Door, glowing windows, firewood and flag
  b.box(DARK_WOOD, 1.2, 1.9, 0.14, [0, -0.1, 2.35])
  b.box('#f2b632', 0.12, 0.12, 0.16, [0.4, 0.8, 2.4])
  for (const x of [-2.2, 2.2]) {
    b.box('#5e3a1c', 1.1, 0.9, 0.12, [x, 0.9, 2.4])
    b.box('#ffd86b', 0.8, 0.6, 0.14, [x, 1.05, 2.42])
  }
  for (let k = 0; k < 4; k++)
    b.cylinder('#a66a33', 0.18, 0.18, 1.4, [-3.55 + k * 0.38, 0.2, 0.5], [0, 0, PI / 2], 6)
  b.box('#5e3a1c', 0.12, 3.4, 0.12, [3.6, 0, 1.6])
  flag(b, 3.6, 3.0, 1.6, 0.9, '#e63946')
  // Snow drifts around the base
  const drifts: readonly (readonly [number, number, number])[] = [
    [-3.6, 0, 2.6],
    [3.4, 0, 2.8],
  ]
  for (const [x, y, z] of drifts) b.ball('#f4f8ff', 0.8, [x, y + 0.15, z], [1.5, 0.5, 1.1])
}

function saltCross(b: DecorBuilder): void {
  // Rough salt rock wall with a carved niche
  b.box('#4b5470', 7.4, 6.2, 1.4, [0, -0.2, -0.4])
  for (let k = 0; k < 6; k++) {
    b.box(k % 2 === 0 ? '#5d6990' : '#39425e', 1.1 + hash(k) * 0.4, 6 + (k % 3) * 0.3, 0.4, [
      -3.2 + k * 1.3,
      -0.2,
      0.45,
    ])
  }
  b.box('#2a3150', 4.6, 5.0, 0.2, [0, 0.3, 0.7])
  // Lit cross: halo layers (blue to white), the brightest in the middle
  const layers: readonly (readonly [string, number])[] = [
    ['#3fa9e8', 0.36],
    ['#9be0ff', 0.24],
    ['#f4fdff', 0.12],
  ]
  layers.forEach(([color, grow], i) => {
    const z = 0.82 + i * 0.04
    b.box(color, 0.7 + grow * 2, 3.6 + grow * 2, 0.06, [0, 1.0 - grow, z])
    b.box(color, 2.4 + grow * 2, 0.7 + grow * 2, 0.06, [0, 2.7 - grow - 0.35, z + 0.01])
  })
  // Steps, side lamps and salt crystals
  for (let k = 0; k < 3; k++)
    b.box(k % 2 === 0 ? '#d9d3e8' : '#c4bcd8', 4.4 - k * 0.5, 0.25, 1.1, [
      0,
      -0.1 + k * 0.22,
      1.6 + (2 - k) * 0.5 - 0.5,
    ])
  for (const s of [-1, 1]) {
    b.cylinder('#555a70', 0.12, 0.16, 1.4, [s * 3.0, 0, 1.7], [0, 0, 0], 6)
    b.ball('#ffb347', 0.28, [s * 3.0, 1.5, 1.7])
    b.cylinder('#f3ecff', 0.02, 0.4, 1.3, [s * 3.3, 0, 2.5], [0, 0, s * 0.1], 5)
    b.cylinder('#d9c8ff', 0.02, 0.3, 0.9, [s * 2.7, 0, 2.7], [0, 0, -s * 0.12], 5)
    b.cylinder('#ffffff', 0.02, 0.25, 0.7, [s * 3.7, 0, 1.9], [0, 0, 0], 5)
  }
}

function cannon(b: DecorBuilder): void {
  const bronze = '#a07a2e'
  b.cylinder('#8a8a84', 2.3, 2.4, 0.3, [0, -0.15, 0], [0, 0, 0], 12)
  // Wooden carriage
  for (const s of [-1, 1]) {
    b.box('#8d5524', 0.22, 0.5, 2.2, [s * 0.42, 0.55, -0.1])
    b.cylinder('#6b4423', 0.62, 0.62, 0.14, [s * 0.78, 0.62, 0], [0, 0, PI / 2], 12)
    b.cylinder('#2a1a10', 0.12, 0.12, 0.22, [s * 0.78, 0.62, 0], [0, 0, PI / 2], 6)
    b.box('#3a2412', 0.12, 1.2, 0.1, [s * 0.9, 0.02, 0], [0, 0, 0])
    b.box('#3a2412', 0.1, 0.1, 1.2, [s * 0.9, 0.57, -0.6])
  }
  b.box('#6b4423', 1.0, 0.2, 0.3, [0, 0.55, -0.4])
  b.box('#5e3a1c', 0.9, 0.1, 0.8, [0, 0.35, -1.1], [-0.25, 0, 0])
  // Bronze barrel (muzzle toward the road) with rings
  b.cylinder(bronze, 0.2, 0.34, 2.5, [0, 1.0, -1.0], [PI / 2 - 0.08, 0, 0], 10)
  for (const z of [-0.6, 0.4, 1.2]) {
    b.cylinder(
      '#c49a3e',
      0.3 - (z + 1) * 0.04,
      0.3 - (z + 1) * 0.04,
      0.12,
      [0, 1.0 + 0.08 * (z + 1) * -0.1, z],
      [PI / 2, 0, 0],
      10,
    )
  }
  b.ball(bronze, 0.2, [0, 1.0, -1.05])
  b.cylinder('#222222', 0.12, 0.12, 0.05, [0, 1.0 + 0.2, 1.5], [PI / 2, 0, 0], 8)
  // Pile of cannonballs
  const pile: readonly (readonly [number, number, number])[] = [
    [-1.9, 0.18, 1.6],
    [-1.55, 0.18, 1.6],
    [-1.7, 0.18, 1.3],
    [-1.72, 0.45, 1.5],
  ]
  for (const [x, y, z] of pile) b.ball('#2a2a2e', 0.18, [x, y, z])
  b.cylinder('#8d5524', 0.04, 0.04, 2.0, [1.6, 0.1, 0.8], [0, 0, PI / 2 - 0.05], 5)
  b.box('#e63946', 0.6, 0.08, 0.5, [1.6, 0.1, -1.3], [0, 0.4, 0])
}

function beachHut(b: DecorBuilder): void {
  const body = '#1fb5b0'
  const trim = '#ff5fa2'
  // Stilts and floor
  for (const x of [-2.2, 0, 2.2]) {
    for (const z of [-1.6, 1.6, 3.6]) {
      if (z === 3.6 && x === 0) continue
      b.cylinder(DARK_WOOD, 0.14, 0.17, 0.9, [x, -0.1, z], [0, 0, 0], 6)
    }
  }
  b.box('#a66a33', 5.6, 0.2, 3.8, [0, 0.8, 0])
  b.box('#a66a33', 5.6, 0.2, 1.6, [0, 0.8, 2.7])
  // Walls: bright body, stripes of color
  b.box(body, 5, 2.3, 3.4, [0, 1.0, 0])
  b.box('#ffd23f', 5.04, 0.35, 3.44, [0, 1.0, 0])
  b.box(trim, 5.04, 0.2, 3.44, [0, 3.0, 0])
  gable(b, '#e63946', '#ffd23f', 5, 1.7, 3.3, 0.45, 0.6)
  // Porch posts, rails and steps
  for (const x of [-2.6, 2.6]) b.box('#ffffff', 0.18, 2.4, 0.18, [x, 1.0, 3.45])
  b.box(trim, 5.8, 0.15, 0.2, [0, 3.35, 3.45])
  for (let k = 0; k <= 10; k++) b.box('#ffffff', 0.08, 0.7, 0.08, [-2.5 + k * 0.5, 1.0, 3.45])
  b.box('#ffffff', 5.4, 0.1, 0.12, [0, 1.75, 3.45])
  for (let k = 0; k < 3; k++) b.box('#c49a5e', 1.6, 0.15, 0.5, [0, 0.0 + k * 0.28, 4.4 - k * 0.45])
  // Door and shuttered windows
  b.box('#ffd23f', 1.1, 2.0, 0.12, [0, 1.0, 1.72])
  b.ball('#7a4a28', 0.1, [0.35, 1.9, 1.8])
  for (const x of [-1.8, 1.8]) {
    b.box('#ffffff', 1.1, 0.95, 0.1, [x, 1.9, 1.72])
    b.box('#5fb4e6', 0.8, 0.65, 0.12, [x, 2.05, 1.73])
    b.box(trim, 0.35, 0.95, 0.12, [x - 0.7, 1.9, 1.73])
    b.box(trim, 0.35, 0.95, 0.12, [x + 0.7, 1.9, 1.73])
  }
  // Hammock, surfboard and buoys
  b.box('#e63946', 1.8, 0.06, 0.5, [-1.2, 1.3, 3.0], [0, 0, 0.2])
  b.box('#ffd23f', 0.5, 2.2, 0.08, [3.0, 0, 2.2], [0, 0, 0.15])
  b.box('#ff5fa2', 0.5, 0.35, 0.08, [3.0, 0.7, 2.21], [0, 0, 0.15])
  for (let k = 0; k < 3; k++)
    b.ball(pick(['#e63946', '#ffffff', '#ffd23f'], k), 0.26, [-3.1 + k * 0.1, 0.35 + k * 0.5, 2.2])
}

function stoneTerrace(b: DecorBuilder): void {
  const stones = ['#8f8a7c', '#a29d8d', '#7b776b', '#b0ab9b']
  const ringBlocks = (radius: number, y: number, n: number, h: number, offset: number): void => {
    for (let i = 0; i < n; i++) {
      const a = ((i + offset) / n) * PI * 2
      b.box(
        pick(stones, i * 3 + Math.round(y * 5)),
        1.5 + hash(i + y) * 0.4,
        h,
        0.8,
        [Math.sin(a) * radius, y, Math.cos(a) * radius],
        [0, a, 0],
      )
    }
  }
  ringBlocks(4.6, -0.1, 18, 0.7, 0)
  ringBlocks(4.6, 0.55, 18, 0.6, 0.5)
  ringBlocks(4.5, 1.1, 18, 0.5, 0)
  // Grass top with tufts and a smaller upper terrace
  b.cylinder('#5fae3a', 4.4, 4.4, 0.15, [0, 1.45, 0], [0, 0, 0], 14)
  ringBlocks(2.2, 1.55, 10, 0.5, 0)
  b.cylinder('#6dbb44', 2.1, 2.1, 0.12, [0, 2.0, 0], [0, 0, 0], 12)
  for (const [x, z] of [
    [-1.2, -1.6],
    [1.5, -1.0],
    [3.0, 1.5],
    [-3.1, 1.2],
    [-1.0, 3.2],
  ] as const) {
    b.ball('#3f8f2a', 0.35, [x, 1.65, z], [1, 0.8, 1])
  }
  b.ball('#d63a2f', 0.18, [-0.5, 2.2, 0.4])
  // Stone stair climbing the front
  for (let k = 0; k < 4; k++) {
    b.box(pick(stones, k + 2), 2.2, 0.5 + k * 0.3, 0.7, [0, -0.1, 5.3 - k * 0.6])
  }
  // Fallen slabs
  b.box('#a29d8d', 1.4, 0.3, 0.8, [-4.8, -0.1, 3.4], [0, 0.5, 0])
  b.box('#8f8a7c', 1.0, 0.5, 0.7, [4.9, -0.1, 3.0], [0, -0.4, 0])
}

/** A carnival mask (marimonda long nose or torito horns) at a spot, scaled by `k`. */
function mask(
  b: DecorBuilder,
  x: number,
  y: number,
  z: number,
  k: number,
  face: string,
  accent: string,
  horns: boolean,
): void {
  const matrix = new THREE.Matrix4().makeTranslation(x, y, z).scale(new THREE.Vector3(k, k, k))
  b.place(matrix, () => maskShape(b, 0, 0, 0, face, accent, horns))
}

function maskShape(
  b: DecorBuilder,
  x: number,
  y: number,
  z: number,
  face: string,
  accent: string,
  horns: boolean,
): void {
  b.ball(face, 0.5, [x, y, z], [1, 1.15, 0.6])
  for (const s of [-1, 1]) {
    b.box('#ffffff', 0.2, 0.14, 0.08, [x + s * 0.2, y + 0.05, z + 0.28])
    b.box('#161616', 0.08, 0.08, 0.08, [x + s * 0.2, y + 0.08, z + 0.34])
  }
  b.box('#161616', 0.36, 0.06, 0.06, [x, y - 0.3, z + 0.32])
  if (horns) {
    for (const s of [-1, 1]) {
      b.cylinder('#f4efe0', 0.04, 0.12, 0.7, [x + s * 0.4, y + 0.3, z], [0, 0, -s * 0.9], 6)
    }
    b.cylinder(accent, 0.1, 0.12, 0.2, [x, y + 0.2, z + 0.35], [PI / 2, 0, 0], 6)
  } else {
    b.cylinder(accent, 0.03, 0.14, 0.9, [x, y - 0.1, z + 0.3], [PI / 2 + 0.2, 0, 0], 6)
    for (const s of [-1, 1])
      b.box(accent, 0.12, 0.7, 0.08, [x + s * 0.55, y - 0.2, z], [0, 0, s * 0.2])
    b.cylinder(accent, 0.02, 0.2, 0.5, [x, y + 0.45, z], [0, 0, 0], 6)
  }
}

function carnivalStage(b: DecorBuilder): void {
  const loud = ['#ff2e93', '#ffd23f', '#1ec8e8', '#7ad13a', '#ff7a1a', '#8a3ffc']
  b.box('#5e3a1c', 14.2, 1.5, 5.8, [0, -0.1, 0])
  loud.forEach((c, i) =>
    b.box(c, 14.4 / 6 - 0.02, 1.0, 0.1, [-7 + (i + 0.5) * (14.4 / 6), 0.1, 2.95]),
  )
  b.box('#ffffff', 14.4, 0.12, 6.0, [0, 1.4, 0])
  // Back wall of colorful panels with masks
  for (let k = 0; k < 14; k++) b.box(pick(loud, k), 1.0, 5.6, 0.2, [-6.5 + k, 1.4, -2.7])
  mask(b, -4.2, 4.2, -2.45, 2.2, '#ffd23f', '#e63946', false)
  mask(b, 0, 4.4, -2.45, 2.4, '#ff2e93', '#1ec8e8', true)
  mask(b, 4.2, 4.2, -2.45, 2.2, '#1ec8e8', '#ffd23f', false)
  // Striped columns and roof canopy
  for (const x of [-6.9, 6.9]) {
    for (let k = 0; k < 6; k++)
      b.box(k % 2 === 0 ? '#ff2e93' : '#ffffff', 0.7, 1.0, 0.7, [x, 1.5 + k * 1.0, 2.5])
  }
  b.box('#8a3ffc', 14.8, 0.4, 6.4, [0, 7.0, 0])
  loud.forEach((c, i) =>
    b.box(c, 14.8 / 6 - 0.04, 0.45, 0.5, [-7.4 + (i + 0.5) * (14.8 / 6), 6.7, 3.3]),
  )
  bunting(b, -6.9, 6.9, 6.9, 3.4, 0.5, 22, loud)
  bunting(b, -6.9, 6.9, 6.9, 2.8, 0.9, 14, [...loud].reverse())
  // Dancers: skirts, torsos, heads and plumes
  for (let k = 0; k < 4; k++) {
    const x = -4.5 + k * 3
    b.cylinder(pick(loud, k + 1), 0.25, 0.7, 1.0, [x, 1.5, 0.6], [0, 0, 0], 8)
    b.box(pick(loud, k + 3), 0.45, 0.6, 0.3, [x, 2.5, 0.6])
    b.box(pick(SKINS, k), 0.4, 0.4, 0.4, [x, 3.1, 0.6])
    b.cylinder(pick(loud, k), 0.02, 0.3, 0.9, [x, 3.4, 0.6], [0, 0, 0], 5)
  }
  // Stage lights and a bass drum
  for (const x of [-5.5, 5.5]) b.box('#fff2b0', 0.5, 0.5, 0.5, [x, 5.9, 2.4])
  b.cylinder('#e63946', 0.8, 0.8, 0.9, [-5.9, 1.5, 1.2], [0, 0, 0], 10)
  b.cylinder('#ffd23f', 0.82, 0.82, 0.14, [-5.9, 1.9, 1.2], [0, 0, 0], 10)
}

function maloca(b: DecorBuilder): void {
  // Thatch: three stacked cones, each ring a bit paler than the last
  const tones = ['#b08a3e', '#c9a85a', '#d9bd72']
  b.cylinder('#6b4423', 5.9, 6.0, 0.8, [0, 0, 0], [0, 0, 0], 14)
  tones.forEach((c, i) => {
    const h = 6.2 - i * 1.3
    b.cylinder(c, 0.1, 6.0 - i * 0.5, h, [0, 0.8 + i * 1.3, 0], [0, 0, 0], 14)
  })
  b.cylinder('#8a6a2e', 0.1, 0.4, 1.4, [0, 6.4, 0], [0, 0, 0], 6)
  // Entrance: carved posts, lintel and dark doorway
  b.box('#241509', 1.8, 2.0, 0.6, [0, -0.1, 5.1])
  for (const s of [-1, 1]) {
    b.box(WOOD, 0.35, 2.8, 0.35, [s * 1.2, -0.2, 5.5])
    b.box('#e63946', 0.37, 0.3, 0.37, [s * 1.2, 0.6, 5.5])
    b.box('#161616', 0.37, 0.3, 0.37, [s * 1.2, 1.3, 5.5])
    b.box('#f4efe0', 0.37, 0.3, 0.37, [s * 1.2, 2.0, 5.5])
  }
  b.box(WOOD, 3.2, 0.3, 0.4, [0, 2.6, 5.5])
  b.box('#c9a85a', 3.8, 0.3, 1.8, [0, 2.7, 4.9], [-0.35, 0, 0])
  // Totem, pots and baskets
  b.box(DARK_WOOD, 0.5, 3.4, 0.5, [-3.8, -0.1, 5.2])
  b.box('#e63946', 0.52, 0.5, 0.52, [-3.8, 0.6, 5.2])
  b.box('#f4efe0', 0.52, 0.4, 0.52, [-3.8, 1.5, 5.2])
  b.box('#161616', 0.52, 0.5, 0.52, [-3.8, 2.3, 5.2])
  b.ball('#e0ac84', 0.35, [-3.8, 3.5, 5.2])
  b.ball('#c1562f', 0.4, [3.4, 0.4, 5.2], [1, 1.1, 1])
  b.ball('#a8431f', 0.3, [4.0, 0.3, 5.0], [1, 1.1, 1])
  b.cylinder('#d9bd72', 0.45, 0.3, 0.5, [3.6, 0, 4.5], [0, 0, 0], 8)
  b.ball('#2fb457', 0.3, [3.6, 0.55, 4.5])
  b.ball('#ffb703', 0.22, [3.8, 0.6, 4.7])
}

function corral(b: DecorBuilder): void {
  const radius = 5.3
  const n = 20
  b.cylinder('#c9a56a', 5.2, 5.2, 0.05, [0, 0, 0], [0, 0, 0], 16)
  const gate = new Set([0, 1])
  const post = (i: number): Vec3Tuple => {
    const a = (i / n) * PI * 2
    return [Math.sin(a) * radius, 0, Math.cos(a) * radius]
  }
  for (let i = 0; i < n; i++) {
    const [x, , z] = post(i)
    b.box(DARK_WOOD, 0.3, 2.0 + (hash(i) > 0.5 ? 0.15 : 0), 0.3, [x, -0.1, z])
    if (gate.has(i)) continue
    const [nx, , nz] = post(i + 1)
    const yaw = Math.atan2(nx - x, nz - z)
    const len = Math.hypot(nx - x, nz - z)
    for (const y of [0.4, 0.95, 1.5]) {
      b.box(WOOD, 0.14, 0.2, len + 0.1, [(x + nx) / 2, y, (z + nz) / 2], [0, yaw, 0])
    }
  }
  // Gate at the front: tall posts, a lintel with a sign and the swung doors
  const [gx0, , gz0] = post(0)
  const [gx1, , gz1] = post(1)
  for (const [x, z] of [
    [gx0, gz0],
    [gx1, gz1],
  ] as const) {
    b.box('#3a2412', 0.4, 3.2, 0.4, [x, -0.1, z])
    b.ball('#f2b632', 0.22, [x, 3.2, z])
  }
  b.box(DARK_WOOD, Math.abs(gx1 - gx0) + 0.6, 0.35, 0.3, [(gx0 + gx1) / 2, 3.0, (gz0 + gz1) / 2])
  b.box('#e63946', 1.4, 0.7, 0.12, [(gx0 + gx1) / 2, 3.35, (gz0 + gz1) / 2 + 0.1])
  for (const y of [0.4, 1.0, 1.6]) {
    b.box('#a66a33', 0.12, 0.2, 2.0, [gx1 - 0.2, y, gz1 + 1.0], [0, 0.35, 0])
  }
  b.box('#a66a33', 0.12, 1.4, 0.1, [gx1 - 0.2, 0.4, gz1 + 1.0], [0, 0.35, 0])
  // Water trough, hay and a saddle on the rail
  b.box(WOOD, 2.6, 0.7, 0.8, [-2.0, 0, -3.2], [0, 0.35, 0])
  b.box('#4fa8e6', 2.3, 0.05, 0.55, [-2.0, 0.68, -3.2], [0, 0.35, 0])
  b.box('#e5c35a', 1.1, 0.7, 0.7, [2.3, 0, -3.6], [0, 0.3, 0])
  b.box('#d6b04a', 1.0, 0.6, 0.6, [2.6, 0.7, -3.6], [0, 0.1, 0])
  const [sx, , sz] = post(14)
  b.box('#6b3a1f', 0.7, 0.18, 0.5, [sx * 0.97, 1.7, sz * 0.97], [0, Math.atan2(sx, sz), 0])
  b.box('#8a4a24', 0.3, 0.26, 0.3, [sx * 0.97, 1.88, sz * 0.97], [0, Math.atan2(sx, sz), 0])
  b.box('#c9a56a', 0.12, 0.5, 0.12, [sx * 0.9, 1.1, sz * 0.9])
  b.ball('#e63946', 0.28, [-0.6, 0.15, 0.5], [1.2, 0.4, 1.2])
  b.cylinder('#ffd23f', 0.5, 0.2, 0.18, [1.4, 0.05, 1.0], [0, 0, 0], 8)
}

function observatory(b: DecorBuilder): void {
  b.cylinder('#c1562f', 2.9, 3.0, 0.7, [0, -0.2, 0], [0, 0, 0], 14)
  b.cylinder('#ffffff', 2.4, 2.4, 3.1, [0, 0.4, 0], [0, 0, 0], 14)
  b.cylinder('#ff8c1a', 2.43, 2.43, 0.4, [0, 0.9, 0], [0, 0, 0], 14)
  b.cylinder('#2a6fb0', 2.6, 2.6, 0.25, [0, 3.45, 0], [0, 0, 0], 14)
  // Dome with an open slit and the telescope looking out
  b.dome('#f4f6fa', 2.5, 2.2, [0, 3.65, 0], 14)
  const domeZ = (h: number): number => 2.5 * Math.sqrt(1 - (h / 2.2) ** 2)
  for (let h = 0.15; h < 2.0; h += 0.4) {
    const tiltSlit = Math.atan((domeZ(h) - domeZ(h + 0.4)) / 0.4)
    b.box('#10162b', 0.7, 0.45, 0.1, [0, 3.65 + h, domeZ(h) + 0.02], [-tiltSlit, 0, 0])
  }
  b.cylinder('#cfd6e4', 0.26, 0.34, 2.4, [0, 4.4, 1.3], [PI / 2 - 0.85, 0, 0], 10)
  b.cylinder('#2a3150', 0.28, 0.28, 0.1, [0, 5.4, 2.55], [PI / 2 - 0.85, 0, 0], 10)
  b.box('#c1562f', 2.6, 0.1, 0.1, [0, 5.35, 0], [0, 0, 0])
  // Door, window and steps
  b.box('#2a6fb0', 1.1, 2.0, 0.14, [0, 0.4, 2.4])
  for (const x of [-1.5, 1.5]) {
    b.box('#ff8c1a', 0.8, 0.8, 0.1, [x * 0.9, 1.5, 1.95], [0, x * 0.4, 0])
  }
  for (let k = 0; k < 3; k++) b.box('#d8c9a8', 2.0, 0.22, 0.5, [0, -0.2 + k * 0.22, 3.1 - k * 0.45])
  // Solar panel, antenna and a visitors' telescope on a tripod
  b.box('#1f3d7a', 1.4, 0.08, 0.9, [-3.0, 1.0, 1.8], [-0.7, 0, 0])
  b.box('#555555', 0.08, 1.0, 0.08, [-3.0, 0, 1.6])
  b.box('#cccccc', 0.06, 2.0, 0.06, [2.2, 3.4, -1.6])
  b.ball('#e63946', 0.1, [2.2, 5.5, -1.6])
  for (const a of [0, 2.1, 4.2]) {
    b.box(
      '#444444',
      0.06,
      1.3,
      0.06,
      [3.1 + Math.sin(a) * 0.35, 0, 1.4 + Math.cos(a) * 0.35],
      [Math.cos(a) * 0.2, 0, -Math.sin(a) * 0.2],
    )
  }
  b.cylinder('#f4f6fa', 0.1, 0.14, 1.0, [3.1, 1.2, 1.4], [PI / 2 - 0.6, 0, 0], 8)
  flag(b, -2.8, 0, -1.8, 4.0, '#ffd23f')
}

/** Adds the model of a prop (the caller has already placed the builder at its spot). */
export function addRichProp(b: DecorBuilder, kind: PropKind): void {
  switch (kind) {
    case 'grandstand':
      grandstand(b)
      break
    case 'colonialHouse':
      colonialHouse(b)
      break
    case 'chiva':
      chiva(b)
      break
    case 'boat':
      boat(b)
      break
    case 'mountainHut':
      mountainHut(b)
      break
    case 'saltCross':
      saltCross(b)
      break
    case 'cannon':
      cannon(b)
      break
    case 'beachHut':
      beachHut(b)
      break
    case 'stoneTerrace':
      stoneTerrace(b)
      break
    case 'carnivalStage':
      carnivalStage(b)
      break
    case 'maloca':
      maloca(b)
      break
    case 'corral':
      corral(b)
      break
    case 'observatory':
      observatory(b)
      break
    default:
      break
  }
}
