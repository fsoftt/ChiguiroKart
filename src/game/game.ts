import * as THREE from 'three'
import { defaultChaseCamera } from '../config/camera'
import { defaultDrift } from '../config/drift'
import { defaultEffects } from '../config/effects'
import { defaultKartPhysics } from '../config/kartPhysics'
import { cocoraTrack } from '../config/tracks/cocoraTrack'
import { testTrack } from '../config/tracks/testTrack'
import { GamepadSource } from '../input/gamepad'
import { combineInputs, type InputSource, type KartInput } from '../input/kartInput'
import { KeyboardSource } from '../input/keyboard'
import { ChaseCamera } from '../render/chaseCamera'
import { createScene, resizeToCanvas, type SceneContext } from '../render/createScene'
import { speedLineTarget } from '../render/effects/effectsLogic'
import { KartEffects } from '../render/effects/kartEffects'
import { KartFeedback } from '../render/effects/kartFeedback'
import { SpeedLines } from '../render/effects/speedLines'
import { KartView } from '../render/kartView'
import { createTrackView } from '../render/trackView'
import { FixedStep } from '../sim/fixedStep'
import { forwardSpeed } from '../sim/kart/kartPhysics'
import { cloneKartState, interpolateKart, type KartState } from '../sim/kart/kartState'
import type { TrackDefinition } from '../sim/track'
import { RaceWorld } from '../sim/world'
import { saveTrackRecord } from '../sim/race/records'
import { createDebugPanel, isDebugEnabled, type DebugReadout } from '../ui/debugPanel'
import { FpsOverlay } from '../ui/fpsOverlay'
import { Hud } from '../ui/hud'
import { buildHudModel } from '../ui/hudModel'
import { BotManager } from '../sim/botManager'
import { SimpleBot } from '../input/botInput'

const SIMULATION_HZ = 60
const RESET_KEY = 'KeyR'
const MS_PER_KMH = 3.6
const SPEED_LINE_STREAKS = 90

function selectTrack(): TrackDefinition {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.get('pista') === 'test') return testTrack
  }
  return cocoraTrack
}

/** Wires input, simulation and rendering together and runs the frame loop. */
export class Game {
  private readonly physics = { ...defaultKartPhysics }
  private readonly driftConfig = { ...defaultDrift }
  private readonly effectsConfig = defaultEffects
  private readonly cameraConfig = { ...defaultChaseCamera }
  private readonly trackDefinition = selectTrack()
  private readonly world = new RaceWorld(this.trackDefinition, this.physics, this.driftConfig)
  private readonly fixedStep = new FixedStep(1 / SIMULATION_HZ)
  private readonly timer = new THREE.Timer()

  private readonly scene: SceneContext
  private readonly kartView = new KartView()
  private readonly kartEffects = new KartEffects(defaultEffects, this.driftConfig)
  private readonly speedLines = new SpeedLines(SPEED_LINE_STREAKS, defaultEffects.speedLines.color)
  private readonly kartFeedback = new KartFeedback(defaultEffects.camera)
  private readonly chaseCamera: ChaseCamera
  private readonly botManager: BotManager
  private readonly inputSources: InputSource[] = [new KeyboardSource(), new GamepadSource()]
  private readonly fpsOverlay: FpsOverlay | null
  private readonly hud = new Hud()
  private readonly readout: DebugReadout = { speedKmh: 0, onGround: true }

  private previousKart: KartState
  private hasSavedRecord = false

  constructor(canvas: HTMLCanvasElement) {
    this.scene = createScene(canvas)
    this.scene.scene.add(
      createTrackView(this.world.track),
      this.kartView.object,
      this.kartEffects.object,
      this.speedLines.object,
    )
    this.chaseCamera = new ChaseCamera(this.scene.camera, this.cameraConfig)
    this.previousKart = cloneKartState(this.world.kart)
    // Initialize BotManager and add a simple AI bot
    this.botManager = new BotManager(this.world, this.physics, this.driftConfig)
    this.botManager.addBot(new SimpleBot())

    this.hud.setTrack(this.world.track)

    const debug = isDebugEnabled()
    this.fpsOverlay = debug ? new FpsOverlay() : null
    if (debug) {
      void createDebugPanel({
        physics: this.physics,
        drift: this.driftConfig,
        camera: this.cameraConfig,
        readout: this.readout,
        onReset: () => this.resetKart(),
      })
    }
    window.addEventListener('keydown', (event) => {
      if (event.code === RESET_KEY) this.resetKart()
    })
  }

  start(): void {
    this.scene.renderer.setAnimationLoop((time) => this.frame(time))
  }

  private frame(time: number): void {
    this.timer.update(time)
    const dt = this.timer.getDelta()
    const input = combineInputs(this.inputSources.map((source) => source.read()))

    const alpha = this.fixedStep.advance(dt, (stepSeconds) => {
      this.previousKart = cloneKartState(this.world.kart)
      this.world.step(input, stepSeconds)
      this.botManager.update(stepSeconds)
    })

    this.render(interpolateKart(this.previousKart, this.world.kart, alpha), input, dt)
  }

  private render(kart: KartState, input: KartInput, dt: number): void {
    const speed = forwardSpeed(kart)
    const speedRatio = speed / this.physics.maxSpeed

    resizeToCanvas(this.scene)
    this.kartView.update(kart, input.steer, speed, speedRatio, dt)
    this.kartEffects.update(kart, speedRatio, dt)

    const feedback = this.kartFeedback.update(kart.boost, kart.drift, this.timer.getElapsed(), dt)
    this.chaseCamera.update(kart.position, kart.heading, speedRatio, input.lookBack, dt, feedback)
    this.speedLines.update(
      speedLineTarget(speedRatio, kart.boost.level, this.effectsConfig.speedLines),
      dt,
    )

    this.hud.update(
      buildHudModel(kart, this.physics, this.driftConfig, this.world.raceManager.state),
      { x: kart.position.x, z: kart.position.z },
      kart.heading,
    )

    if (this.world.raceManager.state.phase === 'finished' && !this.hasSavedRecord) {
      this.hasSavedRecord = true
      saveTrackRecord(
        this.world.track.name,
        this.world.raceManager.state.totalRaceTime,
        this.world.raceManager.state.bestLapTime ?? this.world.raceManager.state.totalRaceTime,
      )
    }

    this.scene.renderer.render(this.scene.scene, this.scene.camera)

    this.readout.speedKmh = Math.abs(speed) * MS_PER_KMH
    this.readout.onGround = kart.onGround
    this.fpsOverlay?.update(dt)
  }

  private resetKart(): void {
    this.hasSavedRecord = false
    this.world.resetKart()
    this.previousKart = cloneKartState(this.world.kart)
    this.chaseCamera.reset()
  }
}
