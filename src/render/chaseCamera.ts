import type * as THREE from 'three'
import type { ChaseCameraConfig } from '../config/camera'
import { clamp, damp, forwardOf, type Vec3 } from '../sim/math'

/** Third-person camera that trails the kart and widens its view with speed. */
export class ChaseCamera {
  private initialized = false
  private lookingBack = false

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly config: ChaseCameraConfig,
  ) {}

  /**
   * @param speedRatio forward speed divided by top speed, 0..1
   * @param lookBack true to look behind the kart
   */
  update(target: Vec3, heading: number, speedRatio: number, lookBack: boolean, dt: number): void {
    const forward = forwardOf(heading)
    const side = lookBack ? -1 : 1
    const desired = {
      x: target.x - forward.x * this.config.distance * side,
      y: target.y + this.config.height,
      z: target.z - forward.z * this.config.distance * side,
    }

    const position = this.camera.position
    // Cut instead of sweeping through the kart when switching views
    if (!this.initialized || lookBack !== this.lookingBack) {
      position.set(desired.x, desired.y, desired.z)
      this.initialized = true
      this.lookingBack = lookBack
    } else {
      const k = this.config.followSmoothing
      position.set(
        damp(position.x, desired.x, k, dt),
        damp(position.y, desired.y, k, dt),
        damp(position.z, desired.z, k, dt),
      )
    }

    this.camera.lookAt(
      target.x + forward.x * this.config.lookAhead * side,
      target.y + this.config.lookHeight,
      target.z + forward.z * this.config.lookAhead * side,
    )

    const fov = this.config.baseFov + this.config.speedFovBoost * clamp(speedRatio, 0, 1)
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = damp(this.camera.fov, fov, 5, dt)
      this.camera.updateProjectionMatrix()
    }
  }

  /** Snap to the target on the next update, e.g. after a respawn. */
  reset(): void {
    this.initialized = false
  }
}
