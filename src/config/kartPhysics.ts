/** Tunable values for the arcade kart model. Distances in meters, time in seconds. */
export interface KartPhysicsConfig {
  /** Top forward speed (m/s). */
  maxSpeed: number
  /** Top reverse speed (m/s). */
  maxReverseSpeed: number
  /** Forward acceleration at full throttle (m/s²). */
  acceleration: number
  /** Deceleration when braking against the direction of travel (m/s²). */
  brakeDeceleration: number
  /** Acceleration in reverse (m/s²). */
  reverseAcceleration: number
  /** Deceleration with no throttle or brake (m/s²). */
  coastDeceleration: number
  /** Turn rate at full steer (rad/s). */
  turnRate: number
  /** Speed at which the full turn rate becomes available (m/s). */
  turnSpeedReference: number
  /** Fraction of the turn rate kept at top speed. */
  highSpeedTurnFactor: number
  /** How fast sideways velocity is removed (1/s). Higher = more grip. */
  lateralGrip: number
  /** Downward acceleration (m/s²). Higher than real for snappy jumps. */
  gravity: number
  /** Ground dropping away by up to this much (m) in one step keeps a grounded kart on it. */
  groundSnapDistance: number
  /** Collision radius against walls (m). */
  radius: number
  /** Collision radius against other karts (m). Karts are circles in the XZ plane. */
  kartRadius: number
  /** Karts whose vertical gap exceeds this (m) do not collide, e.g. one jumping over another. */
  kartHeight: number
  /** Fraction of the approach speed bounced back in a kart-vs-kart hit. */
  kartRestitution: number
  /** Fraction of the into-wall speed bounced back. */
  wallBounce: number
  /** Along-wall speed lost per unit of into-wall speed on impact (friction coefficient). */
  wallFriction: number
  /** How fast a kart scraping a wall turns to run along it (1/s). */
  wallAlignRate: number
  /** Hits more head-on than this angle from the wall (rad) only bounce, without aligning. */
  wallAlignMaxAngle: number
}

export const defaultKartPhysics: KartPhysicsConfig = {
  maxSpeed: 28,
  maxReverseSpeed: 8,
  acceleration: 16,
  brakeDeceleration: 35,
  reverseAcceleration: 10,
  coastDeceleration: 6,
  turnRate: 2.4,
  turnSpeedReference: 6,
  highSpeedTurnFactor: 0.6,
  lateralGrip: 8,
  gravity: 30,
  groundSnapDistance: 0.4,
  radius: 0.9,
  kartRadius: 1.1,
  kartHeight: 1.2,
  kartRestitution: 0.4,
  wallBounce: 0.3,
  wallFriction: 0.5,
  wallAlignRate: 10,
  wallAlignMaxAngle: (70 * Math.PI) / 180,
}
