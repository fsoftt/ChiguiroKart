import { headingOf } from '../../sim/math'
import type { Track } from '../../sim/track'
import { DecorBuilder, type Vec3Tuple } from './decorBuilder'
import { chevronSigns, pennantSpots, type PropSpot } from './decorLayout'
import { ATLAS_CELLS } from './proceduralTextures'
import type { TerrainField } from './terrainField'

const PENNANT_COLORS = ['#ffd23f', '#e63946', '#2a9df4', '#2fb457', '#ffffff', '#ff8c1a']
/** Height of the start arch beam above the road (m). */
const ARCH_HEIGHT = 8.8

/** The start/finish arch over the first centerline point, with a checkered banner. */
export function addStartArch(b: DecorBuilder, track: Track): void {
  const start = track.point(0)
  const next = track.point(1)
  const yaw = headingOf(next.x - start.x, next.z - start.z)
  const y = track.groundHeight(start.x, start.z)
  const reach = track.halfWidth + 1.8
  b.place(DecorBuilder.at(start.x, y, start.z, yaw), () => {
    for (const s of [-1, 1]) {
      // Striped columns
      for (let k = 0; k < 6; k++) {
        b.box(k % 2 === 0 ? '#c1272d' : '#ffffff', 1.1, 1.5, 1.1, [s * reach, -0.4 + k * 1.5, 0])
      }
      b.box('#1f2a44', 1.5, 0.5, 1.5, [s * reach, -0.6, 0])
      // Flag pole and flag on top
      b.box('#eeeeee', 0.1, 3, 0.1, [s * reach, ARCH_HEIGHT + 0.6, 0])
      b.triangle(
        s > 0 ? '#ffd23f' : '#2a9df4',
        [s * reach, ARCH_HEIGHT + 3.4, 0],
        [s * reach, ARCH_HEIGHT + 2.2, 0],
        [s * reach + s * 1.8, ARCH_HEIGHT + 2.8, 0],
      )
    }
    const span = (reach + 0.8) * 2
    b.box('#1f2a44', span, 1.5, 1.2, [0, ARCH_HEIGHT - 0.2, 0])
    // Title board on both faces of the beam
    const w = span - 1.2
    const h = w / 8
    const y0 = ARCH_HEIGHT - 0.2 + (1.5 - h) / 2
    b.textured(
      ATLAS_CELLS.title,
      [-w / 2, y0, 0.62],
      [w / 2, y0, 0.62],
      [w / 2, y0 + h, 0.62],
      [-w / 2, y0 + h, 0.62],
    )
    b.textured(
      ATLAS_CELLS.title,
      [w / 2, y0, -0.62],
      [-w / 2, y0, -0.62],
      [-w / 2, y0 + h, -0.62],
      [w / 2, y0 + h, -0.62],
    )
    // Checkered banner hanging under the beam
    const bw = track.halfWidth * 2
    const bh = bw / 8
    const by = ARCH_HEIGHT - 0.2 - bh - 0.1
    b.textured(
      ATLAS_CELLS.finish,
      [-bw / 2, by, 0.1],
      [bw / 2, by, 0.1],
      [bw / 2, by + bh, 0.1],
      [-bw / 2, by + bh, 0.1],
    )
    b.textured(
      ATLAS_CELLS.finish,
      [bw / 2, by, -0.1],
      [-bw / 2, by, -0.1],
      [-bw / 2, by + bh, -0.1],
      [bw / 2, by + bh, -0.1],
    )
  })
}

/** Strings of colored pennants across the road, hung between two poles. */
export function addPennants(b: DecorBuilder, track: Track, count: number): void {
  for (const index of pennantSpots(track, count)) {
    const center = track.point(index)
    const next = track.point(index + 1)
    const yaw = headingOf(next.x - center.x, next.z - center.z)
    const y = track.roadHeight(center.x, center.z)
    const reach = track.halfWidth + 1.8
    const top = 7.2
    b.place(DecorBuilder.at(center.x, y, center.z, yaw), () => {
      for (const s of [-1, 1]) b.box('#7a4a28', 0.28, top + 0.9, 0.28, [s * reach, -0.4, 0])
      const steps = 22
      const point = (t: number): Vec3Tuple => [
        -reach + 2 * reach * t,
        top + 0.5 - 1.5 * (1 - (2 * t - 1) ** 2),
        0,
      ]
      for (let k = 0; k < steps; k++) {
        const p0 = point(k / steps)
        const p1 = point((k + 1) / steps)
        b.triangle('#3a2a1a', p0, p1, [p0[0], p0[1] - 0.05, 0])
        if (k % 2 === 0) {
          const color = PENNANT_COLORS[(k / 2) % PENNANT_COLORS.length] as string
          b.triangle(
            color,
            [p0[0], p0[1], 0],
            [p1[0], p1[1], 0],
            [(p0[0] + p1[0]) / 2, p0[1] - 1.1, 0],
          )
        }
      }
    })
  }
}

