import * as THREE from 'three'
import { gripPoint, PEDALS, STEERING_WHEEL } from './kartModel'
import { dome, roundedBox, sphere, tube, type ModelKit, type Vec3 } from './modelKit'

/** Shared building blocks of the expressive cartoon pilots: eyes, brows, hands and legs. */

const WHITE = '#fbfbf7'
const BLACK = '#17151a'

export interface EyeOptions {
  /** Eyeball center on the left side (+x); the right eye mirrors it. */
  center: Vec3
  radius: number
  /** Gaze direction: yaw turns the eyes outward (rad), pitch tilts them down. */
  yaw: number
  pitch?: number
  iris: string
  /** Eyelid skin color. */
  lid: string
  /**
   * Resting angle of the eyelids: 0 covers the upper half of the eye, negative opens it more
   * (-0.9 is wide open) and positive closes it (the `lidL`/`lidR` clips move it from there).
   */
  lidRest: number
  /** Brow color; without it no brow is drawn. */
  brow?: string
  /** Brow thickness multiplier. */
  browSize?: number
  /** Resting brow tilt (rad): negative raises the inner ends (a friendly, worried look). */
  browTilt?: number
  /** Draw a separate black pupil on the iris (default true). */
  pupil?: boolean
  /** Number of white highlights, 1 or 2 (default 2). */
  highlights?: 1 | 2
  /** Fur cushion under the eye (default true); off for eyes that sit on the skull. */
  cushion?: boolean
  /** Brow height over the eye (1 default). */
  browLift?: number
  /** Iris size relative to the eyeball (0.6 default). */
  irisSize?: number
}

/** World position of a point given in an eye's local frame (z = gaze, y = up). */
function eyePoint(o: EyeOptions, side: 1 | -1, local: Vec3): Vec3 {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(o.center[0] * side, o.center[1], o.center[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(o.pitch ?? 0, o.yaw * side, 0)),
    new THREE.Vector3(1, 1, 1),
  )
  const p = new THREE.Vector3(...local).applyMatrix4(m)
  return [p.x, p.y, p.z]
}

/** Both eyes: sclera, iris, pupil, two highlights, an eyelid on its own bone and a brow. */
export function addEyes(kit: ModelKit, o: EyeOptions): void {
  const r = o.radius
  const irisSize = o.irisSize ?? 0.62
  for (const side of [1, -1] as const) {
    const lidBone = side === 1 ? 'lidL' : 'lidR'
    const browBone = side === 1 ? 'browL' : 'browR'
    const [cx, cy, cz] = eyePoint(o, side, [0, 0, 0])
    const browAt = eyePoint(o, side, [0, r * 1.12 * (o.browLift ?? 1), r * 0.15])
    kit.bone(lidBone, cx, cy, cz)
    kit.bone(browBone, ...browAt)
    kit.frame({ position: [cx, cy, cz], rotation: [o.pitch ?? 0, o.yaw * side, 0] }, () => {
      // Fur cushion under the eye so it sits on a socket instead of sinking into the head
      if (o.cushion !== false) {
        kit.add('head', sphere(r * 1.12, 6), o.lid, { position: [0, -r * 0.45, -r * 0.4] })
      }
      kit.add('head', sphere(r, 12), WHITE)
      kit.add('head', sphere(r * irisSize, 10), o.iris, {
        position: [0, 0, r * 0.8],
        scale: [1, 1, 0.45],
      })
      if (o.pupil !== false) {
        kit.add('head', sphere(r * irisSize * 0.55, 8), BLACK, {
          position: [0, 0, r * 0.8 + r * irisSize * 0.12],
          scale: [1, 1, 0.45],
        })
      }
      // Two specular highlights
      kit.add('head', sphere(r * 0.2, 6), WHITE, {
        position: [r * 0.24, r * 0.27, r * 1.0],
        scale: [1, 1, 0.5],
      })
      if (o.highlights !== 1) {
        kit.add('head', sphere(r * 0.1, 5), WHITE, {
          position: [-r * 0.2, -r * 0.24, r * 1.02],
          scale: [1, 1, 0.5],
        })
      }
      kit.add(lidBone, dome(r * 1.1, 1.75, 12), o.lid, { rotation: [o.lidRest, 0, 0] })
    })
    // Brow: a soft arch whose inner end is toward the nose
    const browColor = o.brow
    if (!browColor) continue
    const size = o.browSize ?? 1
    kit.frame(
      {
        position: browAt,
        rotation: [(o.pitch ?? 0) - 0.15, o.yaw * side, (o.browTilt ?? 0) * side],
      },
      () => {
        kit.add(
          browBone,
          tube(
            [
              [-r * 0.85, -r * 0.05, 0],
              [0, r * 0.12, 0],
              [r * 0.85, -r * 0.1, 0],
            ],
            [0.02 * size, 0.034 * size, 0.022 * size],
            6,
            4,
            1,
            2,
          ),
          browColor,
        )
      },
    )
  }
}

