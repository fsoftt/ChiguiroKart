import * as THREE from 'three'
import type { CharacterId } from '../config/characters'
import type { KartState } from '../sim/kart/kartState'
import {
  actionWeight,
  driverAnimWeights,
  smoothWeights,
  zeroWeights,
  type RaceResult,
} from './characterAnimLogic'
import { createCharacterInstance, type CharacterInstance } from './characters/characterAssets'
import {
  actionClips,
  loopClips,
  type ActionClip,
  type KartBone,
  type LoopClip,
} from './characters/rig'
import { toonGradient } from './characters/toon'
import type { HitPose } from './items/itemViewLogic'
import { createSuspensionState, stepSuspension, type SuspensionState } from './kartSuspension'

const DEFAULT_GHOST_COLOR = '#8fd3ff'
/** Phase step between views, so a grid of idle drivers does not breathe in unison. */
const PHASE_STEP = 0.37

let instances = 0

/**
 * A racer on screen: a character's kart and driver (skinned model), their blended animation
 * and the procedural kart motion. Used for the player, the bots and the time trial ghost.
 */
export class CharacterView {
  readonly object = new THREE.Group()
  private model: CharacterInstance | null = null
  private mixer: THREE.AnimationMixer | null = null
  private loops = new Map<LoopClip, THREE.AnimationAction>()
  private actions = new Map<ActionClip, THREE.AnimationAction>()
  private playing: THREE.AnimationAction | null = null
  private bones: Partial<Record<KartBone, THREE.Bone>> = {}
  private chassisBaseY = 0
  private readonly weights = zeroWeights()
  private readonly suspension: SuspensionState = createSuspensionState()
  private airSeconds = 0
  private result: RaceResult | null = null
  private ghost: { opacity: number; color: string } | null = null
  private readonly phase = (instances++ * PHASE_STEP) % 1.3

  constructor(character: CharacterId) {
    this.object.rotation.order = 'YXZ'
    this.weights.idle = 1
    this.setCharacter(character)
  }

  /** Swaps the model for another character's, keeping the current state. */
  setCharacter(id: CharacterId): void {
    this.disposeModel()
    const model = createCharacterInstance(id)
    this.model = model
    this.object.add(model.object)
    for (const mesh of [model.mesh, model.outline]) mesh.frustumCulled = false

    this.bones = {}
    for (const name of [
      'chassis',
      'steerFL',
      'steerFR',
      'wheelFL',
      'wheelFR',
      'wheelRL',
      'wheelRR',
    ] as const) {
      const bone = model.mesh.skeleton.getBoneByName(name)
      if (bone) this.bones[name] = bone
    }
    this.chassisBaseY = this.bones.chassis?.position.y ?? 0

    const mixer = new THREE.AnimationMixer(model.object)
    this.mixer = mixer
    this.loops.clear()
    this.actions.clear()
    this.playing = null
    for (const animation of model.animations) {
      const name = animation.name
      const loop = loopClips.find((clip) => clip === name)
      const action = actionClips.find((clip) => clip === name)
      if (loop) {
        const loopAction = mixer.clipAction(animation)
        loopAction.play()
        loopAction.setEffectiveWeight(this.weights[loop])
        this.loops.set(loop, loopAction)
      } else if (action) {
        const oneShot = mixer.clipAction(animation)
        oneShot.setLoop(THREE.LoopOnce, 1)
        oneShot.clampWhenFinished = true
        this.actions.set(action, oneShot)
      }
    }
    mixer.update(this.phase)
    if (this.ghost) this.applyGhost(this.ghost.opacity, this.ghost.color)
  }

  /** Plays a one-shot over the loops: throw a power forward or backward. */
  playAction(action: ActionClip): void {
    const next = this.actions.get(action)
    if (!next) return
    this.playing?.stop()
    next.reset().play()
    this.playing = next
  }

  /** Victory or defeat dance until cleared with `null`. */
  setResult(result: RaceResult | null): void {
    this.result = result
  }

  /** Makes the whole racer one translucent, tinted color (used for the time trial ghost). */
  makeGhost(opacity: number, color: string = DEFAULT_GHOST_COLOR): void {
    this.ghost = { opacity, color }
    this.applyGhost(opacity, color)
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
    this.object.rotation.y = state.heading + (hit?.yaw ?? 0)
    this.object.rotation.x = hit?.pitch ?? 0

    this.airSeconds = state.onGround ? 0 : this.airSeconds + dt
    this.animateDriver(state, steer, dt, hit !== undefined && (hit.yaw !== 0 || hit.pitch !== 0))

    const pose = stepSuspension(
      this.suspension,
      {
        onGround: state.onGround,
        verticalSpeed: state.velocity.y,
        forwardSpeed: speed,
        steer,
        driftDirection: state.drift.direction,
        speedRatio,
      },
      dt,
    )
    const { chassis, steerFL, steerFR, wheelFL, wheelFR, wheelRL, wheelRR } = this.bones
    if (chassis) {
      chassis.position.y = this.chassisBaseY + pose.offsetY
      chassis.rotation.set(pose.pitch, 0, pose.roll)
      chassis.scale.set(pose.scaleXZ, pose.scaleY, pose.scaleXZ)
    }
    if (steerFL) steerFL.rotation.y = pose.steerAngle
    if (steerFR) steerFR.rotation.y = pose.steerAngle
    for (const wheel of [wheelFL, wheelFR, wheelRL, wheelRR]) {
      if (wheel) wheel.rotation.x = pose.wheelSpin
    }
  }

  private animateDriver(state: KartState, steer: number, dt: number, hit: boolean): void {
    const mixer = this.mixer
    if (!mixer) return
    const target = driverAnimWeights({
      steer,
      driftDirection: state.drift.direction,
      boostActive: state.boost.level > 0 && state.boost.timeLeft > 0,
      airTime: this.airSeconds,
      hit,
      result: this.result,
    })
    smoothWeights(this.weights, target, dt)

    // The one-shot fades in and out over the loops, which make room for it
    let actionShare = 0
    const playing = this.playing
    if (playing) {
      const duration = playing.getClip().duration
      actionShare = actionWeight(playing.time, duration)
      playing.setEffectiveWeight(actionShare)
      if (playing.time >= duration) {
        playing.stop()
        this.playing = null
      }
    }
    for (const [name, action] of this.loops) {
      action.setEffectiveWeight(this.weights[name] * (1 - actionShare))
    }
    mixer.update(dt)
  }

  private applyGhost(opacity: number, color: string): void {
    const model = this.model
    if (!model) return
    disposeMaterials(model.mesh)
    model.mesh.material = new THREE.MeshToonMaterial({
      color,
      gradientMap: toonGradient(),
      transparent: true,
      opacity,
      depthWrite: false,
    })
    model.outline.visible = false
  }

  private disposeModel(): void {
    const model = this.model
    if (!model) return
    this.mixer?.stopAllAction()
    this.mixer?.uncacheRoot(model.object)
    this.object.remove(model.object)
    for (const mesh of [model.mesh, model.outline]) {
      disposeMaterials(mesh)
    }
    this.model = null
  }
}

function disposeMaterials(mesh: THREE.Mesh): void {
  for (const material of [mesh.material].flat()) material.dispose()
}