/** Chevron signs on the outside of the sharp curves. */
export function addChevrons(b: DecorBuilder, track: Track, field: TerrainField): void {
  for (const sign of chevronSigns(track)) {
    const y = field.heightAt(sign.x, sign.z)
    const mirror = sign.arrow.x * Math.cos(sign.yaw) - sign.arrow.z * Math.sin(sign.yaw) < 0
    b.place(DecorBuilder.at(sign.x, y, sign.z, sign.yaw), () => {
      for (const s of [-0.5, 0.5]) b.box('#e8e8e8', 0.12, 1.2, 0.12, [s, -0.1, -0.08])
      const w = 1.7
      const y0 = 0.9
      b.textured(
        ATLAS_CELLS.chevron,
        [-w / 2, y0, 0],
        [w / 2, y0, 0],
        [w / 2, y0 + w, 0],
        [-w / 2, y0 + w, 0],
        mirror,
      )
    })
  }
}

/** Coffee sacks, wooden carts, yipao jeeps and fincas beside the road. */
export function addProps(b: DecorBuilder, spots: readonly PropSpot[]): void {
  for (const spot of spots) {
    b.place(DecorBuilder.at(spot.x, spot.y, spot.z, spot.yaw), () => {
      switch (spot.kind) {
        case 'finca':
          finca(b)
          break
        case 'yipao':
          yipao(b)
          break
        case 'cart':
          cart(b)
          break
        case 'sacks':
          sacks(b)
          break
      }
    })
  }
}

function finca(b: DecorBuilder): void {
  const wall = '#fbf1da'
  b.box('#d8c9a8', 10.6, 0.7, 7.6, [0, -0.2, 0])
  b.box(wall, 10, 3.1, 7, [0, 0.4, 0])
  b.box('#2b78c2', 10.06, 0.95, 7.06, [0, 0.4, 0])
  b.box('#fff6df', 10, 2.7, 6.6, [0, 3.5, 0])
  // Roof: two slabs and the gable ends
  const rise = 0.5
  for (const s of [-1, 1]) {
    b.box('#b8452e', 11.8, 0.28, 4.2, [0, 6.35 + Math.tan(rise) * 1.6, s * 1.85], [s * rise, 0, 0])
  }
  for (const x of [-5, 5]) {
    b.triangle(wall, [x, 6.2, -3.4], [x, 6.2, 3.4], [x, 6.2 + Math.tan(rise) * 3.4, 0])
  }
  b.box('#8b3a22', 12, 0.3, 0.4, [0, 6.2 + Math.tan(rise) * 3.4 + 0.1, 0])
  b.box('#a0522d', 0.9, 2.2, 0.9, [3.2, 6.6, -1.2])
  // Balcony across the front with a colorful railing
  b.box('#7a4a28', 10.8, 0.22, 1.7, [0, 3.3, 4.2])
  const colors = ['#d63a2f', '#1e8a4c', '#f2b632', '#2b78c2']
  for (let k = 0; k <= 20; k++) {
    b.box(colors[k % colors.length] as string, 0.1, 0.95, 0.1, [-5.2 + k * 0.52, 3.52, 4.95])
  }
  b.box('#d63a2f', 10.8, 0.12, 0.16, [0, 4.47, 4.95])
  for (const x of [-5, -2.5, 0, 2.5, 5]) {
    b.box('#7a4a28', 0.24, 3.4, 0.24, [x, -0.1, 4.95])
    b.ball(x % 5 === 0 ? '#ff5fa2' : '#ffd23f', 0.28, [x + 0.9, 4.75, 4.95], [1, 0.7, 1])
  }
  // Doors and windows
  b.box('#1e8a4c', 1.4, 2.3, 0.12, [0, 0.4, 3.55])
  for (const x of [-3.4, 3.4]) {
    b.box('#d63a2f', 1.7, 1.5, 0.1, [x, 1.0, 3.53])
    b.box('#5fb4e6', 1.3, 1.1, 0.12, [x, 1.2, 3.56])
  }
  for (const x of [-3.6, -1.2, 1.2, 3.6]) {
    b.box('#1e8a4c', 1.6, 1.6, 0.1, [x, 3.9, 3.33])
    b.box('#5fb4e6', 1.2, 1.2, 0.12, [x, 4.1, 3.36])
  }
}

