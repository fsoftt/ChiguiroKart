import * as THREE from 'three'
import { clamp, damp } from '../../sim/math'

/**
 * Radial streaks that rush past the camera at high speed. Rendered as one line cloud in view
 * space, so the streaks stay centred on the screen no matter how the kart turns. Intensity is
 * smoothed toward its target so the effect fades in and out instead of popping.
 */
export class SpeedLines {
  readonly object = new THREE.Group()

  private readonly geometry = new THREE.BufferGeometry()
  private readonly material: THREE.LineBasicMaterial
  private readonly positions: Float32Array
  private intensity = 0

  constructor(count: number, color: string) {
    // Two vertices per streak: an inner and an outer end
    this.positions = new Float32Array(count * 2 * 3)
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.material = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    })
    this.object.add(new THREE.LineSegments(this.geometry, this.material))
    this.object.frustumCulled = false
    this.seedStreaks(count)
  }

  /**
   * @param target strength 0..1, from the speed lines logic
   * @param dt seconds since the previous frame
   */
  update(target: number, dt: number): void {
    this.intensity = damp(this.intensity, clamp(target, 0, 1), 6, dt)
    this.material.opacity = this.intensity * MAX_OPACITY
    this.object.visible = this.intensity > 0.001
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }

  /** Lays the streaks on a ring around the view axis, pointing outward. */
  private seedStreaks(count: number): void {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * ANGLE_JITTER
      const radius = INNER_RADIUS + Math.random() * (OUTER_RADIUS - INNER_RADIUS)
      const directionX = Math.cos(angle)
      const directionY = Math.sin(angle)
      const inner = i * 6
      this.positions[inner] = directionX * radius
      this.positions[inner + 1] = directionY * radius
      this.positions[inner + 2] = -INNER_DEPTH
      this.positions[inner + 3] = directionX * (radius + STREAK_LENGTH)
      this.positions[inner + 4] = directionY * (radius + STREAK_LENGTH)
      this.positions[inner + 5] = -OUTER_DEPTH
    }
  }
}

const MAX_OPACITY = 0.55
const INNER_RADIUS = 2.5
const OUTER_RADIUS = 9
const INNER_DEPTH = -6
const OUTER_DEPTH = -24
const STREAK_LENGTH = 6
const ANGLE_JITTER = 0.12
