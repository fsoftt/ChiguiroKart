/**
 * Bot tuning: one profile per difficulty plus the rubber band ("remontada") help.
 * Values from docs/diseno.md §9, to be tuned in play tests.
 */

export type BotDifficulty = 'facil' | 'normal' | 'dificil'

export const BOT_DIFFICULTIES: readonly BotDifficulty[] = ['facil', 'normal', 'dificil']

export interface BotDifficultyConfig {
  /** Share of the kart's top speed the bot can use (applied as the racer's speed scale). */
  speedFactor: number
  /** Share of the top speed kept in the sharpest turns (higher = brakes less = more daring). */
  cornerSpeedFactor: number
  /** Distance the bot aims ahead of the kart at standstill (m). */
  lookaheadBase: number
  /** Extra aim distance per second of travel (m per m/s). */
  lookaheadTime: number
  /** Largest sideways deviation from the line (m). */
  wanderAmplitude: number
  /** How fast the deviation drifts toward a new random value (1/s). */
  wanderRate: number
  /** Path turn (rad) over the drift window that makes the bot start a drift. */
  driftTurnAngle: number
  /** Most nitros the bot fires in one drift, 0..3. 0 disables drifting. */
  maxNitros: number
  /** Latest the bot presses boost after the red zone starts, as charge (0.06 = perfect window). */
  nitroTimingError: number
  /** Chance per nitro of firing too early, which breaks the chain. */
  nitroMistakeChance: number
  /** Chance of taking a shortcut each time one comes up. */
  shortcutChance: number
  /** Chance of timing the start boost. */
  startBoostChance: number
  /** Seconds the bot waits after getting a power before using it. */
  itemReactionDelay: number
  /** Chance (0..1) per power of using it on purpose (traps, shield); otherwise it waits for the hold timeout. */
  itemDefensiveChance: number
  /** Steering noise (0..1) added while blinded by mosquitos. */
  blindSteerNoise: number
  /** Share of the look-ahead distance kept while blinded (< 1 = shorter). */
  blindLookaheadScale: number
  /** Chance of hopping at a jump lip, which earns the landing nitro. */
  jumpTrickChance: number
  /** True if the bot only throws panela on a straight; false = right away. */
  panelaNeedsStraight: boolean
}

export const botDifficulties: Record<BotDifficulty, BotDifficultyConfig> = {
  facil: {
    speedFactor: 0.88,
    cornerSpeedFactor: 0.6,
    lookaheadBase: 6,
    lookaheadTime: 0.3,
    wanderAmplitude: 3,
    wanderRate: 1,
    driftTurnAngle: 0.7,
    maxNitros: 1,
    nitroTimingError: 0.2,
    nitroMistakeChance: 0.35,
    shortcutChance: 0.15,
    startBoostChance: 0,
    itemReactionDelay: 1.5,
    itemDefensiveChance: 0.5,
    blindSteerNoise: 0.6,
    blindLookaheadScale: 0.6,
    jumpTrickChance: 0.3,
    panelaNeedsStraight: false,
  },
  normal: {
    speedFactor: 0.93,
    cornerSpeedFactor: 0.7,
    lookaheadBase: 5,
    lookaheadTime: 0.3,
    wanderAmplitude: 2,
    wanderRate: 1.3,
    driftTurnAngle: 0.5,
    maxNitros: 2,
    nitroTimingError: 0.1,
    nitroMistakeChance: 0.1,
    shortcutChance: 0.5,
    startBoostChance: 0.5,
    itemReactionDelay: 0.8,
    itemDefensiveChance: 0.8,
    blindSteerNoise: 0.4,
    blindLookaheadScale: 0.75,
    jumpTrickChance: 0.7,
    panelaNeedsStraight: true,
  },
  dificil: {
    speedFactor: 0.94,
    cornerSpeedFactor: 0.8,
    lookaheadBase: 5,
    lookaheadTime: 0.3,
    wanderAmplitude: 1,
    wanderRate: 1.6,
    driftTurnAngle: 0.4,
    maxNitros: 3,
    nitroTimingError: 0.05,
    nitroMistakeChance: 0.05,
    shortcutChance: 0.85,
    startBoostChance: 0.9,
    itemReactionDelay: 0.3,
    itemDefensiveChance: 0.95,
    blindSteerNoise: 0.25,
    blindLookaheadScale: 0.85,
    jumpTrickChance: 0.95,
    panelaNeedsStraight: true,
  },
}

/** Rubber band: bots far behind the player speed up a little, bots far ahead slow down. */
export interface RubberBandConfig {
  enabled: boolean
  /** Gap to the player (m) under which bots get no help or penalty. */
  deadZone: number
  /** Gap (m) at which the help or penalty reaches its maximum. */
  fullGap: number
  /** Largest speed bonus for a bot far behind (0.06 = +6 %). */
  maxBonus: number
  /** Largest speed penalty for a bot far ahead (0.04 = -4 %). */
  maxPenalty: number
  /** How fast the factor follows its target (1/s), so it never jumps. */
  smoothing: number
}

export const defaultRubberBand: RubberBandConfig = {
  enabled: true,
  deadZone: 25,
  fullGap: 150,
  maxBonus: 0.06,
  maxPenalty: 0.04,
  smoothing: 1,
}

