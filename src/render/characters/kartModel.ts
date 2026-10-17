import { box, cylinder, sphere, torus, type ModelKit } from './modelKit'
import { WHEEL_RADIUS } from './rig'

export interface KartPalette {
  body: string
  accent: string
  /** Seat, steering wheel and trims. */
  dark?: string
}

export type KartStyle = 'classic' | 'leafy' | 'boat' | 'sport'

const TIRE = '#262626'
const METAL = '#9aa0a6'
const WHEEL_X = 0.75
const WHEEL_Z = 0.75
const CHASSIS_Y = 0.45
/** Where the driver's hands grip the steering wheel. */
export const STEERING_WHEEL = { y: 0.98, z: 0.3, radius: 0.17 } as const
/** Bone position of the driver's body (hips on the seat). */
export const SEAT = { y: 0.72, z: -0.3 } as const

/** Adds the kart: chassis, seat, steering wheel, exhausts, spoiler and 4 wheels. */
export function addKart(kit: ModelKit, palette: KartPalette, style: KartStyle = 'classic'): void {
  const { body, accent } = palette
  const dark = palette.dark ?? '#2e2e33'
  kit
    .bone('root', 0, 0, 0)
    .bone('chassis', 0, CHASSIS_Y, 0)
    .bone('steerFL', WHEEL_X, WHEEL_RADIUS, WHEEL_Z)
    .bone('steerFR', -WHEEL_X, WHEEL_RADIUS, WHEEL_Z)
    .bone('wheelFL', WHEEL_X, WHEEL_RADIUS, WHEEL_Z)
    .bone('wheelFR', -WHEEL_X, WHEEL_RADIUS, WHEEL_Z)
    .bone('wheelRL', WHEEL_X, WHEEL_RADIUS, -WHEEL_Z)
    .bone('wheelRR', -WHEEL_X, WHEEL_RADIUS, -WHEEL_Z)

  // Tub, nose and bumper
  kit.add('chassis', box(1.15, 0.32, 1.9), body, { position: [0, 0.48, -0.05] })
  kit.add('chassis', box(0.85, 0.24, 0.7), body, {
    position: [0, 0.44, 1.1],
    rotation: [0.12, 0, 0],
  })
  kit.add('chassis', box(1.25, 0.14, 0.2), accent, { position: [0, 0.36, 1.45] })
  // Side pods
  kit.addMirrored('chassis', 'chassis', box(0.26, 0.26, 1.1), accent, {
    position: [0.62, 0.42, -0.05],
  })
  // Seat
  kit.add('chassis', box(0.7, 0.12, 0.6), dark, { position: [0, 0.66, -0.35] })
  kit.add('chassis', box(0.72, 0.62, 0.14), dark, {
    position: [0, 0.92, -0.72],
    rotation: [-0.15, 0, 0],
  })
  // Steering column and wheel
  kit.add('chassis', cylinder(0.035, 0.035, 0.3, 6), dark, {
    position: [0, 0.86, 0.4],
    rotation: [-0.5, 0, 0],
  })
  kit.add('chassis', torus(STEERING_WHEEL.radius, 0.035, 10), dark, {
    position: [0, STEERING_WHEEL.y, STEERING_WHEEL.z],
    rotation: [-0.5, 0, 0],
  })
  // Engine and exhausts
  kit.add('chassis', box(0.7, 0.3, 0.35), METAL, { position: [0, 0.62, -1.05] })
  kit.addMirrored('chassis', 'chassis', cylinder(0.07, 0.09, 0.4, 8), METAL, {
    position: [0.22, 0.62, -1.3],
    rotation: [Math.PI / 2, 0, 0],
  })

  addStyle(kit, style, body, accent, dark)

  // Wheels with hubcaps
  for (const [bone, x, z] of [
    ['wheelFL', WHEEL_X, WHEEL_Z],
    ['wheelFR', -WHEEL_X, WHEEL_Z],
    ['wheelRL', WHEEL_X, -WHEEL_Z],
    ['wheelRR', -WHEEL_X, -WHEEL_Z],
  ] as const) {
    const width = z < 0 ? 0.36 : 0.28
    const outward = Math.sign(x)
    kit.add(bone, cylinder(WHEEL_RADIUS, WHEEL_RADIUS, width, 12), TIRE, {
      position: [x, WHEEL_RADIUS, z],
      rotation: [0, 0, Math.PI / 2],
    })
    kit.add(bone, cylinder(0.16, 0.16, 0.04, 8), accent, {
      position: [x + outward * (width / 2 + 0.01), WHEEL_RADIUS, z],
      rotation: [0, 0, Math.PI / 2],
    })
  }
}

function addStyle(kit: ModelKit, style: KartStyle, body: string, accent: string, dark: string) {
  switch (style) {
    case 'classic':
    case 'sport': {
      // Rear wing on two struts
      kit.add('chassis', box(1.3, 0.07, 0.34), accent, { position: [0, 1.12, -1.08] })
      kit.addMirrored('chassis', 'chassis', box(0.06, 0.4, 0.12), dark, {
        position: [0.35, 0.9, -1.08],
      })
      if (style === 'sport') {
        // Racing stripe and a low front splitter
        kit.add('chassis', box(0.22, 0.02, 1.9), accent, { position: [0, 0.65, -0.05] })
        kit.add('chassis', box(1.1, 0.04, 0.3), dark, { position: [0, 0.3, 1.45] })
      }
      return
    }
    case 'leafy': {
      // Leaves sprouting from the back and the nose
      for (const [x, tilt] of [
        [0.25, -0.5],
        [-0.25, 0.5],
        [0, 0],
      ] as const) {
        kit.add('chassis', sphere(1, 6), accent, {
          position: [x, 1.15, -1.0],
          rotation: [-0.4, 0, tilt],
          scale: [0.14, 0.35, 0.05],
        })
      }
      kit.add('chassis', sphere(1, 6), accent, {
        position: [0, 0.62, 1.25],
        rotation: [1.1, 0, 0],
        scale: [0.18, 0.3, 0.05],
      })
      return
    }
    case 'boat': {
      // Rounded bow, a life ring and a little fin
      kit.add('chassis', sphere(1, 10), body, {
        position: [0, 0.44, 1.35],
        scale: [0.5, 0.16, 0.35],
      })
      kit.add('chassis', torus(0.2, 0.06, 10), '#ff5a4f', {
        position: [0, 0.92, -1.0],
        rotation: [0.2, 0, 0],
      })
      kit.add('chassis', box(0.06, 0.45, 0.35), accent, {
        position: [0, 1.25, -1.0],
        rotation: [-0.3, 0, 0],
      })
      return
    }
  }
}
