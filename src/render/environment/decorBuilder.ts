import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ATLAS_CELLS, cellUv, type AtlasCell } from './proceduralTextures'

export type Vec3Tuple = readonly [number, number, number]

/**
 * Builds the decoration mesh: boxes, cylinders and balls painted with vertex colors (they all
 * sample the white swatch of the atlas) plus textured quads (banners, signs). Everything merges
 * into one geometry, so the whole decoration is one draw call. Pieces can be built in local
 * space and placed with `place`.
 */
export class DecorBuilder {
  private readonly parts: THREE.BufferGeometry[] = []
  private readonly whiteUv: [number, number]
  private readonly stack: THREE.Matrix4[] = [new THREE.Matrix4()]
  private readonly scratch = new THREE.Matrix4()

  constructor() {
    const [u0, v0, u1, v1] = cellUv(ATLAS_CELLS.white, 2)
    this.whiteUv = [(u0 + u1) / 2, (v0 + v1) / 2]
  }

  /** Runs `build` with everything it adds moved by `matrix` (nested calls compose). */
  place(matrix: THREE.Matrix4, build: () => void): void {
    const top = this.stack[this.stack.length - 1] as THREE.Matrix4
    this.stack.push(new THREE.Matrix4().multiplyMatrices(top, matrix))
    build()
    this.stack.pop()
  }

  /** Matrix from a position and a turn around y (rad). */
  static at(x: number, y: number, z: number, yaw = 0): THREE.Matrix4 {
    return new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
      new THREE.Vector3(1, 1, 1),
    )
  }

  private local(position: Vec3Tuple, rotation: Vec3Tuple, scale: Vec3Tuple): THREE.Matrix4 {
    return this.scratch.compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(...scale),
    )
  }

  private push(
    source: THREE.BufferGeometry,
    color: string,
    position: Vec3Tuple,
    rotation: Vec3Tuple = [0, 0, 0],
    scale: Vec3Tuple = [1, 1, 1],
  ): void {
    const g = source.index ? source.toNonIndexed() : source.clone()
    g.applyMatrix4(this.local(position, rotation, scale))
    g.applyMatrix4(this.stack[this.stack.length - 1] as THREE.Matrix4)
    const count = g.getAttribute('position').count
    const rgb = new THREE.Color(color)
    const colors = new Float32Array(count * 3)
    const uvs = new Float32Array(count * 2)
    for (let i = 0; i < count; i++) {
      colors.set([rgb.r, rgb.g, rgb.b], i * 3)
      uvs.set(this.whiteUv, i * 2)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    this.parts.push(g)
  }

  /** Box standing on `position` (center of its base). */
  box(
    color: string,
    w: number,
    h: number,
    d: number,
    position: Vec3Tuple,
    rotation: Vec3Tuple = [0, 0, 0],
  ): this {
    const g = new THREE.BoxGeometry(w, h, d)
    g.translate(0, h / 2, 0)
    this.push(g, color, position, rotation)
    g.dispose()
    return this
  }

  /** Cylinder standing on `position`; pass a rotation to lay it down. */
  cylinder(
    color: string,
    rTop: number,
    rBottom: number,
    h: number,
    position: Vec3Tuple,
    rotation: Vec3Tuple = [0, 0, 0],
    segments = 8,
  ): this {
    const g = new THREE.CylinderGeometry(rTop, rBottom, h, segments)
    g.translate(0, h / 2, 0)
    this.push(g, color, position, rotation)
    g.dispose()
    return this
  }

  ball(color: string, radius: number, position: Vec3Tuple, scale: Vec3Tuple = [1, 1, 1]): this {
    const g = new THREE.IcosahedronGeometry(radius, 1)
    this.push(g, color, position, [0, 0, 0], scale)
    g.dispose()
    return this
  }

  /** One flat colored triangle (shows from both sides with a double-sided material). */
  triangle(color: string, a: Vec3Tuple, b: Vec3Tuple, c: Vec3Tuple): this {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3))
    g.computeVertexNormals()
    this.push(g, color, [0, 0, 0])
    g.dispose()
    return this
  }

  /**
   * Textured quad from an atlas cell. Corners a, b, c, d go bottom-left, bottom-right,
   * top-right, top-left as seen from the front; the front is the side the winding faces.
   */
  textured(
    cell: AtlasCell,
    a: Vec3Tuple,
    b: Vec3Tuple,
    c: Vec3Tuple,
    d: Vec3Tuple,
    mirror = false,
  ): this {
    const [left, v0, right, v1] = cellUv(cell)
    const u0 = mirror ? right : left
    const u1 = mirror ? left : right
    const top = this.stack[this.stack.length - 1] as THREE.Matrix4
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3),
    )
    g.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2),
    )
    g.computeVertexNormals()
    g.applyMatrix4(top)
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array<number>(18).fill(1), 3))
    this.parts.push(g)
    return this
  }

  build(): THREE.BufferGeometry | null {
    if (this.parts.length === 0) return null
    const merged = mergeGeometries(this.parts, false)
    for (const part of this.parts) part.dispose()
    this.parts.length = 0
    return merged
  }
}
