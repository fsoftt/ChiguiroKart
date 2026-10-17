import { SEAT } from './kartModel'
import { addArms, addEyes, addLegs, addMouth } from './characterParts'
import * as THREE from 'three'
import { gradient, sphere, tube, type ModelKit, type Vec3 } from './modelKit'

/** Pilots built to the "hero" art standard: smooth shapes, big expressive faces, big hands. */

const BLACK = '#17151a'

/** Head ellipsoid (model space) the spectacles are projected onto, grown a hair so they lie on top. */
const HEAD = { center: [0, 1.67, -0.08], radii: [0.45, 0.42, 0.52] } as const

/** Grid of (x, y) points projected onto the front of the head, as a thin conforming sheet. */
function projectedSheet(
  columns: number,
  rows: number,
  at: (u: number, v: number) => [number, number],
): THREE.BufferGeometry {
  const grow = 1.012
  const [, cy, cz] = HEAD.center
  const rx = HEAD.radii[0] * grow
  const ry = HEAD.radii[1] * grow
  const rz = HEAD.radii[2] * grow
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= columns; i++) {
      const [x, y] = at(i / columns, j / rows)
      const nx = x / rx
      const ny = (y - cy) / ry
      const nz = Math.sqrt(Math.max(1 - nx * nx - ny * ny, 0.01))
      positions.push(x, y, cz + rz * nz)
      const n = new THREE.Vector3(nx / rx, ny / ry, nz / rz).normalize()
      normals.push(n.x, n.y, n.z)
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      const a = j * (columns + 1) + i
      const b = a + 1
      const c = a + columns + 1
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  g.setIndex(indices)
  return g
}

/** Smooth analytic spectacles: a ring around each eye and a bridge joining them. */
function spectacles(eyeX: number, eyeY: number): THREE.BufferGeometry[] {
  const inner = 0.1
  const outer = 0.175
  const sheets: THREE.BufferGeometry[] = []
  for (const side of [1, -1] as const) {
    sheets.push(
      projectedSheet(48, 1, (u, v) => {
        const angle = u * Math.PI * 2
        const r = inner + (outer - inner) * v
        return [side * eyeX + Math.cos(angle) * r, eyeY + (Math.sin(angle) * r) / 1.1]
      }),
    )
  }
  sheets.push(
    projectedSheet(8, 1, (u, v) => [
      -(eyeX - inner + 0.02) + u * 2 * (eyeX - inner + 0.02),
      eyeY + 0.027 - v * 0.044,
    ]),
  )
  return sheets
}

/** Spectacled bear: round head, cream spectacles, chunky body and a wide friendly grin. */
export function osoDriver(kit: ModelKit): void {
  const fur = '#34292a'
  const furLight = '#4a3b3a'
  const cream = '#f0dcab'
  const tan = '#d3b27c'
  kit
    .bone('body', 0, SEAT.y, SEAT.z)
    .bone('head', 0, 1.42, -0.2)
    .bone('earL', 0.36, 1.96, -0.2)
    .bone('earR', -0.36, 1.96, -0.2)
    .bone('tail', 0, 0.85, -0.65)

  // Chunky torso with a cream bib
  kit.add('body', sphere(1, 12), gradient('y', 0.72, 1.4, furLight, fur), {
    position: [0, 1.0, -0.38],
    scale: [0.46, 0.42, 0.42],
  })
  kit.add('body', sphere(1, 10), cream, {
    position: [0, 1.02, -0.0],
    scale: [0.28, 0.3, 0.14],
  })
  addLegs(kit, { skin: fur, shoe: '#efe6d0', sole: '#7a4a2b', radius: 0.12, hip: 0.2 })
  addArms(kit, {
    shoulder: [0.4, 1.18, -0.3],
    elbow: [0.52, 1.0, -0.02],
    radii: [0.14, 0.13, 0.11],
    skin: fur,
    hand: '#4a3b3a',
    size: 1.4,
  })

  // One smooth round head with the cream spectacles as a thin decal shell lying on it
  const eyeX = 0.23
  const eyeY = 1.76
  // The sphere's pole points at the face
  kit.add('head', sphere(1, 24), gradient('y', 1.3, 2.0, furLight, fur), {
    position: [0, 1.67, -0.08],
    rotation: [Math.PI / 2, 0, 0],
    scale: [0.45, 0.52, 0.42],
  })
  for (const sheet of spectacles(eyeX, eyeY)) kit.add('head', sheet, cream)
  // One smooth cream muzzle blended into the head, and the nose
  kit.add('head', sphere(1, 16), cream, { position: [0, 1.52, 0.3], scale: [0.25, 0.2, 0.25] })
  kit.add('head', sphere(1, 12), BLACK, { position: [0, 1.59, 0.54], scale: [0.11, 0.075, 0.07] })
  addMouth(kit, {
    jawColor: cream,
    hinge: [0, 1.5, 0.0],
    jaw: [0, 1.42, 0.34],
    jawSize: [0.24, 0.1, 0.22],
    cavity: [0, 1.45, 0.52],
    cavitySize: [0.1, 0.03, 0.06],
    tongue: true,
  })
  // Friendly grin across the muzzle
  const grin: Vec3[] = []
  for (let i = 0; i <= 8; i++) {
    const x = ((i - 4) / 4) * 0.19
    const y = 1.415 + 0.07 * (x / 0.19) ** 2
    const inside = 1 - (x / 0.25) ** 2 - ((y - 1.5) / 0.2) ** 2
    grin.push([x, y, 0.34 + 0.22 * Math.sqrt(Math.max(inside, 0.01)) + 0.004])
  }
  kit.add('head', tube(grin, [0.014], 6, 16), '#2a1418')
  addEyes(kit, {
    // Flush with the head: the eyeball is sunk so only its front barely breaks the surface
    center: [0.19, 1.742, 0.295],
    radius: 0.1,
    yaw: 0.63,
    pitch: -0.26,
    iris: '#20150f',
    irisSize: 0.66,
    pupil: false,
    highlights: 1,
    cushion: false,
    lid: fur,
    lidRest: -1.75,
  })
  // Round ears
  for (const side of [1, -1] as const) {
    const bone = side === 1 ? 'earL' : 'earR'
    kit.add(bone, sphere(1, 10), fur, {
      position: [side * 0.37, 1.97, -0.2],
      scale: [0.14, 0.14, 0.08],
    })
    kit.add(bone, sphere(1, 8), tan, {
      position: [side * 0.37, 1.97, -0.14],
      scale: [0.085, 0.085, 0.04],
    })
  }
}
