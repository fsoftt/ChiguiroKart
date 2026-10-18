import * as THREE from 'three'
import { STEERING_WHEEL } from './kartModel'
import { addEyes, type EyeOptions } from './characterParts'
import { tube, type ModelKit, type Vec3 } from './modelKit'

/** Helpers shared by the hero pilots: painted decals, eyes seated on the head and long claws. */

/** An ellipsoid in model space (a head or a torso). */
export interface Ellipsoid {
  center: Vec3
  radii: Vec3
}

/** Unit vector for a yaw (turn toward +x) and a pitch (up). */
export function direction(yaw: number, pitch: number): THREE.Vector3 {
  return new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  )
}

/** Surface point of the ellipsoid in unit-sphere direction `d`, pushed out by `lift` along the normal. */
export function onEllipsoid(
  e: Ellipsoid,
  d: THREE.Vector3,
  lift = 0,
): { point: THREE.Vector3; normal: THREE.Vector3 } {
  const [cx, cy, cz] = e.center
  const [rx, ry, rz] = e.radii
  const unit = d.clone().normalize()
  const normal = new THREE.Vector3(unit.x / rx, unit.y / ry, unit.z / rz).normalize()
  const point = new THREE.Vector3(cx + rx * unit.x, cy + ry * unit.y, cz + rz * unit.z)
  return { point: point.addScaledVector(normal, lift), normal }
}

/** Unit direction of the point of the ellipsoid's front half that lies over `(x, y)`. */
export function frontDirection(e: Ellipsoid, x: number, y: number): THREE.Vector3 {
  const nx = x / e.radii[0]
  const ny = (y - e.center[1]) / e.radii[1]
  return new THREE.Vector3(nx, ny, Math.sqrt(Math.max(1 - nx * nx - ny * ny, 0.01)))
}

export interface DecalOptions {
  /** Where the patch is centered, as an angle on the ellipsoid. */
  yaw: number
  pitch: number
  /** Half sizes of the patch (about radians on the unit sphere). */
  a: number
  b: number
  color: string
  /** Rotation of the patch around its center (rad). */
  spin?: number
  /** Height over the surface; stack overlapping patches with growing values. */
  lift?: number
  /** Inner radius as a fraction (0..1): makes a ring instead of a filled patch. */
  hole?: number
  segments?: number
}

/** A thin sheet lying on the ellipsoid: markings painted on the skin, not relief. */
export function decalGeometry(e: Ellipsoid, o: DecalOptions): THREE.BufferGeometry {
  const segments = o.segments ?? 14
  const rows =
    o.hole === undefined ? THREE.MathUtils.clamp(Math.ceil(Math.max(o.a, o.b) * 6), 2, 5) : 1
  const axis = direction(o.yaw, o.pitch)
  const t1 = new THREE.Vector3(Math.cos(o.yaw), 0, -Math.sin(o.yaw))
  const t2 = new THREE.Vector3().crossVectors(axis, t1)
  const spin = o.spin ?? 0
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      const radius = o.hole === undefined ? j / rows : THREE.MathUtils.lerp(o.hole, 1, j / rows)
      const u = Math.cos(angle) * radius * o.a
      const v = Math.sin(angle) * radius * o.b
      const x = u * Math.cos(spin) - v * Math.sin(spin)
      const y = u * Math.sin(spin) + v * Math.cos(spin)
      const d = axis.clone().addScaledVector(t1, x).addScaledVector(t2, y)
      const { point, normal } = onEllipsoid(e, d, o.lift ?? 0.006)
      positions.push(point.x, point.y, point.z)
      normals.push(normal.x, normal.y, normal.z)
    }
  }
  const at = (index: number): THREE.Vector3 =>
    new THREE.Vector3(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2])
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < segments; i++) {
      const p = j * (segments + 1) + i
      const q = p + 1
      const r = p + segments + 1
      const s = r + 1
      for (const tri of [
        [p, r, q],
        [q, r, s],
      ] as const) {
        const [ia, ib, ic] = tri
        const face = new THREE.Vector3().crossVectors(at(ib).sub(at(ia)), at(ic).sub(at(ia)))
        const n = new THREE.Vector3(normals[ia * 3], normals[ia * 3 + 1], normals[ia * 3 + 2])
        if (face.lengthSq() < 1e-14) continue
        if (face.dot(n) < 0) indices.push(ia, ic, ib)
        else indices.push(ia, ib, ic)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  g.setIndex(indices)
  return g
}

/** Paints a decal on `bone` and, if `mirror`, its mirror image across x = 0 on the paired bone. */
export function paint(
  kit: ModelKit,
  bone: 'head' | 'body',
  e: Ellipsoid,
  o: DecalOptions,
  mirror = false,
): void {
  kit.add(bone, decalGeometry(e, o), o.color)
  if (mirror) {
    kit.add(bone, decalGeometry(e, { ...o, yaw: -o.yaw, spin: -(o.spin ?? 0) }), o.color)
  }
}

export type HeadEyeOptions = Omit<EyeOptions, 'center' | 'yaw' | 'pitch' | 'radius'> & {
  /** How deep the eyeball sinks into the head, as a fraction of its radius (0.8 default). */
  sink?: number
}

/** Eyes whose centers sit over `(x, y)` on the front of the head, looking along the surface normal. */
export function headEyes(
  kit: ModelKit,
  head: Ellipsoid,
  x: number,
  y: number,
  radius: number,
  o: HeadEyeOptions,
): void {
  const { sink = 0.8, ...rest } = o
  const { point, normal } = onEllipsoid(head, frontDirection(head, x, y), -sink * radius)
  const yaw = Math.asin(THREE.MathUtils.clamp(normal.x, -1, 1))
  const pitch = -Math.asin(THREE.MathUtils.clamp(normal.y / Math.cos(yaw), -1, 1))
  addEyes(kit, { ...rest, radius, center: [point.x, point.y, point.z], yaw, pitch })
}

/**
 * Long curved claws on a hand gripping the wheel, in the same frame `addHand` uses (x along the
 * rim, z forward). Must be called with the angle and size the hand used.
 */
export function addClaws(
  kit: ModelKit,
  bone: 'armL' | 'armR',
  side: 1 | -1,
  color: string,
  size: number,
  length = 1,
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
        for (let i = -1; i <= 1; i++) {
          const x = i * 0.07 * s
          kit.add(
            bone,
            tube(
              [
                [x, -0.01 * s, 0.09 * s],
                [x, -0.025 * s, 0.17 * s * length],
                [x, -0.085 * s, 0.24 * s * length],
              ],
              [0.026 * s, 0.018 * s, 0.004 * s],
              5,
              3,
              1,
              1,
            ),
            color,
          )
        }
      },
    )
  })
}
