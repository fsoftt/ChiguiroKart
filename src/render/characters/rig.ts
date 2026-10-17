/**
 * Contract between character model files (`public/models/<id>.glb`) and the game.
 * Any model, procedural or made in Blender, must provide these bones and clips so it can
 * replace another without code changes.
 *
 * One skinned mesh per racer holds the kart and its driver. The kart bones (`chassis`, wheels)
 * are animated procedurally; the driver bones are animated by the clips below.
 */

export const kartBones = [
  'root',
  'chassis',
  'steerFL',
  'steerFR',
  'wheelFL',
  'wheelFR',
  'wheelRL',
  'wheelRR',
] as const

/** `earL`/`earR` are ears, crest feathers or fins depending on the animal; `tail` may be unused. */
export const driverBones = ['body', 'head', 'armL', 'armR', 'earL', 'earR', 'tail'] as const

export type KartBone = (typeof kartBones)[number]
export type DriverBone = (typeof driverBones)[number]
export type BoneName = KartBone | DriverBone

export const boneNames: readonly BoneName[] = [...kartBones, ...driverBones]

/** Parent of each bone (`root` has none). */
export const boneParents: Record<Exclude<BoneName, 'root'>, BoneName> = {
  chassis: 'root',
  steerFL: 'root',
  steerFR: 'root',
  wheelFL: 'steerFL',
  wheelFR: 'steerFR',
  wheelRL: 'root',
  wheelRR: 'root',
  body: 'chassis',
  head: 'body',
  armL: 'body',
  armR: 'body',
  earL: 'head',
  earR: 'head',
  tail: 'body',
}

/** Looping clips blended by driving state. */
export const loopClips = [
  'idle',
  'steerLeft',
  'steerRight',
  'drift',
  'boost',
  'air',
  'hit',
  'victory',
  'defeat',
] as const

/** One-shot clips played over the loops. */
export const actionClips = ['throwForward', 'throwBack'] as const

export type LoopClip = (typeof loopClips)[number]
export type ActionClip = (typeof actionClips)[number]
export type ClipName = LoopClip | ActionClip

export const clipNames: readonly ClipName[] = [...loopClips, ...actionClips]

/** Name of the single skinned mesh inside a model file. */
export const RACER_MESH_NAME = 'racer'

/** Wheel radius the models are built with (m), used to spin the wheels from the speed. */
export const WHEEL_RADIUS = 0.35
