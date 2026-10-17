import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  box,
  cylinder,
  dome,
  gradient,
  lathe,
  loft,
  roundedBox,
  sphere,
  sweep,
  torus,
  tube,
  type ModelKit,
  type Ring,
  type Vec3,
} from './modelKit'
import { WHEEL_RADIUS } from './rig'

export interface KartPalette {
  body: string
  accent: string
  /** Seat, steering wheel and trims. */
  dark?: string
  /** Race number painted on the hood. */
  number?: number
}

export type KartStyle = 'classic' | 'leafy' | 'boat' | 'sport' | 'heavy'

const TIRE = '#2a2a30'
const TIRE_SIDE = '#3b3b44'
const CHROME = '#b7c1cf'
const CHROME_SHADE = '#5f6a7a'
const WHEEL_X = 0.75
const WHEEL_Z = 0.75
const CHASSIS_Y = 0.45
/** Where the driver's hands grip the steering wheel (the wheel is tilted back by `tilt`). */
export const STEERING_WHEEL = { y: 1.0, z: 0.34, radius: 0.22, tilt: -0.5 } as const
/** Bone position of the driver's body (hips on the seat). */
export const SEAT = { y: 0.72, z: -0.3 } as const
/** Where the feet rest (pedals), per side. */
export const PEDALS = { x: 0.2, y: 0.76, z: 0.5 } as const

/** Point of the steering wheel rim at "10 o'clock" (side 1, left) or "2 o'clock" (side -1). */
export function gripPoint(side: 1 | -1, angle = Math.PI / 3): Vec3 {
  const { y, z, radius, tilt } = STEERING_WHEEL
  const local = new THREE.Vector3(side * Math.sin(angle) * radius, Math.cos(angle) * radius, 0)
  local.applyAxisAngle(new THREE.Vector3(1, 0, 0), tilt)
  return [local.x, y + local.y, z + local.z]
}

/** Per-style proportions of the shared kart. */
interface Build {
  frontWidth: number
  rearWidth: number
  bumper: number
}

const builds: Record<KartStyle, Build> = {
  classic: { frontWidth: 0.3, rearWidth: 0.4, bumper: 0.065 },
  sport: { frontWidth: 0.3, rearWidth: 0.4, bumper: 0.055 },
  leafy: { frontWidth: 0.3, rearWidth: 0.38, bumper: 0.06 },
  boat: { frontWidth: 0.3, rearWidth: 0.38, bumper: 0.06 },
  heavy: { frontWidth: 0.36, rearWidth: 0.46, bumper: 0.09 },
}

const shade = (hex: string, factor: number): string =>
  `#${new THREE.Color(hex).multiplyScalar(factor).getHexString()}`

/** Chunky tire: a rounded lathe whose outer rim is raised into lugs. */
function tireGeometry(width: number, lugs: number): THREE.BufferGeometry {
  const r = WHEEL_RADIUS
  const w = width / 2
  const profile: [number, number][] = [
    [0.19, -w],
    [r - 0.05, -w],
    [r - 0.005, -w * 0.55],
    [r - 0.005, w * 0.55],
    [r - 0.05, w],
    [0.19, w],
  ]
  const g = new THREE.LatheGeometry(
    profile.map(([radius, y]) => new THREE.Vector2(radius, y)),
    20,
  )
  g.deleteAttribute('uv')
  g.deleteAttribute('normal')
  const position = g.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const z = position.getZ(i)
    const radius = Math.hypot(x, z)
    if (radius < r - 0.06) continue
    const reach = THREE.MathUtils.clamp((radius - (r - 0.06)) / 0.055, 0, 1)
    const angle = Math.atan2(z, x)
    // Square-ish wave: lugs with flat tops and gaps in between
    const lug = THREE.MathUtils.clamp(Math.cos(angle * lugs) * 3 + 0.5, 0, 1)
    const scale = (radius + 0.04 * lug * reach) / radius
    position.setXYZ(i, x * scale, position.getY(i), z * scale)
  }
  const merged = mergeVertices(g, 1e-4)
  merged.computeVertexNormals()
  return merged
}

