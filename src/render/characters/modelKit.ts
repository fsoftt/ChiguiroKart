import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { boneNames, boneParents, type BoneName } from './rig'

export interface Placement {
  position?: readonly [number, number, number]
  /** Euler angles in radians (XYZ). */
  rotation?: readonly [number, number, number]
  scale?: readonly [number, number, number] | number
}

/**
 * Builds a low-poly model from primitives. Each part is rigidly bound to one bone and painted
 * with a flat vertex color, then everything is merged into one skinned mesh (one draw call).
 * Coordinates are in model space: +y up, +z forward, +x to the model's left.
 */
export class ModelKit {
  private readonly parts: THREE.BufferGeometry[] = []
  private readonly bonePositions = new Map<BoneName, THREE.Vector3>()

  /** Sets where a bone sits in model space (bind pose, no rotation). */
  bone(name: BoneName, x: number, y: number, z: number): this {
    this.bonePositions.set(name, new THREE.Vector3(x, y, z))
    return this
  }

  add(bone: BoneName, geometry: THREE.BufferGeometry, color: string, at: Placement = {}): this {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    g.deleteAttribute('uv')
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...(at.position ?? [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(at.rotation ?? [0, 0, 0]))),
      typeof at.scale === 'number'
        ? new THREE.Vector3(at.scale, at.scale, at.scale)
        : new THREE.Vector3(...(at.scale ?? [1, 1, 1])),
    )
    g.applyMatrix4(matrix)

    const count = g.getAttribute('position').count
    const rgb = new THREE.Color(color)
    const colors = new Float32Array(count * 3)
    const skinIndex = new Uint16Array(count * 4)
    const skinWeight = new Float32Array(count * 4)
    const boneIndex = boneNames.indexOf(bone)
    for (let i = 0; i < count; i++) {
      colors.set([rgb.r, rgb.g, rgb.b], i * 3)
      skinIndex[i * 4] = boneIndex
      skinWeight[i * 4] = 1
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4))
    g.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4))
    this.parts.push(g)
    return this
  }

  /** Adds the part and its mirror image across x = 0 on the paired bone. */
  addMirrored(
    left: BoneName,
    right: BoneName,
    geometry: THREE.BufferGeometry,
    color: string,
    at: Placement,
  ): this {
    this.add(left, geometry, color, at)
    const [x, y, z] = at.position ?? [0, 0, 0]
    const [rx, ry, rz] = at.rotation ?? [0, 0, 0]
    return this.add(right, geometry, color, {
      ...at,
      position: [-x, y, z],
      rotation: [rx, -ry, -rz],
    })
  }

  /** Capsule from `from` to `to` (model space), e.g. an arm or a leg. */
  segment(
    bone: BoneName,
    from: readonly [number, number, number],
    to: readonly [number, number, number],
    radius: number,
    color: string,
  ): this {
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
    return this.add(bone, capsule(radius, Math.max(length - radius, 0.01)), color, {
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

// Low-poly primitives centered at the origin

export const sphere = (radius = 1, detail = 10): THREE.BufferGeometry =>
  new THREE.SphereGeometry(radius, detail, Math.max(4, Math.round(detail * 0.7)))

export const box = (w: number, h: number, d: number): THREE.BufferGeometry =>
  new THREE.BoxGeometry(w, h, d)

/** Capsule along +y. */
export const capsule = (radius: number, length: number, detail = 6): THREE.BufferGeometry =>
  new THREE.CapsuleGeometry(radius, length, 2, detail)

/** Cone pointing +y. */
export const cone = (radius: number, height: number, detail = 8): THREE.BufferGeometry =>
  new THREE.ConeGeometry(radius, height, detail)

/** Cylinder along +y. */
export const cylinder = (
  top: number,
  bottom: number,
  height: number,
  detail = 10,
): THREE.BufferGeometry => new THREE.CylinderGeometry(top, bottom, height, detail)

/** Ring in the XY plane (faces ±z). */
export const torus = (radius: number, tube: number, detail = 12): THREE.BufferGeometry =>
  new THREE.TorusGeometry(radius, tube, 4, detail)