/** Driving behaviour shared by every difficulty. Distances in meters, angles in radians. */
export interface BotBehaviorConfig {
  /** Steering per radian of heading error toward the aim point. */
  steerGain: number
  /** How fast the steering follows its target (1/s). */
  steerSmoothing: number
  /** Segments searched ahead of the previous position when tracking progress. */
  routeWindow: number
  /** Distance from a branch end at which the bot counts as having left it. */
  branchExitRadius: number
  /** How far before a branch start the bot rolls for taking it. */
  shortcutDecisionDistance: number
  /** Distance kept between the aim point and the walls. */
  wallMargin: number
  /** Share of the corridor half-width (0..1) beyond which the bot pulls back to the center. */
  wallBiasStart: number
  /** Heading change (rad) over the look-ahead that counts as the sharpest turn. */
  sharpTurnAngle: number
  /** Shortest and longest distance (m) looked ahead for turns. */
  turnHorizonMin: number
  turnHorizonMax: number
  /** Seconds of travel covered by the turn look-ahead. */
  turnHorizonTime: number
  /** Speed above the target (m/s) before the bot brakes instead of just lifting. */
  brakeMargin: number
  /** Drift: distance (m) over which the turn that starts a drift is measured. */
  driftWindow: number
  /** Drift starts only if the turn over twice the drift window is at least this multiple of the turn over one. */
  driftSustain: number
  /** Drift: distance (m) ahead over which the turn left is measured to start and end a drift. */
  driftEndWindow: number
  /** Drift starts only if the route already turns this much (rad) over the end window. */
  driftStartTurn: number
  /** Drift ends when the turn left ahead falls under this angle. */
  driftEndAngle: number
  /** Drift starts only above this multiple of the minimum drift speed. */
  driftSpeedMargin: number
  /** Share (0..1) of the steering error taken from the velocity direction instead of the heading while drifting. */
  driftCourseWeight: number
  /** Steer magnitude held during the hop so the landing starts the drift. */
  hopSteer: number
  /** Seconds before giving up on a hop that did not start a drift. */
  hopTimeout: number
  /** Seconds before another drift may start. */
  driftCooldown: number
  /** Seconds ahead used to predict a wall hit while drifting. */
  wallLookahead: number
  /** Distance to the corridor edge (m) that counts as a wall hit while drifting. */
  driftWallMargin: number
  /** Karts closer than this ahead (m) in the forward cone are avoided. */
  avoidDistance: number
  /** Half-angle of the avoidance cone. */
  avoidConeAngle: number
  /** Track obstacles closer than this ahead (m), measured to their edge, are avoided. */
  obstacleAvoidDistance: number
  /** Extra clearance (m) kept from an obstacle edge when passing it. */
  obstacleMargin: number
  /** Sideways shift used to pass a kart (m). */
  avoidOffset: number
  /** How fast the passing shift follows its target (1/s). */
  avoidSmoothing: number
  /** Seconds the chosen passing side is kept. */
  avoidHold: number
  /** Below this speed (m/s) the bot counts as stuck. */
  stuckSpeed: number
  /** Seconds stuck before reversing. */
  stuckTime: number
  /** Seconds spent reversing. */
  reverseTime: number
  /** The start boost is pressed when this many seconds or fewer remain (< 0.35 or it stalls). */
  startPressWindow: number
  /** Items: a rival ahead within this distance (m) and cone is a target for coco and armadillo. */
  itemCocoRange: number
  /** Items: half-angle of the forward firing cone. */
  itemConeAngle: number
  /** Items: a rival behind within this distance (m) triggers traps, shield and backward coco. */
  itemBackRange: number
  /** Items: sideways half-width (m) of the zone behind that counts as "behind". */
  itemBackWidth: number
  /** Items: reach (m) of avispa and hormigas toward a rival ahead in the standings. */
  itemHomingRange: number
  /** Items: reach (m) of the sombrero toward a rival ahead. */
  itemSombreroRange: number
  /** Items: distance (m) to the leader above which rayo and colibri are worth using. */
  itemLeaderGap: number
  /** Items: seconds holding any power before it is used regardless of the situation. */
  itemHoldTimeout: number
  /** Items: seconds between presses when a power has several uses. */
  itemUseGap: number
  /** Items: seconds the armadillo shield is kept up before throwing it anyway. */
  itemShieldHold: number
  /** Items: upcoming turn (rad) under which the road counts as a straight. */
  itemStraightTurn: number
}

export const botBehavior: BotBehaviorConfig = {
  steerGain: 2,
  steerSmoothing: 14,
  routeWindow: 24,
  branchExitRadius: 5,
  shortcutDecisionDistance: 70,
  wallMargin: 3.5,
  wallBiasStart: 0.6,
  sharpTurnAngle: 1.2,
  turnHorizonMin: 20,
  turnHorizonMax: 45,
  turnHorizonTime: 1,
  brakeMargin: 3,
  driftWindow: 30,
  driftSustain: 1.2,
  driftEndWindow: 25,
  driftEndAngle: 0.1,
  driftStartTurn: 0.12,
  driftSpeedMargin: 1.5,
  driftCourseWeight: 0.5,
  hopSteer: 0.7,
  hopTimeout: 0.8,
  driftCooldown: 0.6,
  wallLookahead: 0.35,
  driftWallMargin: 0.4,
  avoidDistance: 12,
  avoidConeAngle: (35 * Math.PI) / 180,
  obstacleAvoidDistance: 26,
  obstacleMargin: 1.5,
  avoidOffset: 3.2,
  avoidSmoothing: 3,
  avoidHold: 0.8,
  stuckSpeed: 1.2,
  stuckTime: 1.5,
  reverseTime: 1,
  startPressWindow: 0.3,
  itemCocoRange: 25,
  itemConeAngle: (15 * Math.PI) / 180,
  itemBackRange: 15,
  itemBackWidth: 4,
  itemHomingRange: 120,
  itemSombreroRange: 30,
  itemLeaderGap: 40,
  itemHoldTimeout: 8,
  itemUseGap: 0.4,
  itemShieldHold: 3,
  itemStraightTurn: 0.2,
}
