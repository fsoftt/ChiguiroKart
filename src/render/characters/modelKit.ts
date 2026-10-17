import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { boneNames, boneParents, type BoneName } from './rig'

export type Vec3 = readonly [number, number, number]

export interface Placement {
  position?: Vec3
  /** Euler angles in radians (XYZ). */
  rotation?: Vec3
  scale?: Vec3 | number
}

/** A flat color or a function that paints each vertex from its model space position. */
export type Paint = string | ((point: THREE.Vector3) => THREE.Color)

/** Smoothly fades from color `a` to color `b` along an axis between `from` and `to`. */
export function gradient(
  axis: 'x' | 'y' | 'z',
  from: number,
  to: number,
  a: string,
  b: string,
): Paint {
  const colorA = new THREE.Color(a)
  const colorB = new THREE.Color(b)
  const out = new THREE.Color()
  return (point) => {
    const t = THREE.MathUtils.clamp((point[axis] - from) / (to - from), 0, 1)
    return out.copy(colorA).lerp(colorB, t * t * (3 - 2 * t))
  }
}

/** Secondary bone influence: `weight(point)` of the vertex follows `bone` instead of the main one. */
export interface Blend {
  bone: BoneName
  weight: (point: THREE.Vector3) => number
}

/**
 * Builds a smooth cartoon model from primitives. Each part is bound to one bone (optionally
 * blended with a second one), painted with vertex colors and merged into one skinned mesh
 * (one draw call). Coordinates are in model space: +y up, +z forward, +x to the model's left.
 */
export class ModelKit {
  private readonly parts: THREE.BufferGeometry[] = []
  private readonly bonePositions = new Map<BoneName, THREE.Vector3>()
  /** Triangles added so far. */
  get triangles(): number {
    return this.parts.reduce((sum, g) => sum + (g.index?.count ?? 0) / 3, 0)
  }

  /** Triangles of each part in order (to spot what is expensive). */
  partSizes(): number[] {
    return this.parts.map((g) => (g.index?.count ?? 0) / 3)
  }

  private readonly frames: THREE.Matrix4[] = [new THREE.Matrix4()]

  /** Sets where a bone sits in model space (bind pose, no rotation). */
  bone(name: BoneName, x: number, y: number, z: number): this {
    this.bonePositions.set(name, new THREE.Vector3(x, y, z))
    return this
  }

  /** Runs `build` with every placement relative to `at` (e.g. an eye with its own gaze axis). */
  frame(at: Placement, build: () => void): this {
    const parent = this.frames[this.frames.length - 1] ?? new THREE.Matrix4()
    this.frames.push(parent.clone().multiply(compose(at)))
    build()
    this.frames.pop()
    return this
  }

