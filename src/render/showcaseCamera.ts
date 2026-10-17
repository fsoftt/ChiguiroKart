import type * as THREE from 'three'
import { damp, forwardOf, type Vec3 } from '../sim/math'

/** Camera poses for a kart on display: the menu showroom and the front view at the finish. */

const SHOWROOM_DISTANCE = 7
const SHOWROOM_HEIGHT = 2.4
const SHOWROOM_LOOK_HEIGHT = 0.9
const SHOWROOM_FOV = 36
/** Orbit swing (rad) around the front of the kart and its speed (rad/s). */
const SHOWROOM_SWING = 0.75
const SHOWROOM_SWING_SPEED = 0.35
/** The menu panel covers the left of the screen: this share of the half width shifts the kart right. */
const SHOWROOM_SHIFT = 0.28

const FINISH_DISTANCE = 6.5
const FINISH_SIDE = 1.6
const FINISH_HEIGHT = 2.6
const FINISH_LOOK_HEIGHT = 1.0
const FINISH_FOV = 52
const FINISH_SMOOTHING = 2.5
/** The results card covers the left of the screen: shift the kart right, like the showroom. */
const FINISH_SHIFT = 0.5

/** Where the showroom camera stands at `time`: swinging slowly in front of the kart. */
export function showroomPosition(target: Vec3, heading: number, time: number): Vec3 {
  const angle = heading + Math.sin(time * SHOWROOM_SWING_SPEED) * SHOWROOM_SWING
  const direction = forwardOf(angle)
  return {
    x: target.x + direction.x * SHOWROOM_DISTANCE,
    y: target.y + SHOWROOM_HEIGHT,
    z: target.z + direction.z * SHOWROOM_DISTANCE,
  }
}

/** Where the finish camera wants to be: in front of, beside and above the kart. */
export function finishPosition(target: Vec3, heading: number): Vec3 {
  const forward = forwardOf(heading)
  // Perpendicular to the heading, on the kart's left
  return {
    x: target.x + forward.x * FINISH_DISTANCE + forward.z * FINISH_SIDE,
    y: target.y + FINISH_HEIGHT,
    z: target.z + forward.z * FINISH_DISTANCE - forward.x * FINISH_SIDE,
  }
}

/** Slow orbit in front of the kart, framing it right of center (the menu is on the left). */
export function placeShowroomCamera(
  camera: THREE.PerspectiveCamera,
  target: Vec3,
  heading: number,
  time: number,
): void {
  const position = showroomPosition(target, heading, time)
  camera.position.set(position.x, position.y, position.z)
  camera.lookAt(target.x, target.y + SHOWROOM_LOOK_HEIGHT, target.z)
  const halfWidth = Math.tan((SHOWROOM_FOV * Math.PI) / 360) * SHOWROOM_DISTANCE * camera.aspect
  if (camera.aspect > 1) camera.translateX(-halfWidth * SHOWROOM_SHIFT)
  if (camera.fov !== SHOWROOM_FOV) {
    camera.fov = SHOWROOM_FOV
    camera.updateProjectionMatrix()
  }
}

/** Glides to a front view of the kart, looking at it. */
export function placeFinishCamera(
  camera: THREE.PerspectiveCamera,
  target: Vec3,
  heading: number,
  dt: number,
): void {
  const goal = finishPosition(target, heading)
  // Shift goal and aim together along the camera's left, so the kart sits right of center
  const fx = target.x - goal.x
  const fz = target.z - goal.z
  const length = Math.hypot(fx, fz) || 1
  const halfWidth = Math.tan((camera.fov * Math.PI) / 360) * FINISH_DISTANCE * camera.aspect
  const shift = camera.aspect > 1 ? halfWidth * FINISH_SHIFT : 0
  const sx = (fz / length) * shift
  const sz = (-fx / length) * shift
  const position = camera.position
  position.set(
    damp(position.x, goal.x + sx, FINISH_SMOOTHING, dt),
    damp(position.y, goal.y, FINISH_SMOOTHING, dt),
    damp(position.z, goal.z + sz, FINISH_SMOOTHING, dt),
  )
  camera.lookAt(target.x + sx, target.y + FINISH_LOOK_HEIGHT, target.z + sz)
  const fov = damp(camera.fov, FINISH_FOV, FINISH_SMOOTHING, dt)
  if (Math.abs(fov - camera.fov) > 0.01) {
    camera.fov = fov
    camera.updateProjectionMatrix()
  }
}
