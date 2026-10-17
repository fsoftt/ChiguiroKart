import * as THREE from 'three'
import { defaultChaseCamera } from '../config/camera'
import { defaultDrift } from '../config/drift'
import { defaultEffects } from '../config/effects'
import { defaultKartPhysics } from '../config/kartPhysics'
import { cocoraTrack } from '../config/tracks/cocoraTrack'
import { testTrack } from '../config/tracks/testTrack'
import { CUSTOM_TRACK_KEY, buildTrackDefinition, parseTrackDataText } from '../sim/trackData'
import { GamepadSource } from '../input/gamepad'
import { combineInputs, NEUTRAL_INPUT, type InputSource, type KartInput } from '../input/kartInput'
import { KeyboardSource } from '../input/keyboard'
import { ChaseCamera } from '../render/chaseCamera'
import { createScene, resizeToCanvas, type SceneContext } from '../render/createScene'
import { speedLineTarget } from '../render/effects/effectsLogic'
import { KartEffects } from '../render/effects/kartEffects'
import { KartFeedback } from '../render/effects/kartFeedback'
import { SpeedLines } from '../render/effects/speedLines'
import { KartView } from '../render/kartView'
import { ItemView } from '../render/items/itemView'
import { hitPoseInto, type HitPose } from '../render/items/itemViewLogic'
import { createTrackView } from '../render/trackView'
import { FixedStep } from '../sim/fixedStep'
import { forwardSpeed } from '../sim/kart/kartPhysics'
import {
  cloneKartState,
  createKartState,
  interpolateKart,
  type KartState,
} from '../sim/kart/kartState'
import type { Vec2 } from '../sim/math'
import type { TrackDefinition } from '../sim/track'
import { ItemSystem } from '../sim/items/itemSystem'
import type { Racer } from '../sim/racer'
import { RaceWorld } from '../sim/world'
import {
  ghostPoseAt,
  GhostRecorder,
  lapDelta,
  loadGhost,
  saveGhostIfBetter,
  type Ghost,
} from '../sim/race/ghost'
import { saveTrackRecord } from '../sim/race/records'
import { createDebugPanel, isDebugEnabled, type DebugReadout } from '../ui/debugPanel'
import { FpsOverlay } from '../ui/fpsOverlay'
import { Hud } from '../ui/hud'
import { racePosition } from '../sim/race/standings'
import { buildHudModel, eventPopupText } from '../ui/hudModel'
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
const GHOST_COLOR = '#8fd3ff'
const GHOST_OPACITY = 0.4
/** Base seed of the bots' random choices; each bot adds its grid slot. */
const BOT_SEED = 1
/** The player always takes grid slot 0. */
const PLAYER_SLOT = 0

/** Track left by the editor in localStorage; null if missing or invalid. */
function loadCustomTrack(): TrackDefinition | null {
  try {
    const data = parseTrackDataText(window.localStorage.getItem(CUSTOM_TRACK_KEY) ?? '')
    return data ? buildTrackDefinition(data) : null
  } catch {
    return null
  }
}

