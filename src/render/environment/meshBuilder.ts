import * as THREE from 'three'

type V3 = readonly [number, number, number]

/** Smooth noise in -1..1 at vertex `i` of a sphere of `radius` (depends on its direction). */
function lumpNoise(
  position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  i: number,
  radius: number,
  seed: number,
): number {
  const x = position.getX(i) / radius
  const y = position.getY(i) / radius
  const z = position.getZ(i) / radius
  const n =
    Math.sin(x * 3.3 + seed * 1.3) * Math.sin(y * 2.9 + seed * 2.1) +
    Math.sin(z * 3.7 + seed * 0.7) * Math.sin(x * 2.3 + seed) +
    Math.sin(y * 4.1 + z * 2.2 + seed * 3.1) * 0.5
  return Math.max(-1, Math.min(1, n * 0.6))
}

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

  /**
   * Lumpy blob: an icosahedron stretched by `scale`, shaded from `bottom` to `top`. With `bump`
   * above 0 the surface is displaced by smooth noise (up to `bump` of the radius, `seed` picks
   * the pattern); the noise depends on the position only, so shared corners stay joined.
   */
  blob(
    center: V3,
    radius: number,
    scale: V3,
    bottom: string,
    top: string,
    detail = 0,
    tint = 1,
    bump = 0,
    seed = 0,
  ): this {
    const geometry = new THREE.IcosahedronGeometry(radius, detail)
    const position = geometry.getAttribute('position')
    const low = new THREE.Color(bottom)
    const high = new THREE.Color(top)
    const mixed = new THREE.Color()
    for (let i = 0; i < position.count; i++) {
      const k = bump > 0 ? 1 + bump * lumpNoise(position, i, radius, seed) : 1
      const x = position.getX(i) * k
      const y = position.getY(i) * k
      const z = position.getZ(i) * k
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