/** Curved sheet over a wheel (a fender), swept along an arc in the YZ plane. */
function fenderGeometry(center: Vec3, width: number, side: 1 | -1): THREE.BufferGeometry {
  const rings: Ring[] = []
  const steps = 6
  const radius = WHEEL_RADIUS + 0.1
  for (let i = 0; i <= steps; i++) {
    const angle = 0.5 + (i / steps) * (Math.PI - 1.0)
    const dir = new THREE.Vector3(0, Math.sin(angle), Math.cos(angle))
    rings.push({
      center: new THREE.Vector3(...center).addScaledVector(dir, radius),
      u: dir,
      v: new THREE.Vector3(side, 0, 0),
      a: 0.04 + 0.01 * Math.sin((i / steps) * Math.PI),
      b: width / 2,
      n: 3,
    })
  }
  return sweep(rings, 6, 0.06, 0.06, 1)
}

/** Adds the kart: body, fenders, seat, steering wheel, engine, exhausts, spoiler and 4 wheels. */
export function addKart(kit: ModelKit, palette: KartPalette, style: KartStyle = 'classic'): void {
  const { body, accent } = palette
  const dark = palette.dark ?? '#2e2e33'
  const build = builds[style]
  kit
    .bone('root', 0, 0, 0)
    .bone('chassis', 0, CHASSIS_Y, 0)
    .bone('steerFL', WHEEL_X, WHEEL_RADIUS, WHEEL_Z)
    .bone('steerFR', -WHEEL_X, WHEEL_RADIUS, WHEEL_Z)
    .bone('wheelFL', WHEEL_X, WHEEL_RADIUS, WHEEL_Z)
    .bone('wheelFR', -WHEEL_X, WHEEL_RADIUS, WHEEL_Z)
    .bone('wheelRL', WHEEL_X, WHEEL_RADIUS, -WHEEL_Z)
    .bone('wheelRR', -WHEEL_X, WHEEL_RADIUS, -WHEEL_Z)

  const bodyPaint = gradient('y', 0.3, 0.75, shade(body, 0.72), body)

  // Tub with a rounded nose, a hood bulge and a dark cockpit
  kit.add(
    'chassis',
    loft(
      [
        { z: -1.05, w: 0.86, h: 0.34, y: 0.5, n: 2.6 },
        { z: -0.6, w: 1.02, h: 0.4, y: 0.51, n: 2.8 },
        { z: -0.15, w: 1.2, h: 0.42, y: 0.52, n: 3 },
        { z: 0.35, w: 1.2, h: 0.42, y: 0.52, n: 3 },
        { z: 0.75, w: 0.98, h: 0.38, y: 0.5, n: 2.8 },
        { z: 1.1, w: 0.78, h: 0.32, y: 0.49, n: 2.5 },
      ],
      16,
      0.34,
      0.2,
      2,
    ),
    bodyPaint,
  )
  kit.add('chassis', sphere(1, 10), shade(body, 1.08), {
    position: [0, 0.66, 1.0],
    scale: [0.3, 0.1, 0.4],
  })
  kit.add('chassis', box(0.8, 0.1, 0.9), dark, { position: [0, 0.71, -0.4] })
  // Headlights and a grille slot on the nose
  for (const side of [1, -1] as const) {
    kit.frame({ position: [side * 0.25, 0.57, 1.27], rotation: [0.1, side * 0.45, 0] }, () => {
      kit.add('chassis', sphere(0.11, 6), '#ffe27a', { scale: [1, 1, 0.55] })
    })
  }

  // Bumper
  const bumperPoints: Vec3[] = [
    [-0.5, 0.38, 0.92],
    [-0.38, 0.36, 1.22],
    [0, 0.35, 1.5],
    [0.38, 0.36, 1.22],
    [0.5, 0.38, 0.92],
  ]
  kit.add('chassis', tube(bumperPoints, [build.bumper], 8, 10), accent)
  if (style === 'heavy') {
    // Bull bar posts
    kit.addMirrored('chassis', 'chassis', roundedBox(0.08, 0.22, 0.08, 0.035), CHROME, {
      position: [0.3, 0.46, 1.36],
    })
  }

  // Side pods with vents
  for (const side of [1, -1] as const) {
    kit.add('chassis', sphere(1, 10), accent, {
      position: [side * 0.64, 0.44, 0.0],
      scale: [0.15, 0.17, 0.52],
    })
    for (const z of [-0.4, -0.32, -0.24]) {
      kit.add('chassis', box(0.03, 0.1, 0.05), dark, {
        position: [side * 0.775, 0.45, z],
      })
    }
  }

  // Bucket seat
  kit.add('chassis', roundedBox(0.66, 0.16, 0.6, 0.07), dark, { position: [0, 0.68, -0.35] })
  kit.add('chassis', roundedBox(0.7, 0.66, 0.18, 0.08), dark, {
    position: [0, 0.96, -0.74],
    rotation: [-0.15, 0, 0],
  })
  kit.addMirrored('chassis', 'chassis', roundedBox(0.1, 0.4, 0.22, 0.04), shade(dark, 1.3), {
    position: [0.34, 0.84, -0.6],
    rotation: [-0.1, 0, 0],
  })

  // Pedals
  for (const side of [1, -1] as const) {
    kit.add('chassis', box(0.16, 0.05, 0.2), dark, {
      position: [side * PEDALS.x, PEDALS.y - 0.06, PEDALS.z],
      rotation: [-0.5, 0, 0],
    })
  }

  // Steering column and wheel
  const wheel = STEERING_WHEEL
  kit.add('chassis', cylinder(0.035, 0.045, 0.34, 8), dark, {
    position: [0, 0.86, 0.46],
    rotation: [-0.55, 0, 0],
  })
  kit.frame({ position: [0, wheel.y, wheel.z], rotation: [wheel.tilt, 0, 0] }, () => {
    kit.add('chassis', torus(wheel.radius, 0.058, 20, 8), accent)
    kit.add('chassis', sphere(0.07, 12), accent, { scale: [1, 1, 0.7] })
    kit.add('chassis', box(wheel.radius * 1.8, 0.045, 0.04), dark)
    kit.add('chassis', box(0.045, wheel.radius * 0.9, 0.04), dark, {
      position: [0, -wheel.radius * 0.45, 0],
    })
  })

  // Rear engine, intakes and chrome exhausts
  kit.add(
    'chassis',
    roundedBox(0.66, 0.36, 0.42, 0.1),
    gradient('y', 0.5, 0.9, CHROME_SHADE, CHROME),
    {
      position: [0, 0.7, -1.0],
    },
  )
  for (const side of [1, -1] as const) {
    kit.add(
      'chassis',
      lathe(
        [
          [0.06, 0],
          [0.09, 0.05],
          [0.1, 0.16],
          [0.075, 0.2],
          [0, 0.2],
        ],
        10,
      ),
      CHROME,
      {
        position: [side * 0.17, 0.86, -0.98],
      },
    )
  }
  const pipes = style === 'heavy' ? [-0.3, -0.1, 0.1, 0.3] : [-0.2, 0.2]
  for (const x of pipes) {
    kit.add(
      'chassis',
      lathe(
        [
          [0.055, 0],
          [0.06, 0.2],
          [0.08, 0.36],
          [0.115, 0.46],
          [0.1, 0.48],
        ],
        8,
        6,
      ),
      gradient('y', -0.2, 0.3, CHROME_SHADE, CHROME),
      { position: [x, 0.62, -1.18], rotation: [-Math.PI / 2, 0, 0] },
    )
    kit.add('chassis', cylinder(0.082, 0.082, 0.02, 10), '#26202a', {
      position: [x, 0.62, -1.655],
      rotation: [Math.PI / 2, 0, 0],
    })
  }

  addStyle(kit, style, palette, dark)

  // Race number on both side pods
  addNumber(kit, palette.number ?? 7, accent)

  // Fenders and wheels
  for (const [bone, x, z] of [
    ['wheelFL', WHEEL_X, WHEEL_Z],
    ['wheelFR', -WHEEL_X, WHEEL_Z],
    ['wheelRL', WHEEL_X, -WHEEL_Z],
    ['wheelRR', -WHEEL_X, -WHEEL_Z],
  ] as const) {
    const rear = z < 0
    const width = rear ? build.rearWidth : build.frontWidth
    const side = Math.sign(x) as 1 | -1
    kit.add(
      'chassis',
      fenderGeometry([x, WHEEL_RADIUS, z], width + 0.06, side),
      rear ? accent : body,
    )
    addWheel(kit, bone, [x, WHEEL_RADIUS, z], width, side, accent, rear ? 7 : 7)
  }
}

