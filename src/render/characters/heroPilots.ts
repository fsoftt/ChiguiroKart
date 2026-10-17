import { SEAT } from './kartModel'
import { addArms, addEyes, addLegs, addMouth } from './characterParts'
import { gradient, loft, sphere, torus, tube, type ModelKit, type Vec3 } from './modelKit'

/** Pilots built to the "hero" art standard: smooth shapes, big expressive faces, big hands. */

const BLACK = '#17151a'

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

  // Round head with a short muzzle
  kit.add(
    'head',
    loft(
      [
        { z: -0.46, w: 0.6, h: 0.6, y: 1.66 },
        { z: -0.24, w: 0.9, h: 0.84, y: 1.68, n: 2.1 },
        { z: 0.04, w: 0.9, h: 0.84, y: 1.67, n: 2.1 },
        { z: 0.26, w: 0.74, h: 0.68, y: 1.62, n: 2.2 },
      ],
      22,
      0.2,
      0.2,
    ),
    gradient('y', 1.3, 2.0, furLight, fur),
  )
  // Muzzle, nose and spectacles
  kit.add('head', sphere(1, 12), cream, { position: [0, 1.5, 0.34], scale: [0.25, 0.2, 0.22] })
  kit.add('head', sphere(1, 12), BLACK, { position: [0, 1.58, 0.54], scale: [0.11, 0.075, 0.07] })
  for (const side of [1, -1] as const) {
    kit.frame({ position: [side * 0.25, 1.75, 0.3], rotation: [0.05, side * 0.5, 0] }, () => {
      kit.add('head', torus(0.185, 0.045, 18, 6), cream)
    })
  }
  kit.add(
    'head',
    tube(
      [
        [0.1, 1.76, 0.44],
        [0, 1.8, 0.47],
        [-0.1, 1.76, 0.44],
      ],
      [0.04],
      8,
      8,
    ),
    cream,
  )
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
    center: [0.25, 1.78, 0.32],
    radius: 0.14,
    yaw: 0.35,
    pitch: 0.0,
    iris: '#5a3216',
    irisSize: 0.58,
    lid: fur,
    lidRest: -1.0,
    browLift: 1.35,
    browTilt: -0.18,
    brow: tan,
    browSize: 1.1,
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