function selectTrack(): TrackDefinition {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const choice = params.get('pista')
    if (choice === 'test') return testTrack
    if (choice === 'custom') return loadCustomTrack() ?? cocoraTrack
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
  private items = new ItemSystem(this.world.track)
  private readonly itemView = new ItemView()
  private readonly hitPose: HitPose = { yaw: 0, pitch: 0 }
  /** Player first, then the bots in grid order; rebuilt when a race starts. */
  private racers: Racer[] = [this.world.player]
  private readonly itemEntries: { racer: Racer; input: KartInput }[] = []
  private readonly botPositions: Vec2[] = []
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
  /** True from the start of a race or time trial until the menu is shown again. */
  private racing = false
  private readonly ghostRecorder = new GhostRecorder()
  private readonly ghostView = new KartView(GHOST_COLOR)
  private readonly ghostKart: KartState = createKartState({ x: 0, y: 0, z: 0 }, 0)
  /** Best saved ghost of the track, played back during a time trial. */
  private ghost: Ghost | null = null
  private ghostDelta: number | null = null
  private ghostDeltaLaps = 0
  private newRecord = false
  private lastAlpha = 1

  constructor(canvas: HTMLCanvasElement) {
    this.scene = createScene(canvas)
    this.scene.scene.add(
      createTrackView(this.world.track),
      this.kartView.object,
      this.itemView.object,
      this.kartEffects.object,
      this.speedLines.object,
    )
    this.chaseCamera = new ChaseCamera(this.scene.camera, this.cameraConfig)
    this.itemView.setKarts([this.kartView.object])
    this.ghostView.makeGhost(GHOST_OPACITY)
    this.ghostView.object.visible = false
    this.scene.scene.add(this.ghostView.object)
    this.previousKart = cloneKartState(this.world.kart)
    this.settings = parseRaceSettings(typeof window === 'undefined' ? '' : window.location.search)
    this.menu = new QuickRaceMenu(this.settings, this.world.track.name, (chosen) =>
      this.startRace(chosen),
    )
    this.menu.show(this.settings)
    this.hud.setVisible(false)
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
          if (this.racing) this.resetKart()
        },
      })
    }
    window.addEventListener('keydown', (event) => {
      if (event.code === RESET_KEY && this.racing) this.resetKart()
      if (event.code === 'Enter' && this.hud.isFinished) this.startRace(this.settings)
    })
  }

  /** Builds the bots for the chosen settings and puts everyone on the grid; the countdown begins. */
  startRace(settings: RaceSettings): void {
    this.settings = settings
    this.menu.hide()
    this.hud.setVisible(true)
    this.clearBots()
    const timeTrial = settings.mode === 'contrarreloj'
    this.hud.setTimeTrial(timeTrial)
    // The time trial track has no boxes or uchuvas
    this.items = timeTrial
      ? new ItemSystem(this.world.track, undefined, undefined, undefined, false)
      : new ItemSystem(this.world.track)
    this.ghost = timeTrial ? loadGhost(this.world.track.name) : null
    this.racing = true
    if (timeTrial) {
      this.botManager = null
      this.racers = [this.world.player]
      this.itemEntries.length = 0
      this.itemView.setKarts([this.kartView.object])
      this.resetKart()
      return
    }
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
    this.racers = [this.world.player, ...manager.getBotRacers()]
    this.itemEntries.length = 0
    for (const racer of this.racers) this.itemEntries.push({ racer, input: NEUTRAL_INPUT })
    this.itemView.setKarts([this.kartView.object, ...this.botViews.map((view) => view.object)])
    this.resetKart()
  }

  /** Stops the race, removes the bots and shows the menu again. */
  showMenu(): void {
    this.clearBots()
    this.racing = false
    this.ghost = null
    this.ghostView.object.visible = false
    this.hasSavedRecord = false
    this.world.resetKart()
    this.previousKart = cloneKartState(this.world.kart)
    this.chaseCamera.reset()
    this.hud.setVisible(false)
    this.menu.show(this.settings)
  }

  private clearBots(): void {
    for (const view of this.botViews) this.scene.scene.remove(view.object)
    this.botViews = []
    this.previousBotKarts = []
    this.botManager = null
    this.racers = [this.world.player]
    this.itemEntries.length = 0
    this.items.reset()
    this.items.drainEvents()
    this.itemView.reset()
    this.itemView.setKarts([this.kartView.object])
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
    const alpha = this.racing
      ? this.fixedStep.advance(dt, (stepSeconds) => {
          this.previousKart = cloneKartState(this.world.kart)
          this.world.step(input, stepSeconds)
          if (!bots) {
            this.ghostRecorder.record(this.world.kart, this.world.raceManager.state)
            return
          }
          this.previousBotKarts = bots.getBotKarts().map(cloneKartState)
          bots.update(stepSeconds)
          bots.resolveCollisions()
          this.stepItems(input, bots, stepSeconds)
        })
      : 1
    this.lastAlpha = alpha

    this.renderBots(alpha, dt)
    this.renderGhost(dt)
    this.render(interpolateKart(this.previousKart, this.world.kart, alpha), input, dt)
  }

  /** Runs the item simulation for the player and every bot with the inputs they just used. */
  private stepItems(input: KartInput, bots: BotManager, stepSeconds: number): void {
    const infos = bots.getBotInfos()
    for (let i = 0; i < this.itemEntries.length; i++) {
      const entry = this.itemEntries[i]
      if (entry) entry.input = i === 0 ? input : (infos[i - 1]?.input ?? NEUTRAL_INPUT)
    }
    this.items.update(this.itemEntries, stepSeconds)
  }

  /** Feeds this frame's item events to the effects and the HUD. */
  private handleItemEvents(): void {
    const events = this.items.drainEvents()
    if (events.length === 0) return
    this.itemView.handleEvents(events, this.racers)
    for (const event of events) {
      const text = eventPopupText(event, PLAYER_SLOT)
      if (text) this.hud.showPopup(text)
      if (event.type === 'lightning' && event.slots.includes(PLAYER_SLOT)) this.hud.flash()
    }
  }

  private renderBots(alpha: number, dt: number): void {
    const infos = this.botManager?.getBotInfos() ?? []
    for (let i = 0; i < infos.length; i++) {
      const info = infos[i]
      const view = this.botViews[i]
      if (!info || !view) continue
      const kart = interpolateKart(this.previousBotKarts[i] ?? info.kart, info.kart, alpha)
      const speed = forwardSpeed(kart)
      const status = this.racers[i + 1]?.items.status
      const pose = status ? hitPoseInto(status, this.hitPose) : undefined
      view.update(kart, info.input.steer, speed, speed / this.physics.maxSpeed, dt, pose)
    }
  }

  /** Draws the saved ghost at the current race time (the green light is time 0). */
  private renderGhost(dt: number): void {
    const view = this.ghostView
    const ghost = this.settings.mode === 'contrarreloj' && this.racing ? this.ghost : null
    const state = this.world.raceManager.state
    const time =
      state.phase === 'countdown'
        ? 0
        : state.totalRaceTime + (state.phase === 'racing' ? this.lastAlpha / SIMULATION_HZ : 0)
    const pose = ghost ? ghostPoseAt(ghost, time) : null
    view.object.visible = pose !== null
    if (!pose) return
    const kart = this.ghostKart
    kart.position.x = pose.x
    kart.position.y = pose.y
    kart.position.z = pose.z
    kart.heading = pose.heading
    kart.onGround = pose.onGround
    kart.drift.direction = pose.drift
    view.update(kart, 0, pose.speed, pose.speed / this.physics.maxSpeed, dt)
  }

  /** Time trial bookkeeping: gap to the ghost at each lap end and saving the best run. */
  private updateTimeTrial(): void {
    const state = this.world.raceManager.state
    if (state.lapTimes.length > this.ghostDeltaLaps) {
      this.ghostDeltaLaps = state.lapTimes.length
      if (this.ghost)
        this.ghostDelta = lapDelta(this.ghost, state.lapTimes.length - 1, state.lapTimes)
    }
    if (state.phase !== 'finished' || this.hasSavedRecord) return
    this.hasSavedRecord = true
    const run = this.ghostRecorder.finish(this.world.track.name, state)
    if (run) this.newRecord = saveGhostIfBetter(run).isNewBest
  }

  private render(kart: KartState, input: KartInput, dt: number): void {
    const speed = forwardSpeed(kart)
    const speedRatio = speed / this.physics.maxSpeed

    resizeToCanvas(this.scene)
    this.kartView.update(
      kart,
      input.steer,
      speed,
      speedRatio,
      dt,
      hitPoseInto(this.world.player.items.status, this.hitPose),
    )
    this.handleItemEvents()
    this.itemView.update(this.items, this.racers, dt)
    this.kartEffects.update(kart, speedRatio, dt)

    const feedback = this.kartFeedback.update(kart.boost, kart.drift, this.timer.getElapsed(), dt)
    this.chaseCamera.update(kart.position, kart.heading, speedRatio, input.lookBack, dt, feedback)
    this.speedLines.update(
      speedLineTarget(speedRatio, kart.boost.level, this.effectsConfig.speedLines),
      dt,
    )

    const racers = this.racers
    const position = {
      rank: racePosition(this.world.player, racers),
      total: racers.length,
    }
    this.botPositions.length = 0
    for (let i = 1; i < racers.length; i++) {
      const other = racers[i]
      if (other) this.botPositions.push(other.kart.position)
    }
    const timeTrial = this.settings.mode === 'contrarreloj' && this.racing
    if (timeTrial) this.updateTimeTrial()
    this.hud.update(
      buildHudModel(
        kart,
        this.physics,
        this.driftConfig,
        this.world.raceManager.state,
        position,
        this.world.player.items,
        timeTrial ? { ghostDelta: this.ghostDelta, newRecord: this.newRecord } : undefined,
      ),
      { x: kart.position.x, z: kart.position.z },
      kart.heading,
      this.botPositions,
    )

    if (
      !timeTrial &&
      this.racing &&
      this.world.raceManager.state.phase === 'finished' &&
      !this.hasSavedRecord
    ) {
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
    this.ghostRecorder.reset()
    this.ghostDelta = null
    this.ghostDeltaLaps = 0
    this.newRecord = false
    this.world.resetKart()
    this.botManager?.reset()
    this.previousKart = cloneKartState(this.world.kart)
    this.previousBotKarts = this.botManager?.getBotKarts().map(cloneKartState) ?? []
    this.chaseCamera.reset()
    this.items.reset()
    this.items.drainEvents()
    this.itemView.reset()
  }
}