export interface HandOptions {
  /** Color of the paw (the arm uses `skin`). */
  hand: string
  /** Optional color of the fingertips (claws). */
  claw?: string
  size?: number
}

/** A big mitten fist gripping the steering wheel rim at `angle` rad from the top. */
export function addHand(
  kit: ModelKit,
  bone: 'armL' | 'armR',
  side: 1 | -1,
  { hand, claw, size = 1 }: HandOptions,
  angle = Math.PI / 3,
): void {
  const { y, z, radius, tilt } = STEERING_WHEEL
  kit.frame({ position: [0, y, z], rotation: [tilt, 0, 0] }, () => {
    kit.frame(
      {
        position: [side * Math.sin(angle) * radius, Math.cos(angle) * radius, 0],
        rotation: [0, 0, -side * angle],
      },
      () => {
        const s = size
        // A smooth mitten whose long side runs along the rim, a lobe of fingers in front and a thumb on top
        kit.add(bone, sphere(0.1 * s, 10), hand, {
          position: [0, 0, -0.015 * s],
          scale: [1.5, 0.95, 0.95],
        })
        kit.add(bone, sphere(0.085 * s, 8), hand, {
          position: [0, -0.012 * s, 0.055 * s],
          scale: [1.55, 0.8, 0.75],
        })
        kit.add(bone, sphere(0.05 * s, 6), hand, {
          position: [-side * 0.02 * s, 0.075 * s, -0.01 * s],
          scale: [1.5, 0.95, 0.95],
        })
        if (claw) {
          for (let i = -1; i <= 1; i++) {
            kit.add(bone, sphere(0.02 * s, 6), claw, {
              position: [i * 0.07 * s, -0.03 * s, 0.1 * s],
              scale: [1, 1.2, 1],
            })
          }
        }
      },
    )
  })
}

/** Where the wrist meets the hand on the wheel (the arm tube ends here). */
export function wristPoint(side: 1 | -1): Vec3 {
  const [x, y, z] = gripPoint(side)
  return [x, y - 0.02, z - 0.07]
}

export interface ArmOptions {
  shoulder: Vec3
  /** Elbow bulge: how far the elbow sticks out sideways and down. */
  elbow: Vec3
  radii: readonly [number, number, number]
  skin: string
}

/** A bent arm from the shoulder to the steering wheel; the bone sits at the shoulder. */
export function addArms(kit: ModelKit, o: ArmOptions & HandOptions): void {
  const [sx, sy, sz] = o.shoulder
  kit.bone('armL', sx, sy, sz).bone('armR', -sx, sy, sz)
  for (const side of [1, -1] as const) {
    const bone = side === 1 ? 'armL' : 'armR'
    const wrist = wristPoint(side)
    kit.add(
      bone,
      tube(
        [[sx * side, sy, sz], [o.elbow[0] * side, o.elbow[1], o.elbow[2]], wrist],
        o.radii,
        8,
        6,
        1,
        2,
      ),
      o.skin,
    )
    addHand(kit, bone, side, o)
  }
}

