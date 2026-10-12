import type { Vec2 } from '../math'

export interface Checkpoint {
  readonly index: number
  /** Position on track centerline (x, z). */
  readonly position: Vec2
  /** Unit vector facing along the track forward direction. */
  readonly forward: Vec2
  /** Total width of the checkpoint gate across the track (m). */
  readonly width: number
  /** Mandatory checkpoints must be visited to validate a lap. */
  readonly mandatory: boolean
}

export type CrossingResult = 'forward' | 'backward' | 'none'

/** 2D cross product: a.x * b.z - a.z * b.x */
function cross2D(a: Vec2, b: Vec2): number {
  return a.x * b.z - a.z * b.x
}

/** 2D dot product: a.x * b.x + a.z * b.z */
function dot2D(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.z * b.z
}

/** Returns the left and right gate endpoints across the track for this checkpoint. */
export function getCheckpointGate(checkpoint: Checkpoint, widthMultiplier = 1.2): [Vec2, Vec2] {
  const half = (checkpoint.width * widthMultiplier) / 2
  // Vector pointing to the driver's right: (forward.z, -forward.x)
  const right: Vec2 = { x: checkpoint.forward.z, z: -checkpoint.forward.x }
  const leftEnd: Vec2 = {
    x: checkpoint.position.x - right.x * half,
    z: checkpoint.position.z - right.z * half,
  }
  const rightEnd: Vec2 = {
    x: checkpoint.position.x + right.x * half,
    z: checkpoint.position.z + right.z * half,
  }
  return [leftEnd, rightEnd]
}

/**
 * Checks whether movement from `prevPos` to `currPos` crossed the checkpoint gate.
 * Returns 'forward' if crossed in driving direction, 'backward' if crossed opposite, or 'none'.
 */
export function checkGateCrossing(
  checkpoint: Checkpoint,
  prevPos: Vec2,
  currPos: Vec2,
  widthMultiplier = 1.2,
): CrossingResult {
  const [gateA, gateB] = getCheckpointGate(checkpoint, widthMultiplier)

  const ray: Vec2 = { x: currPos.x - prevPos.x, z: currPos.z - prevPos.z }
  const gateSeg: Vec2 = { x: gateB.x - gateA.x, z: gateB.z - gateA.z }

  const denom = cross2D(ray, gateSeg)
  if (Math.abs(denom) > 1e-6) {
    const qp: Vec2 = { x: gateA.x - prevPos.x, z: gateA.z - prevPos.z }
    const t = cross2D(qp, gateSeg) / denom
    const u = cross2D(qp, ray) / denom

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return dot2D(ray, checkpoint.forward) >= 0 ? 'forward' : 'backward'
    }
  }

  // Fallback for sub-step / stationary: check if kart is within small radius of checkpoint plane
  const toCurr: Vec2 = {
    x: currPos.x - checkpoint.position.x,
    z: currPos.z - checkpoint.position.z,
  }
  const toPrev: Vec2 = {
    x: prevPos.x - checkpoint.position.x,
    z: prevPos.z - checkpoint.position.z,
  }
  const forwardDistCurr = dot2D(toCurr, checkpoint.forward)
  const forwardDistPrev = dot2D(toPrev, checkpoint.forward)

  if (forwardDistPrev <= 0 && forwardDistCurr > 0) {
    const right: Vec2 = { x: checkpoint.forward.z, z: -checkpoint.forward.x }
    const sideDist = Math.abs(dot2D(toCurr, right))
    if (sideDist <= (checkpoint.width * widthMultiplier) / 2) {
      return 'forward'
    }
  } else if (forwardDistPrev >= 0 && forwardDistCurr < 0) {
    const right: Vec2 = { x: checkpoint.forward.z, z: -checkpoint.forward.x }
    const sideDist = Math.abs(dot2D(toCurr, right))
    if (sideDist <= (checkpoint.width * widthMultiplier) / 2) {
      return 'backward'
    }
  }

  return 'none'
}
