import * as THREE from 'three'

type V3 = readonly [number, number, number]

/**
 * Builds a low-poly, flat-shaded mesh triangle by triangle with a color per vertex and a
 * `tint` per vertex (1 = the instance color applies, 0 = it does not). Used for plants.
 */
export class MeshBuilder {
  private readonly positions: number[] = []
  private readonly colors: number[] = []
  private readonly tints: number[] = []
  private readonly scratch = new THREE.Color()

  private color(c: string | THREE.Color): THREE.Color {
    return typeof c === 'string' ? this.scratch.set(c) : c
  }

  tri(a: V3, b: V3, c: V3, ca: string, cb: string = ca, cc: string = ca, tint = 1): this {
    for (const [p, col] of [
      [a, ca],
      [b, cb],
      [c, cc],
    ] as const) {
      this.positions.push(p[0], p[1], p[2])
      const rgb = this.color(col)
      this.colors.push(rgb.r, rgb.g, rgb.b)
      this.tints.push(tint)
    }
    return this
  }

  /** Quad with corners in order; split into (a, b, c) and (a, c, d). */
  quad(
    a: V3,
    b: V3,
    c: V3,
    d: V3,
    ca: string,
    cb: string = ca,
    cc: string = ca,
    cd: string = ca,
    tint = 1,
  ): this {
    return this.tri(a, b, c, ca, cb, cc, tint).tri(a, c, d, ca, cc, cd, tint)
  }

  /** Closed tapered cylinder from y0 to y1 with `sides` faces; colors by ring. */
  tube(
    x: number,
    z: number,
    y0: number,
    y1: number,
    r0: number,
    r1: number,
    sides: number,
    c0: string,
    c1: string = c0,
    tint = 1,
  ): this {
    for (let s = 0; s < sides; s++) {
      const a0 = (s / sides) * Math.PI * 2
      const a1 = ((s + 1) / sides) * Math.PI * 2
      const p00: V3 = [x + Math.cos(a0) * r0, y0, z + Math.sin(a0) * r0]
      const p01: V3 = [x + Math.cos(a1) * r0, y0, z + Math.sin(a1) * r0]
      const p10: V3 = [x + Math.cos(a0) * r1, y1, z + Math.sin(a0) * r1]
      const p11: V3 = [x + Math.cos(a1) * r1, y1, z + Math.sin(a1) * r1]
      this.quad(p00, p01, p11, p10, c0, c0, c1, c1, tint)
    }
    return this
  }

  /** Lumpy blob: an icosahedron stretched by `scale`, shaded from `bottom` to `top`. */
  blob(
    center: V3,
    radius: number,
    scale: V3,
    bottom: string,
    top: string,
    detail = 0,
    tint = 1,
  ): this {
    const geometry = new THREE.IcosahedronGeometry(radius, detail)
    const position = geometry.getAttribute('position')
    const low = new THREE.Color(bottom)
    const high = new THREE.Color(top)
    const mixed = new THREE.Color()
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i)
      const y = position.getY(i)
      const z = position.getZ(i)
      this.positions.push(
        center[0] + x * scale[0],
        center[1] + y * scale[1],
        center[2] + z * scale[2],
      )
      mixed.copy(low).lerp(high, Math.min(Math.max((y / radius + 1) / 2, 0), 1))
      this.colors.push(mixed.r, mixed.g, mixed.b)
      this.tints.push(tint)
    }
    geometry.dispose()
    return this
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3))
    geometry.setAttribute('tint', new THREE.Float32BufferAttribute(this.tints, 1))
    geometry.computeVertexNormals()
    return geometry
  }
}