export interface LegOptions {
  skin: string
  shoe: string
  sole: string
  radius: number
  /** Hip x (half the distance between the legs). */
  hip: number
}

/**
 * Legs from the seat to the pedals. They blend from the body bone (hips) to the chassis (feet)
 * so the driver stays on the pedals while the torso dances.
 */
export function addLegs(kit: ModelKit, { skin, shoe, sole, radius, hip }: LegOptions): void {
  const blend = {
    bone: 'chassis' as const,
    weight: (p: THREE.Vector3) => THREE.MathUtils.smoothstep(p.z, -0.1, 0.5),
  }
  for (const side of [1, -1] as const) {
    kit.add(
      'body',
      tube(
        [
          [hip * side, 0.86, -0.38],
          [(hip + 0.08) * side, 1.02, 0.08],
          [PEDALS.x * side, PEDALS.y + 0.02, PEDALS.z - 0.04],
        ],
        [radius * 1.15, radius, radius * 0.8],
        8,
        6,
        1,
        2,
      ),
      skin,
      {},
      blend,
    )
    // Big rounded shoe on the pedal
    kit.add('chassis', sphere(1, 8), shoe, {
      position: [PEDALS.x * side, PEDALS.y - 0.01, PEDALS.z + 0.06],
      rotation: [-0.35, 0, 0],
      scale: [radius * 1.35, radius * 1.0, radius * 2.1],
    })
    // White sole and toe cap
    kit.add('chassis', sphere(1, 6), sole, {
      position: [PEDALS.x * side, PEDALS.y - 0.075, PEDALS.z + 0.07],
      rotation: [-0.35, 0, 0],
      scale: [radius * 1.4, radius * 0.4, radius * 2.15],
    })
  }
}

/** A cartoon mouth: dark cavity on the head, lower jaw on the `jaw` bone, two optional teeth. */
export interface MouthOptions {
  jawColor: string
  inside?: string
  /** Hinge of the jaw. */
  hinge: Vec3
  /** Center of the lower jaw ellipsoid and its radii. */
  jaw: Vec3
  jawSize: Vec3
  /** Dark mouth cavity visible when the jaw opens. */
  cavity: Vec3
  cavitySize: Vec3
  teeth?: { position: Vec3; width: number; color?: string }
  tongue?: boolean
}

export function addMouth(kit: ModelKit, o: MouthOptions): void {
  kit.bone('jaw', ...o.hinge)
  kit.add('head', sphere(1, 10), o.inside ?? '#4a1d2a', { position: o.cavity, scale: o.cavitySize })
  kit.add('jaw', sphere(1, 10), o.jawColor, { position: o.jaw, scale: o.jawSize })
  kit.add('jaw', sphere(1, 10), o.inside ?? '#4a1d2a', {
    position: [o.jaw[0], o.jaw[1] + o.jawSize[1] * 0.55, o.jaw[2]],
    scale: [o.jawSize[0] * 0.8, o.jawSize[1] * 0.6, o.jawSize[2] * 0.85],
  })
  if (o.tongue) {
    kit.add('jaw', sphere(1, 8), '#ee7f93', {
      position: [o.jaw[0], o.jaw[1] + o.jawSize[1] * 0.55, o.jaw[2] - 0.02],
      scale: [o.jawSize[0] * 0.55, o.jawSize[1] * 0.35, o.jawSize[2] * 0.6],
    })
  }
  if (o.teeth) {
    const { position, width, color = WHITE } = o.teeth
    for (const side of [1, -1] as const) {
      kit.add('head', roundedBox(width, width * 1.45, width * 0.55, width * 0.22), color, {
        position: [position[0] + side * width * 0.56, position[1], position[2]],
      })
    }
  }
}