  add(
    bone: BoneName,
    geometry: THREE.BufferGeometry,
    paint: Paint,
    at: Placement = {},
    blend?: Blend,
  ): this {
    let g = geometry.clone()
    g.deleteAttribute('uv')
    if (!g.index) g = mergeVertices(g)
    if (!g.getAttribute('normal')) g.computeVertexNormals()
    const top = this.frames[this.frames.length - 1] ?? new THREE.Matrix4()
    g.applyMatrix4(top.clone().multiply(compose(at)))

    const positions = g.getAttribute('position')
    const count = positions.count
    const colors = new Float32Array(count * 3)
    const skinIndex = new Uint16Array(count * 4)
    const skinWeight = new Float32Array(count * 4)
    const boneIndex = boneNames.indexOf(bone)
    const flat = typeof paint === 'string' ? new THREE.Color(paint) : null
    const point = new THREE.Vector3()
    for (let i = 0; i < count; i++) {
      point.fromBufferAttribute(positions, i)
      const rgb = flat ?? (typeof paint === 'function' ? paint(point) : new THREE.Color())
      colors[i * 3] = rgb.r
      colors[i * 3 + 1] = rgb.g
      colors[i * 3 + 2] = rgb.b
      skinIndex[i * 4] = boneIndex
      skinWeight[i * 4] = 1
      if (blend) {
        const w = THREE.MathUtils.clamp(blend.weight(point), 0, 1)
        skinIndex[i * 4 + 1] = boneNames.indexOf(blend.bone)
        skinWeight[i * 4] = 1 - w
        skinWeight[i * 4 + 1] = w
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4))
    g.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4))
    this.parts.push(g)
    return this
  }

  /** Adds the part and its mirror image across x = 0 on the paired bone (outside any frame). */
  addMirrored(
    left: BoneName,
    right: BoneName,
    geometry: THREE.BufferGeometry,
    paint: Paint,
    at: Placement,
  ): this {
    this.add(left, geometry, paint, at)
    const [x, y, z] = at.position ?? [0, 0, 0]
    const [rx, ry, rz] = at.rotation ?? [0, 0, 0]
    return this.add(right, geometry, paint, {
      ...at,
      position: [-x, y, z],
      rotation: [rx, -ry, -rz],
    })
  }

  /** Capsule from `from` to `to` (model space), e.g. a limb. */
  segment(bone: BoneName, from: Vec3, to: Vec3, radius: number, paint: Paint, detail = 8): this {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const direction = b.clone().sub(a)
    const length = direction.length()
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    )
    const euler = new THREE.Euler().setFromQuaternion(quaternion)
    const middle = a.add(b).multiplyScalar(0.5)
    return this.add(bone, capsule(radius, Math.max(length - 2 * radius, 0.01), detail), paint, {
      position: [middle.x, middle.y, middle.z],
      rotation: [euler.x, euler.y, euler.z],
    })
  }

  /** Merges every part into one skinned mesh with its skeleton in bind pose. */
  build(name: string, material: THREE.Material): THREE.SkinnedMesh {
    const bones = new Map<BoneName, THREE.Bone>()
    for (const name of boneNames) {
      const bone = new THREE.Bone()
      bone.name = name
      bones.set(name, bone)
    }
    for (const name of boneNames) {
      const bone = bones.get(name)
      const world = this.bonePositions.get(name) ?? new THREE.Vector3()
      if (!bone) continue
      if (name === 'root') {
        bone.position.copy(world)
        continue
      }
      const parentName = boneParents[name]
      const parentWorld = this.bonePositions.get(parentName) ?? new THREE.Vector3()
      bone.position.copy(world).sub(parentWorld)
      bones.get(parentName)?.add(bone)
    }

    const geometry = mergeGeometries(this.parts)
    if (!geometry) throw new Error(`Could not merge the parts of ${name}`)
    const mesh = new THREE.SkinnedMesh(geometry, material)
    mesh.name = name
    const root = bones.get('root')
    if (!root) throw new Error('Missing root bone')
    mesh.add(root)
    mesh.bind(new THREE.Skeleton(boneNames.map((b) => bones.get(b) ?? new THREE.Bone())))
    return mesh
  }
}

function compose(at: Placement): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...(at.position ?? [0, 0, 0])),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...(at.rotation ?? [0, 0, 0]))),
    typeof at.scale === 'number'
      ? new THREE.Vector3(at.scale, at.scale, at.scale)
      : new THREE.Vector3(...(at.scale ?? [1, 1, 1])),
  )
}

// Primitives centered at the origin. Detail is the number of segments around the shape.

export const sphere = (radius = 1, detail = 10): THREE.BufferGeometry =>
  new THREE.SphereGeometry(radius, detail, Math.max(4, Math.round(detail * 0.75)))

/** Upper cap of a sphere (polar angle 0 to `reach` rad, pointing +y), e.g. an eyelid. */
export const dome = (radius: number, reach: number, detail = 16): THREE.BufferGeometry =>
  new THREE.SphereGeometry(
    radius,
    detail,
    Math.max(3, Math.round(detail * 0.45)),
    0,
    Math.PI * 2,
    0,
    reach,
  )

export const box = (w: number, h: number, d: number): THREE.BufferGeometry =>
  new THREE.BoxGeometry(w, h, d)

/** Capsule along +y. */
export const capsule = (radius: number, length: number, detail = 8): THREE.BufferGeometry =>
  new THREE.CapsuleGeometry(radius, length, Math.max(2, detail >> 1), detail)

/** Cone pointing +y. */
export const cone = (radius: number, height: number, detail = 12): THREE.BufferGeometry =>
  new THREE.ConeGeometry(radius, height, detail)

/** Cylinder along +y. */
export const cylinder = (
  top: number,
  bottom: number,
  height: number,
  detail = 16,
): THREE.BufferGeometry => new THREE.CylinderGeometry(top, bottom, height, detail)

/** Ring in the XY plane (faces ±z); `arc` limits it to a part of the circle. */
export const torus = (
  radius: number,
  tube: number,
  detail = 20,
  sides = 8,
  arc = Math.PI * 2,
): THREE.BufferGeometry => new THREE.TorusGeometry(radius, tube, sides, detail, arc)

/**
 * Surface of revolution around +y from a profile of [radius, y] points (bottom to top),
 * smoothed with a spline when `samples` is set so a handful of points gives a round shape.
 */
export function lathe(
  profile: readonly (readonly [number, number])[],
  detail = 20,
  samples = 0,
): THREE.BufferGeometry {
  let points = profile.map(([r, y]) => new THREE.Vector2(r, y))
  if (samples > 0 && points.length > 2) {
    points = new THREE.SplineCurve(points).getSpacedPoints(samples)
  }
  return new THREE.LatheGeometry(points, detail)
}