function addWheel(
  kit: ModelKit,
  bone: 'wheelFL' | 'wheelFR' | 'wheelRL' | 'wheelRR',
  [x, y, z]: Vec3,
  width: number,
  side: 1 | -1,
  accent: string,
  lugs: number,
): void {
  kit.add(bone, tireGeometry(width, lugs), gradient('y', -width / 2, width / 2, TIRE, TIRE_SIDE), {
    position: [x, y, z],
    rotation: [0, 0, Math.PI / 2],
  })
  const face = x + side * (width / 2 + 0.005)
  // Hub cap, chrome ring and spokes on the outer face
  kit.frame({ position: [face, y, z], rotation: [0, 0, (-side * Math.PI) / 2] }, () => {
    kit.add(bone, dome(0.2, Math.PI / 2, 10), accent, {
      position: [0, -0.01, 0],
      scale: [1, 0.4, 1],
    })
    kit.add(bone, torus(0.2, 0.024, 10, 3), CHROME, {
      rotation: [Math.PI / 2, 0, 0],
      position: [0, 0.0, 0],
    })
    kit.add(bone, sphere(0.055, 5), CHROME, { position: [0, 0.01, 0], scale: [1, 0.6, 1] })
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2
      kit.add(bone, box(0.035, 0.02, 0.15), shade(accent, 0.6), {
        position: [Math.cos(angle) * 0.1, 0.012, Math.sin(angle) * 0.1],
        rotation: [0, -angle + Math.PI / 2, 0],
      })
    }
  })
}