function yipao(b: DecorBuilder): void {
  const body = '#e63946'
  const trim = '#ffd23f'
  b.box('#222222', 1.5, 0.3, 3.3, [0, 0.35, 0])
  b.box(body, 1.7, 0.7, 3.0, [0, 0.55, 0])
  b.box(body, 1.5, 0.5, 1.0, [0, 1.25, 1.2])
  b.box(trim, 1.72, 0.12, 3.0, [0, 0.85, 0])
  for (const s of [-1, 1]) {
    b.box(body, 0.3, 0.15, 1.0, [s * 0.75, 0.95, 1.1])
    b.box(body, 0.3, 0.15, 1.0, [s * 0.75, 0.95, -1.1])
    b.box('#222222', 0.06, 0.8, 0.06, [s * 0.7, 1.25, 0.55])
    b.ball('#fff2b0', 0.15, [s * 0.55, 1.1, 1.72])
  }
  b.box('#222222', 1.5, 0.06, 0.06, [0, 2.0, 0.55])
  b.box('#6b3a1f', 1.3, 0.45, 0.55, [0, 1.15, -0.1])
  b.box('#bbbbbb', 1.8, 0.14, 0.14, [0, 0.4, 1.72])
  // Rear bed: wooden rails and a load of sacks and fruit crates
  for (const s of [-1, 1]) {
    b.box('#8d5524', 0.07, 0.5, 1.9, [s * 0.82, 1.1, -0.9])
  }
  b.box('#8d5524', 1.6, 0.5, 0.07, [0, 1.1, -1.85])
  for (const [x, z] of [
    [-0.4, -0.7],
    [0.4, -0.7],
    [-0.4, -1.4],
    [0.4, -1.4],
  ] as const) {
    b.ball('#d2b27a', 0.38, [x, 1.5, z], [1, 0.8, 0.9])
  }
  b.ball('#c49a5e', 0.36, [0, 2.0, -1.0], [1, 0.8, 0.9])
  b.ball('#2fb457', 0.3, [0.45, 2.0, -1.5])
  b.ball('#ffb703', 0.28, [-0.45, 2.0, -1.55])
  // Spare tire and wheels
  b.cylinder('#161616', 0.36, 0.36, 0.28, [0, 0.75, -1.95], [Math.PI / 2, 0, 0], 10)
  for (const s of [-1, 1]) {
    for (const z of [-1.0, 1.1]) {
      b.cylinder('#161616', 0.4, 0.4, 0.32, [s * 0.85 - s * 0.16, 0.4, z], [0, 0, Math.PI / 2], 10)
      b.cylinder('#e8e0cc', 0.2, 0.2, 0.36, [s * 0.85 - s * 0.18, 0.4, z], [0, 0, Math.PI / 2], 8)
    }
  }
}

function cart(b: DecorBuilder): void {
  b.box('#8d5524', 2.2, 0.14, 1.5, [0, 0.75, 0])
  for (const s of [-1, 1]) {
    b.box('#a66a33', 0.1, 0.5, 1.5, [s * 1.05, 0.85, 0])
  }
  b.box('#a66a33', 2.2, 0.5, 0.1, [0, 0.85, -0.7])
  b.box('#a66a33', 2.2, 0.5, 0.1, [0, 0.85, 0.7])
  for (const s of [-1, 1]) {
    b.cylinder('#6b4423', 0.62, 0.62, 0.12, [s * 1.2, 0.62, 0], [0, 0, Math.PI / 2], 12)
    b.cylinder('#3a2412', 0.12, 0.12, 0.2, [s * 1.2, 0.62, 0], [0, 0, Math.PI / 2], 8)
    b.box('#3a2412', 0.06, 1.2, 0.1, [s * 1.26, 0.05, 0])
    b.box('#3a2412', 0.06, 0.1, 1.2, [s * 1.26, 0.57, -0.6])
  }
  for (const s of [-1, 1]) {
    b.box('#6b4423', 0.1, 0.1, 2.4, [s * 0.5, 0.5, 1.9], [-0.25, 0, 0])
  }
  b.ball('#e5c35a', 0.55, [0.2, 1.2, 0.1], [1.5, 0.8, 1])
  b.ball('#d2b27a', 0.34, [-0.6, 1.2, -0.2], [1, 0.8, 0.9])
}

function sacks(b: DecorBuilder): void {
  const tones = ['#d2b27a', '#c49a5e', '#dcc08a']
  const rows: readonly (readonly [number, number, number])[] = [
    [-0.7, 0, 0],
    [0, 0, 0.1],
    [0.7, 0, 0],
    [-0.35, 0.55, 0.05],
    [0.35, 0.55, 0],
    [0, 1.05, 0.05],
  ]
  rows.forEach(([x, y, z], i) => {
    b.ball(tones[i % tones.length] as string, 0.4, [x, 0.34 + y, z], [1, 0.85, 0.8])
    b.box('#8d5524', 0.14, 0.12, 0.14, [x, 0.62 + y, z])
  })
}