/**
 * Box with rounded edges and smooth normals. `quality` 1 to 3 sets how finely the edges are
 * rounded (96, 192 or 432 triangles).
 */
export function roundedBox(
  w: number,
  h: number,
  d: number,
  radius: number,
  quality: 1 | 2 | 3 = 1,
): THREE.BufferGeometry {
  const half = [w / 2, h / 2, d / 2] as const
  const r = Math.min(radius, ...half)
  const segments = quality === 1 ? 2 : quality === 2 ? 4 : 6
  const g = new THREE.BoxGeometry(2, 2, 2, segments, segments, segments)
  g.deleteAttribute('uv')
  const position = g.getAttribute('position')
  const normal = g.getAttribute('normal')
  const p = new THREE.Vector3()
  const inner = new THREE.Vector3()
  const dir = new THREE.Vector3()
  for (let i = 0; i < position.count; i++) {
    const out: number[] = []
    for (let axis = 0; axis < 3; axis++) {
      const t = position.getComponent(i, axis)
      const k = Math.round(((t + 1) * segments) / 2)
      const h2 = half[axis] ?? 1
      const f = r / h2
      const grid =
        quality === 1
          ? [-1, 0, 1]
          : quality === 2
            ? [-1, -1 + f, 0, 1 - f, 1]
            : [-1, -1 + f * 0.5, -1 + f, 0, 1 - f, 1 - f * 0.5, 1]
      out.push((grid[k] ?? 0) * h2)
    }
    p.set(out[0] ?? 0, out[1] ?? 0, out[2] ?? 0)
    inner.set(
      THREE.MathUtils.clamp(p.x, -(half[0] - r), half[0] - r),
      THREE.MathUtils.clamp(p.y, -(half[1] - r), half[1] - r),
      THREE.MathUtils.clamp(p.z, -(half[2] - r), half[2] - r),
    )
    dir.copy(p).sub(inner)
    if (dir.lengthSq() > 1e-12) dir.normalize()
    p.copy(inner).addScaledVector(dir, r)
    position.setXYZ(i, p.x, p.y, p.z)
    normal.setXYZ(i, dir.x, dir.y, dir.z)
  }
  return mergeVertices(g)
}

/** One cross-section of a sweep: a (super)ellipse around `center`, spanned by unit axes u and v. */
export interface Ring {
  center: THREE.Vector3
  u: THREE.Vector3
  v: THREE.Vector3
  /** Half sizes along u and v. */
  a: number
  b: number
  /** Squareness: 2 is an ellipse, 4 a rounded square. */
  n: number
}

/** Fractions along the rounded end caps of a sweep, by level of detail (1 to 4 rings). */
const CAP_STEPS: readonly (readonly number[])[] = [
  [0.85],
  [0.55, 0.92],
  [0.4, 0.75, 0.95],
  [0.3, 0.62, 0.86, 0.97],
]

function capRing(end: Ring, direction: THREE.Vector3, depth: number, s: number): Ring {
  // Quarter-ellipse profile: at fraction s of the way the size shrinks as sqrt(1 - s^2)
  const shrink = Math.sqrt(1 - s * s)
  return {
    ...end,
    center: end.center.clone().addScaledVector(direction, depth * s),
    a: end.a * shrink,
    b: end.b * shrink,
  }
}

/**
 * Closed smooth surface through the rings; both ends are rounded off over `capStart` and
 * `capEnd` (distance along the direction of travel).
 */
