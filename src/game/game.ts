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
import { racePosition } from '../sim/race/standings'
import { buildHudModel } from '../ui/hudModel'
import { BotManager } from '../sim/botManager'
import { RacingBot } from '../ai/racingBot'
import { botDifficulties } from '../config/bots'
import { QuickRaceMenu } from '../ui/quickRaceMenu'
import { parseRaceSettings, rubberBandFor, type RaceSettings } from './raceSettings'

const SIMULATION_HZ = 60
const RESET_KEY = 'KeyR'
const MS_PER_KMH = 3.6
const SPEED_LINE_STREAKS = 90
const BOT_COLORS = ['#3c7be8', '#3cc15a', '#e8c53c', '#a43ce8', '#3ce0e0', '#e8883c', '#e83ca8']
const BOT_COUNT = 7
/** Base seed of the bots' random choices; each bot adds its grid slot. */
const BOT_SEED = 1

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
  private botManager: BotManager | null = null
  private readonly menu: QuickRaceMenu
  private settings: RaceSettings
  private readonly inputSources: InputSource[] = [new KeyboardSource(), new GamepadSource()]
  private readonly fpsOverlay: FpsOverlay | null
  private readonly hud = new Hud()
  private readonly readout: DebugReadout = { speedKmh: 0, onGround: true }

  private previousKart: KartState
  private botViews: KartView[] = []
  private previousBotKarts: KartState[] = []
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
    this.settings = parseRaceSettings(typeof window === 'undefined' ? '' : window.location.search)
    this.menu = new QuickRaceMenu(this.settings, this.world.track.name, (chosen) =>
      this.startRace(chosen),
    )
    this.menu.show(this.settings)
    this.hud.onRematch = () => this.startRace(this.settings)
    this.hud.onMenu = () => this.showMenu()

    this.hud.setTrack(this.world.track)

    const debug = isDebugEnabled()
    this.fpsOverlay = debug ? new FpsOverlay() : null
    if (debug) {
      void createDebugPanel({
        physics: this.physics,
        drift: this.driftConfig,
        camera: this.cameraConfig,
        readout: this.readout,
        onReset: () => {
          if (this.botManager) this.resetKart()
        },
      })
    }
    window.addEventListener('keydown', (event) => {
      if (event.code === RESET_KEY && this.botManager) this.resetKart()
      if (event.code === 'Enter' && this.hud.isFinished) this.startRace(this.settings)
    })
  }

  /** Builds the bots for the chosen settings and puts everyone on the grid; the countdown begins. */
  startRace(settings: RaceSettings): void {
    this.settings = settings
    this.menu.hide()
    this.clearBots()
    const manager = new BotManager(this.world, this.physics, this.driftConfig, {
      rubberBand: rubberBandFor(settings),
    })
    for (let i = 0; i < BOT_COUNT; i++) {
      manager.addBot(new RacingBot({ skill: botDifficulties[settings.difficulty], seed: BOT_SEED }))
      const view = new KartView(BOT_COLORS[i % BOT_COLORS.length])
      this.botViews.push(view)
      this.scene.scene.add(view.object)
    }
    this.botManager = manager
    this.resetKart()
  }

  /** Stops the race, removes the bots and shows the menu again. */
  showMenu(): void {
    this.clearBots()
    this.hasSavedRecord = false
    this.world.resetKart()
    this.previousKart = cloneKartState(this.world.kart)
    this.chaseCamera.reset()
    this.menu.show(this.settings)
  }

  private clearBots(): void {
    for (const view of this.botViews) this.scene.scene.remove(view.object)
    this.botViews = []
    this.previousBotKarts = []
    this.botManager = null
  }

  start(): void {
    this.scene.renderer.setAnimationLoop((time) => this.frame(time))
  }

  private frame(time: number): void {
    this.timer.update(time)
    const dt = this.timer.getDelta()
    const input = combineInputs(this.inputSources.map((source) => source.read()))

    const bots = this.botManager
    // The simulation only runs during a race; the menu shows the idle grid
    const alpha = bots
      ? this.fixedStep.advance(dt, (stepSeconds) => {
          this.previousKart = cloneKartState(this.world.kart)
          this.world.step(input, stepSeconds)
          this.previousBotKarts = bots.getBotKarts().map(cloneKartState)
          bots.update(stepSeconds)
          bots.resolveCollisions()
        })
      : 1

    this.renderBots(alpha, dt)
    this.render(interpolateKart(this.previousKart, this.world.kart, alpha), input, dt)
  }

  private renderBots(alpha: number, dt: number): void {
    const infos = this.botManager?.getBotInfos() ?? []
    for (let i = 0; i < infos.length; i++) {
      const info = infos[i]
      const view = this.botViews[i]
      if (!info || !view) continue
      const kart = interpolateKart(this.previousBotKarts[i] ?? info.kart, info.kart, alpha)
      const speed = forwardSpeed(kart)
      view.update(kart, info.input.steer, speed, speed / this.physics.maxSpeed, dt)
    }
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

    const racers = [this.world.player, ...(this.botManager?.getBotRacers() ?? [])]
    const position = {
      rank: racePosition(this.world.player, racers),
      total: racers.length,
    }
    this.hud.update(
      buildHudModel(kart, this.physics, this.driftConfig, this.world.raceManager.state, position),
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
    this.botManager?.reset()
    this.previousKart = cloneKartState(this.world.kart)
    this.previousBotKarts = this.botManager?.getBotKarts().map(cloneKartState) ?? []
    this.chaseCamera.reset()
  }
}
