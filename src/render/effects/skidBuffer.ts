import { skidFade } from './surfaceFxLogic'

const POSITION_STRIDE = 3
const COLOR_STRIDE = 4

/** Trail of one wheel: its last edge points, so the next quad joins the previous one. */
interface Trail {
  active: boolean
  leftX: number
  leftY: number
  leftZ: number
  rightX: number
  rightY: number
  rightZ: number
}

interface Rgb {
  r: number
  g: number
  b: number
}

/**
 * Fixed-size ring buffer of ground quads for tire marks. Each quad has four vertices (a strip
 * between the previous and the new edge of a wheel's trail). Writing overwrites the oldest
 * quad, so nothing is allocated after construction. The arrays are the GPU attributes.
 */
export class SkidBuffer {
  /** 4 vertices x 3 floats per quad. */
  readonly positions: Float32Array
  /** 4 vertices x RGBA per quad (alpha already faded). */
  readonly colors: Float32Array

  private readonly birth: Float32Array
  private readonly baseAlpha: Float32Array
  private readonly trails: Trail[] = []
  private active: number
  private cursor = 0
  private clock = 0
  private life: number

  constructor(
    readonly capacity: number,
    trailCount: number,
    life: number,
    private readonly holdShare: number,
  ) {
    this.active = capacity
    this.life = life
    this.positions = new Float32Array(capacity * 4 * POSITION_STRIDE)
    this.colors = new Float32Array(capacity * 4 * COLOR_STRIDE)
    this.birth = new Float32Array(capacity).fill(-Infinity)
    this.baseAlpha = new Float32Array(capacity)
    for (let i = 0; i < trailCount; i += 1) {
      this.trails.push({
        active: false,
        leftX: 0,
        leftY: 0,
        leftZ: 0,
        rightX: 0,
        rightY: 0,
        rightZ: 0,
      })
    }
  }

  /** Uses only the first `share` of the quads and about `share` of the life (graphics quality). */
  setScale(share: number, baseLife: number): void {
    const clamped = Math.min(1, Math.max(0, share))
    this.active = Math.max(1, Math.round(this.capacity * clamped))
    this.life = baseLife * Math.max(0.3, clamped)
    for (let quad = this.active; quad < this.capacity; quad += 1) this.kill(quad)
    this.cursor %= this.active
  }

  /** Index of the quad the next segment will overwrite. */
  get nextIndex(): number {
    return this.cursor
  }

  /** Number of quads still visible. */
  get visibleCount(): number {
    let count = 0
    for (let quad = 0; quad < this.capacity; quad += 1) {
      if (this.alphaOf(quad) > 0) count += 1
    }
    return count
  }

  /** Ends a wheel's trail, so the next mark starts a fresh strip. */
  breakTrail(trail: number): void {
    const t = this.trails[trail]
    if (t) t.active = false
  }

  /** Forgets every mark and trail (new race or track). */
  clear(): void {
    for (let quad = 0; quad < this.capacity; quad += 1) this.kill(quad)
    for (const trail of this.trails) trail.active = false
    this.cursor = 0
  }

  /**
   * Extends a wheel's trail to the point (x, y, z), `width` wide across the heading (dirX, dirZ
   * unit vector). The first call starts the trail; later calls add a quad once the wheel has
   * moved `segmentLength`, and a jump longer than `maxGap` starts a new trail.
   * Returns the quad index written, or -1 if no quad was added.
   */
  extend(
    trail: number,
    x: number,
    y: number,
    z: number,
    dirX: number,
    dirZ: number,
    width: number,
    alpha: number,
    color: Rgb,
    segmentLength: number,
    maxGap: number,
  ): number {
    const t = this.trails[trail]
    if (!t) return -1
    const half = width / 2
    const leftX = x - dirZ * half
    const leftZ = z + dirX * half
    const rightX = x + dirZ * half
    const rightZ = z - dirX * half

    if (t.active) {
      const dx = x - (t.leftX + t.rightX) / 2
      const dz = z - (t.leftZ + t.rightZ) / 2
      const distance = Math.hypot(dx, dz)
      if (distance > maxGap) t.active = false
      else if (distance < segmentLength) return -1
    }
    let written = -1
    if (t.active) {
      written = this.writeQuad(t, leftX, leftZ, rightX, rightZ, y, alpha, color)
    }
    t.active = true
    t.leftX = leftX
    t.leftY = y
    t.leftZ = leftZ
    t.rightX = rightX
    t.rightY = y
    t.rightZ = rightZ
    return written
  }

  /** Advances the clock and fades every mark; returns true if any color changed. */
  update(dt: number): boolean {
    this.clock += dt
    let changed = false
    for (let quad = 0; quad < this.capacity; quad += 1) {
      const born = this.birth[quad] ?? -Infinity
      if (born === -Infinity) continue
      const fade = skidFade(this.clock - born, this.life, this.holdShare)
      const alpha = (this.baseAlpha[quad] ?? 0) * fade
      const c = quad * 4 * COLOR_STRIDE
      if (this.colors[c + 3] === alpha) continue
      for (let vertex = 0; vertex < 4; vertex += 1) {
        this.colors[c + vertex * COLOR_STRIDE + 3] = alpha
      }
      if (fade === 0) this.birth[quad] = -Infinity
      changed = true
    }
    return changed
  }

  /** Current opacity of a quad (0 when dead). */
  alphaOf(quad: number): number {
    return this.colors[quad * 4 * COLOR_STRIDE + 3] ?? 0
  }

  private writeQuad(
    t: Trail,
    leftX: number,
    leftZ: number,
    rightX: number,
    rightZ: number,
    y: number,
    alpha: number,
    color: Rgb,
  ): number {
    const quad = this.cursor
    this.cursor = (this.cursor + 1) % this.active
    const p = quad * 4 * POSITION_STRIDE
    const pos = this.positions
    // Previous edge (left, right), then the new edge (right, left)
    pos[p] = t.leftX
    pos[p + 1] = t.leftY
    pos[p + 2] = t.leftZ
    pos[p + 3] = t.rightX
    pos[p + 4] = t.rightY
    pos[p + 5] = t.rightZ
    pos[p + 6] = rightX
    pos[p + 7] = y
    pos[p + 8] = rightZ
    pos[p + 9] = leftX
    pos[p + 10] = y
    pos[p + 11] = leftZ
    const c = quad * 4 * COLOR_STRIDE
    for (let vertex = 0; vertex < 4; vertex += 1) {
      const o = c + vertex * COLOR_STRIDE
      this.colors[o] = color.r
      this.colors[o + 1] = color.g
      this.colors[o + 2] = color.b
      this.colors[o + 3] = alpha
    }
    this.birth[quad] = this.clock
    this.baseAlpha[quad] = alpha
    return quad
  }

  private kill(quad: number): void {
    this.birth[quad] = -Infinity
    this.baseAlpha[quad] = 0
    const c = quad * 4 * COLOR_STRIDE
    for (let vertex = 0; vertex < 4; vertex += 1) this.colors[c + vertex * COLOR_STRIDE + 3] = 0
  }
}