/** Race number from rounded bars (seven-segment style) on a white disc on each side pod. */
function addNumber(kit: ModelKit, number: number, color: string): void {
  const segments: Record<string, string> = {
    '0': 'abcdef',
    '1': 'bc',
    '2': 'abged',
    '3': 'abgcd',
    '4': 'fgbc',
    '5': 'afgcd',
    '6': 'afgedc',
    '7': 'abc',
    '8': 'abcdefg',
    '9': 'abcdfg',
  }
  const digits = String(number)
  const spacing = 0.1
  for (const side of [1, -1] as const) {
    kit.frame(
      { position: [side * 0.79, 0.46, 0.14], rotation: [0, 0, -side * (Math.PI / 2)] },
      () => {
        kit.frame({ rotation: [0, side * (Math.PI / 2), 0] }, () => {
          kit.add('chassis', sphere(1, 10), '#fbfbf5', { scale: [0.15, 0.03, 0.15] })
          digits.split('').forEach((digit, i) => {
            const dx = (i - (digits.length - 1) / 2) * spacing
            const lit = segments[digit] ?? ''
            const bars: Record<string, readonly [number, number, number, number]> = {
              a: [0, -0.07, 0.07, 0.022],
              b: [0.04, -0.035, 0.022, 0.07],
              c: [0.04, 0.035, 0.022, 0.07],
              d: [0, 0.07, 0.07, 0.022],
              e: [-0.04, 0.035, 0.022, 0.07],
              f: [-0.04, -0.035, 0.022, 0.07],
              g: [0, 0, 0.07, 0.022],
            }
            for (const key of lit) {
              const bar = bars[key]
              if (!bar) continue
              kit.add('chassis', box(bar[2] + 0.014, 0.024, bar[3] + 0.014), color, {
                position: [dx + bar[0] * 0.8, 0.03, bar[1] * 0.8],
              })
            }
          })
        })
      },
    )
  }
}

