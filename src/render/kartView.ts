import * as THREE from 'three'
import { damp } from '../sim/math'
import type { KartState } from '../sim/kart/kartState'
import type { HitPose } from './items/itemViewLogic'

const BODY_COLOR = '#e8413c'
const DRIVER_COLOR = '#a0673a'
const WHEEL_COLOR = '#222222'

const WHEEL_RADIUS = 0.35
const MAX_WHEEL_STEER = 0.45 // radians
const MAX_BODY_ROLL = 0.08 // radians
const ROLL_SMOOTHING = 8

/** Placeholder kart: a toon-shaded box kart with a round driver, until real models (stage 6). */
export class KartView {
  readonly object = new THREE.Group()
  private readonly body = new THREE.Group()
  private readonly wheels: THREE.Mesh[] = []
  private readonly frontWheelPivots: THREE.Group[] = []
  private roll = 0

  constructor(bodyColor: string = BODY_COLOR) {
    const toon = (color: string): THREE.MeshToonMaterial => new THREE.MeshToonMaterial({ color })

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 2.1), toon(bodyColor))
    chassis.position.y = 0.45
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.6), toon(bodyColor))
    nose.position.set(0, 0.45, 1.25)
    const driver = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), toon(DRIVER_COLOR))
    driver.position.set(0, 1.05, -0.2)
    driver.scale.set(1, 0.9, 1.2)
    this.body.add(chassis, nose, driver)
    this.object.add(this.body)

    const wheelGeometry = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.3, 12)
    wheelGeometry.rotateZ(Math.PI / 2)
    const wheelMaterial = toon(WHEEL_COLOR)
    for (const [x, z, isFront] of [
      [-0.75, 0.75, true],
      [0.75, 0.75, true],
      [-0.75, -0.75, false],
      [0.75, -0.75, false],
    ] as const) {
      const pivot = new THREE.Group()
      pivot.position.set(x, WHEEL_RADIUS, z)
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial)
      pivot.add(wheel)
      this.object.add(pivot)
      this.wheels.push(wheel)
      if (isFront) this.frontWheelPivots.push(pivot)
    }
  }

  /**
   * @param speed forward speed (m/s)
   * @param speedRatio forward speed divided by top speed
   * @param hit extra spin-out yaw and flip pitch from a hit (see `hitPoseInto`)
   */
  update(
    state: KartState,
    steer: number,
    speed: number,
    speedRatio: number,
    dt: number,
    hit?: HitPose,
  ): void {
    this.object.position.set(state.position.x, state.position.y, state.position.z)
    this.object.rotation.order = 'YXZ'
    this.object.rotation.y = state.heading + (hit?.yaw ?? 0)
    this.object.rotation.x = hit?.pitch ?? 0

    for (const wheel of this.wheels) wheel.rotation.x += (speed / WHEEL_RADIUS) * dt
    for (const pivot of this.frontWheelPivots) pivot.rotation.y = -steer * MAX_WHEEL_STEER

    // Lean out of the turn, more at speed (positive roll tilts toward the kart's right)
    const targetRoll = -steer * MAX_BODY_ROLL * Math.min(Math.abs(speedRatio), 1)
    this.roll = damp(this.roll, targetRoll, ROLL_SMOOTHING, dt)
    this.body.rotation.z = this.roll
  }
}
