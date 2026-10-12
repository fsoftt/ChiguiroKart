interface XYZ {
  x: number
  y: number
  z: number
}

interface RGB {
  r: number
  g: number
  b: number
}

/**
 * Fixed-capacity particle ring buffer. Spawning overwrites the oldest slot, so nothing
 * is allocated after construction. Output arrays are laid out for GPU instance attributes.
 */
export class ParticleRing {
  /** World positions, 3 floats per particle. */
  readonly offsets: Float32Array
  /** RGB, 3 floats per particle. */
  readonly colors: Float32Array
  /** Diameter and opacity, 2 floats per particle (diameter 0 = dead). */
  readonly params: Float32Array

  private readonly velocity: Float32Array
  private readonly age: Float32Array
  private readonly life: Float32Array
  private readonly sizeStart: Float32Array
  private readonly sizeEnd: Float32Array
  private readonly alpha: Float32Array
  private cursor = 0

  /**
   * @param capacity maximum simultaneous particles
   * @param drag velocity damping (1/s)
   */
  constructor(
    readonly capacity: number,
    private readonly drag: number,
  ) {
    this.offsets = new Float32Array(capacity * 3)
    this.colors = new Float32Array(capacity * 3)
    this.params = new Float32Array(capacity * 2)
    this.velocity = new Float32Array(capacity * 3)
    this.age = new Float32Array(capacity).fill(Infinity)
    this.life = new Float32Array(capacity).fill(1)
    this.sizeStart = new Float32Array(capacity)
    this.sizeEnd = new Float32Array(capacity)
    this.alpha = new Float32Array(capacity)
  }

  /** Starts a particle in the next slot, recycling the oldest one when full. Returns its slot. */
  spawn(
    position: XYZ,
    velocity: XYZ,
    life: number,
    sizeStart: number,
    sizeEnd: number,
    color: RGB,
    alpha: number,
  ): number {
    const slot = this.cursor
    this.cursor = (this.cursor + 1) % this.capacity
    const v = slot * 3
    this.offsets[v] = position.x
    this.offsets[v + 1] = position.y
    this.offsets[v + 2] = position.z
    this.velocity[v] = velocity.x
    this.velocity[v + 1] = velocity.y
    this.velocity[v + 2] = velocity.z
    this.colors[v] = color.r
    this.colors[v + 1] = color.g
    this.colors[v + 2] = color.b
    this.age[slot] = 0
    this.life[slot] = life
    this.sizeStart[slot] = sizeStart
    this.sizeEnd[slot] = sizeEnd
    this.alpha[slot] = alpha
    this.params[slot * 2] = sizeStart
    this.params[slot * 2 + 1] = alpha
    return slot
  }

  /** Ages and moves every live particle; dead ones collapse to zero size. */
  update(dt: number): void {
    const damping = Math.max(0, 1 - this.drag * dt)
    for (let slot = 0; slot < this.capacity; slot += 1) {
      if (!this.isAlive(slot)) continue
      const age = (this.age[slot] ?? 0) + dt
      this.age[slot] = age
      const life = this.life[slot] ?? 1
      const p = slot * 2
      if (age >= life) {
        this.params[p] = 0
        this.params[p + 1] = 0
        continue
      }
      const t = age / life
      const v = slot * 3
      for (let axis = 0; axis < 3; axis += 1) {
        const speed = (this.velocity[v + axis] ?? 0) * damping
        this.velocity[v + axis] = speed
        this.offsets[v + axis] = (this.offsets[v + axis] ?? 0) + speed * dt
      }
      const start = this.sizeStart[slot] ?? 0
      this.params[p] = start + ((this.sizeEnd[slot] ?? 0) - start) * t
      this.params[p + 1] = (this.alpha[slot] ?? 0) * (1 - t)
    }
  }

  isAlive(slot: number): boolean {
    return (this.age[slot] ?? Infinity) < (this.life[slot] ?? 0)
  }

  /** Number of particles still alive. */
  get aliveCount(): number {
    let count = 0
    for (let slot = 0; slot < this.capacity; slot += 1) if (this.isAlive(slot)) count += 1
    return count
  }
}
