import * as THREE from 'three'
import { defaultChaseCamera } from '../config/camera'
import { defaultDrift } from '../config/drift'
import { defaultKartPhysics } from '../config/kartPhysics'
import { testTrack } from '../config/tracks/testTrack'
import { GamepadSource } from '../input/gamepad'
import { combineInputs, type InputSource, type KartInput } from '../input/kartInput'
import { KeyboardSource } from '../input/keyboard'
import { ChaseCamera } from '../render/chaseCamera'
import { createScene, resizeToCanvas, type SceneContext } from '../render/createScene'
import { KartView } from '../render/kartView'
import { createTrackView } from '../render/trackView'
import { FixedStep } from '../sim/fixedStep'
import { forwardSpeed } from '../sim/kart/kartPhysics'
import { cloneKartState, interpolateKart, type KartState } from '../sim/kart/kartState'
import { RaceWorld } from '../sim/world'
import { createDebugPanel, isDebugEnabled, type DebugReadout } from '../ui/debugPanel'
import { FpsOverlay } from '../ui/fpsOverlay'
import { Hud } from '../ui/hud'
import { buildHudModel } from '../ui/hudModel'

const SIMULATION_HZ = 60
const RESET_KEY = 'KeyR'
const MS_PER_KMH = 3.6

/** Wires input, simulation and rendering together and runs the frame loop. */
export class Game {
  private readonly physics = { ...defaultKartPhysics }
  private readonly driftConfig = { ...defaultDrift }
  private readonly cameraConfig = { ...defaultChaseCamera }
  private readonly world = new RaceWorld(testTrack, this.physics, this.driftConfig)
  private readonly fixedStep = new FixedStep(1 / SIMULATION_HZ)
  private readonly timer = new THREE.Timer()

  private readonly scene: SceneContext
  private readonly kartView = new KartView()
  private readonly chaseCamera: ChaseCamera
  private readonly inputSources: InputSource[] = [new KeyboardSource(), new GamepadSource()]
  private readonly fpsOverlay: FpsOverlay | null
  private readonly hud = new Hud()
  private readonly readout: DebugReadout = { speedKmh: 0, onGround: true }

  private previousKart: KartState

  constructor(canvas: HTMLCanvasElement) {
    this.scene = createScene(canvas)
    this.scene.scene.add(createTrackView(this.world.track), this.kartView.object)
    this.chaseCamera = new ChaseCamera(this.scene.camera, this.cameraConfig)
    this.previousKart = cloneKartState(this.world.kart)

    const debug = isDebugEnabled()
    this.fpsOverlay = debug ? new FpsOverlay() : null
    if (debug) {
      void createDebugPanel({
        physics: this.physics,
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
    })

    this.render(interpolateKart(this.previousKart, this.world.kart, alpha), input, dt)
  }

  private render(kart: KartState, input: KartInput, dt: number): void {
    const speed = forwardSpeed(kart)
    const speedRatio = speed / this.physics.maxSpeed

    resizeToCanvas(this.scene)
    this.kartView.update(kart, input.steer, speed, speedRatio, dt)
    this.chaseCamera.update(kart.position, kart.heading, speedRatio, input.lookBack, dt)
    this.hud.update(buildHudModel(kart, this.physics, this.driftConfig))
    this.scene.renderer.render(this.scene.scene, this.scene.camera)

    this.readout.speedKmh = Math.abs(speed) * MS_PER_KMH
    this.readout.onGround = kart.onGround
    this.fpsOverlay?.update(dt)
  }

  private resetKart(): void {
    this.world.resetKart()
    this.previousKart = cloneKartState(this.world.kart)
    this.chaseCamera.reset()
  }
}