export function sweep(
  rings: readonly Ring[],
  radial: number,
  capStart: number,
  capEnd: number,
  capDetail = 4,
): THREE.BufferGeometry {
  const steps = CAP_STEPS[Math.min(Math.max(capDetail, 1), 4) - 1] ?? []
  const first = rings[0]
  const last = rings[rings.length - 1]
  const second = rings[1]
  const beforeLast = rings[rings.length - 2]
  if (!first || !last || !second || !beforeLast) throw new Error('A sweep needs two rings')
  const startDir = first.center.clone().sub(second.center).normalize()
  const endDir = last.center.clone().sub(beforeLast.center).normalize()
  const all: Ring[] = []
  for (let k = steps.length - 1; k >= 0; k--) {
    all.push(capRing(first, startDir, capStart, steps[k] ?? 0))
  }
  all.push(...rings)
  for (const s of steps) all.push(capRing(last, endDir, capEnd, s))

  const positions: number[] = []
  const indices: number[] = []
  for (const ring of all) {
    for (let j = 0; j < radial; j++) {
      const angle = (j / radial) * Math.PI * 2
      const c = Math.cos(angle)
      const s = Math.sin(angle)
      const px = ring.a * Math.sign(c) * Math.abs(c) ** (2 / ring.n)
      const py = ring.b * Math.sign(s) * Math.abs(s) ** (2 / ring.n)
      const point = ring.center.clone().addScaledVector(ring.u, px).addScaledVector(ring.v, py)
      positions.push(point.x, point.y, point.z)
    }
  }
  const rowCount = all.length
  for (let i = 0; i < rowCount - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j
      const b = i * radial + ((j + 1) % radial)
      const c = (i + 1) * radial + j
      const d = (i + 1) * radial + ((j + 1) % radial)
      indices.push(a, b, c, b, d, c)
    }
  }
  const poleStart = positions.length / 3
  const tipStart = first.center.clone().addScaledVector(startDir, capStart)
  positions.push(tipStart.x, tipStart.y, tipStart.z)
  const poleEnd = poleStart + 1
  const tipEnd = last.center.clone().addScaledVector(endDir, capEnd)
  positions.push(tipEnd.x, tipEnd.y, tipEnd.z)
  const lastRow = (rowCount - 1) * radial
  for (let j = 0; j < radial; j++) {
    const j2 = (j + 1) % radial
    indices.push(poleStart, j2, j)
    indices.push(poleEnd, lastRow + j, lastRow + j2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setIndex(indices)
  orientOutward(g)
  g.computeVertexNormals()
  return g
}

/** Flips the faces of a closed mesh when they look inward (negative volume). */
function orientOutward(g: THREE.BufferGeometry): void {
  const index = g.getIndex()
  const pos = g.getAttribute('position')
  if (!index) return
  let volume = 0
  const va = new THREE.Vector3()
  const vb = new THREE.Vector3()
  const vc = new THREE.Vector3()
  for (let i = 0; i < index.count; i += 3) {
    va.fromBufferAttribute(pos, index.getX(i))
    vb.fromBufferAttribute(pos, index.getX(i + 1))
    vc.fromBufferAttribute(pos, index.getX(i + 2))
    volume += va.dot(vb.cross(vc))
  }
  if (volume >= 0) return
  for (let i = 0; i < index.count; i += 3) {
    const t = index.getX(i + 1)
    index.setX(i + 1, index.getX(i + 2))
    index.setX(i + 2, t)
  }
}

/** A cross-section station of a body built along +z (see `loft`). */
export interface Station {
  z: number
  /** Full width and height. */
  w: number
  h: number
  /** Center offsets. */
  x?: number
  y?: number
  n?: number
}

/** Smooth body along +z through the stations (cars, torsos, heads), rounded at both ends. */
export function loft(
  stations: readonly Station[],
  radial = 24,
  capFront = 0.3,
  capBack = 0.3,
  capDetail = 4,
): THREE.BufferGeometry {
  const rings = stations.map<Ring>((s) => ({
    center: new THREE.Vector3(s.x ?? 0, s.y ?? 0, s.z),
    u: new THREE.Vector3(1, 0, 0),
    v: new THREE.Vector3(0, 1, 0),
    a: s.w / 2,
    b: s.h / 2,
    n: s.n ?? 2,
  }))
  return sweep(rings, radial, capBack, capFront, capDetail)
}

/**
 * Round tube through `points` (smooth curve) whose radius follows `radii` (evenly spaced along
 * it), with rounded ends. Good for limbs, tails, bars and fingers.
 */
export function tube(
  points: readonly Vec3[],
  radii: readonly number[],
  radial = 10,
  steps = 10,
  squash = 1,
  capDetail = 3,
): THREE.BufferGeometry {
  const vectors = points.map((p) => new THREE.Vector3(...p))
  const curve =
    vectors.length === 2
      ? new THREE.LineCurve3(vectors[0] ?? new THREE.Vector3(), vectors[1] ?? new THREE.Vector3())
      : new THREE.CatmullRomCurve3(vectors)
  const rings: Ring[] = []
  const normal = new THREE.Vector3()
  const previous = new THREE.Vector3()
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const tangent = curve.getTangentAt(t).normalize()
    if (i === 0) {
      const helper =
        Math.abs(tangent.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
      normal.copy(helper).addScaledVector(tangent, -helper.dot(tangent)).normalize()
    } else {
      normal
        .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(previous, tangent))
        .normalize()
    }
    previous.copy(tangent)
    const f = t * (radii.length - 1)
    const k = Math.min(Math.floor(f), radii.length - 2)
    const radius = THREE.MathUtils.lerp(radii[k] ?? 0.1, radii[k + 1] ?? 0.1, f - k)
    rings.push({
      center: curve.getPointAt(t),
      u: normal.clone(),
      v: tangent.clone().cross(normal).normalize(),
      a: radius,
      b: radius * squash,
      n: 2,
    })
  }
  return sweep(rings, radial, rings[0]?.a ?? 0.1, rings[rings.length - 1]?.a ?? 0.1, capDetail)
}