function addStyle(kit: ModelKit, style: KartStyle, palette: KartPalette, dark: string): void {
  const { body, accent } = palette
  switch (style) {
    case 'classic':
    case 'sport':
    case 'heavy': {
      // Rear wing on two struts with end plates
      const wing = style === 'heavy' ? 1.4 : 1.3
      kit.add('chassis', roundedBox(wing, 0.07, 0.36, 0.035), accent, {
        position: [0, 1.14, -1.1],
        rotation: [-0.1, 0, 0],
      })
      kit.addMirrored(
        'chassis',
        'chassis',
        roundedBox(0.04, 0.22, 0.42, 0.02),
        shade(accent, 0.75),
        {
          position: [wing / 2, 1.14, -1.1],
        },
      )
      kit.addMirrored('chassis', 'chassis', roundedBox(0.07, 0.5, 0.1, 0.03), dark, {
        position: [0.3, 0.9, -1.08],
      })
      if (style === 'sport') {
        // Racing stripe and a low front splitter
        kit.add('chassis', roundedBox(0.2, 0.02, 1.4, 0.01), accent, { position: [0, 0.745, 0.1] })
        kit.add('chassis', roundedBox(1.1, 0.04, 0.3, 0.02), dark, { position: [0, 0.3, 1.35] })
      }
      if (style === 'heavy') {
        // Rivet plates along the sides
        for (const side of [1, -1] as const) {
          kit.add('chassis', roundedBox(0.05, 0.14, 0.7, 0.02), shade(accent, 0.8), {
            position: [side * 0.62, 0.6, -0.55],
          })
        }
        kit.add('chassis', roundedBox(0.8, 0.12, 0.08, 0.04), dark, { position: [0, 0.56, 1.2] })
      }
      return
    }
    case 'leafy': {
      // Big leaf spoiler on a stalk, leaves on the fenders and a sprout on the nose
      const vein = '#d9f27a'
      kit.add(
        'chassis',
        tube(
          [
            [0, 0.8, -1.05],
            [0, 1.0, -1.1],
            [0, 1.2, -1.1],
          ],
          [0.05],
          8,
          6,
        ),
        dark,
      )
      for (const [side, roll] of [
        [1, -0.55],
        [-1, 0.55],
        [0, 0],
      ] as const) {
        kit.frame(
          { position: [side * 0.12, 1.3, -1.12], rotation: [-0.5, side * 0.35, roll] },
          () => {
            kit.add('chassis', leafGeometry(0.2, 0.62), accent)
            kit.add('chassis', leafGeometry(0.035, 0.6), vein, { position: [0, 0.015, 0] })
          },
        )
      }
      for (const side of [1, -1] as const) {
        kit.frame({ position: [side * 0.82, 0.78, -0.75], rotation: [0.2, 0, side * 0.9] }, () => {
          kit.add('chassis', leafGeometry(0.13, 0.4), accent)
          kit.add('chassis', leafGeometry(0.025, 0.38), vein, { position: [0, 0.012, 0] })
        })
      }
      kit.frame({ position: [0, 0.77, 0.86], rotation: [0.03, 0, 0] }, () => {
        kit.add('chassis', leafGeometry(0.15, 0.46), accent)
        kit.add('chassis', leafGeometry(0.02, 0.44), vein, { position: [0, 0.012, 0.01] })
      })
      return
    }
    case 'boat': {
      // Rounded bow, a life ring and a little fin
      kit.add('chassis', sphere(1, 16), body, {
        position: [0, 0.46, 1.3],
        scale: [0.4, 0.16, 0.3],
      })
      kit.add('chassis', torus(0.22, 0.07, 18, 8), '#ff5a4f', {
        position: [0, 0.98, -1.0],
        rotation: [0.2, 0, 0],
      })
      kit.add('chassis', roundedBox(0.06, 0.5, 0.4, 0.03), accent, {
        position: [0, 1.25, -1.0],
        rotation: [-0.3, 0, 0],
      })
      return
    }
  }
}

/** Flat leaf pointing +y (upper face +z... lies in the XZ plane, tip along +z). */
function leafGeometry(width: number, length: number): THREE.BufferGeometry {
  const rings: Ring[] = []
  const steps = 4
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const profile = Math.sin(Math.PI * Math.min(t * 0.95 + 0.05, 1)) ** 0.8
    rings.push({
      center: new THREE.Vector3(0, 0.02 * Math.sin(t * Math.PI), t * length),
      u: new THREE.Vector3(1, 0, 0),
      v: new THREE.Vector3(0, 1, 0),
      a: Math.max(width * profile, 0.004),
      b: 0.012,
      n: 2,
    })
  }
  return sweep(rings, 6, 0.02, 0.05, 1)
}
