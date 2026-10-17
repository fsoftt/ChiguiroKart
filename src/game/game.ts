import * as THREE from 'three'
import { defaultChaseCamera } from '../config/camera'
import { defaultDrift } from '../config/drift'
import { defaultEffects } from '../config/effects'
import { defaultKartPhysics } from '../config/kartPhysics'
import { cocoraTrack } from '../config/tracks/cocoraTrack'
import { cupInfo, tracks, type TrackId } from '../config/tracks/catalog'
import { DEFAULT_THEME, type TrackTheme } from '../config/tracks/theme'
import { testTrack } from '../config/tracks/testTrack'
import { CUSTOM_TRACK_KEY, buildTrackDefinition, parseTrackDataText } from '../sim/trackData'
import { GamepadSource } from '../input/gamepad'
import { combineInputs, NEUTRAL_INPUT, type InputSource, type KartInput } from '../input/kartInput'
import { KeyboardSource } from '../input/keyboard'
import { ChaseCamera } from '../render/chaseCamera'
import {
  applySceneTheme,
  createScene,
  renderScene,
  resizeToCanvas,
  type SceneContext,
} from '../render/createScene'
import { speedLineTarget } from '../render/effects/effectsLogic'
import { KartEffects } from '../render/effects/kartEffects'
import { KartFeedback } from '../render/effects/kartFeedback'
import { SpeedLines } from '../render/effects/speedLines'
import { throwActionFor } from '../render/characterAnimLogic'
import { CharacterView } from '../render/characterView'
import { ItemView } from '../render/items/itemView'
import { hitPoseInto, type HitPose } from '../render/items/itemViewLogic'
import { placeFinishCamera, placeShowroomCamera } from '../render/showcaseCamera'
import { HazardView } from '../render/hazardView'
import { createTrackView, type TrackView } from '../render/trackView'
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
import type { PowerId } from '../sim/items/itemTypes'
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
import { computeStandings, racePosition } from '../sim/race/standings'
import { buildHudModel, eventPopupText } from '../ui/hudModel'
import { buildCupResultsView, cupBadgeText } from '../ui/cupResultsModel'
import { BotManager } from '../sim/botManager'
import { RacingBot } from '../ai/racingBot'
import { botDifficulties } from '../config/bots'
import { characterIds, type CharacterId } from '../config/characters'
import { QuickRaceMenu } from '../ui/quickRaceMenu'
import {
  advanceCup,
  createCup,
  isCupFinished,
  isRaceRecorded,
  recordRace,
  type CupState,
} from './cup'
import { disposeObject } from './disposeObject'
import { parseRaceSettings, rubberBandFor, type RaceSettings } from './raceSettings'

const SIMULATION_HZ = 60
const RESET_KEY = 'KeyR'
const MS_PER_KMH = 3.6
const SPEED_LINE_STREAKS = 90
const BOT_COUNT = 7
const GHOST_COLOR = '#8fd3ff'
const GHOST_OPACITY = 0.4
/** The player finishes in victory pose on the podium places, otherwise in defeat. */
const PODIUM_PLACES = 3
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

/** Anything the game can race on: a catalog track or the test and custom tracks of the URL. */
interface TrackSource {
  name: string
  theme: TrackTheme
  /** Builds the simulation track when it is loaded. */
  build(): TrackDefinition
}

function urlSearch(): string {
  return typeof window === 'undefined' ? '' : window.location.search
}

/**
 * `?pista=test` and `?pista=custom` (the editor's track) race on a track outside the catalog;
 * they stay in force until the player picks another track in the menu. Catalog ids come
 * through `parseRaceSettings` instead.
 */
function urlTrackOverride(): TrackSource | null {
  const choice = new URLSearchParams(urlSearch()).get('pista')
  if (choice === 'test') {
    return { name: testTrack.name, theme: DEFAULT_THEME, build: () => testTrack }
  }
  if (choice === 'custom') {
    const custom = loadCustomTrack() ?? cocoraTrack
    return { name: custom.name, theme: DEFAULT_THEME, build: () => custom }
  }
  return null
}

/** The track of cup race number `index` (0-based). */
function cupTrackId(cup: CupState): TrackId {
  return cupInfo(cup.cupId).tracks[cup.raceIndex] ?? 'cocora'
}

/** Wires input, simulation and rendering together and runs the frame loop. */
export class Game {
  private readonly physics = { ...defaultKartPhysics }
  private readonly driftConfig = { ...defaultDrift }
  private readonly effectsConfig = defaultEffects
  private readonly cameraConfig = { ...defaultChaseCamera }
  private readonly initialSettings = parseRaceSettings(urlSearch())
  /** From `?pista=test|custom`; cleared when the player picks a track in the menu. */
  private trackOverride = urlTrackOverride()
  /** The track currently loaded in the world and the scene. */
  private trackSource: TrackSource = this.trackOverride ?? tracks[this.initialSettings.track]
  private world = new RaceWorld(this.trackSource.build(), this.physics, this.driftConfig)
  /** Scenery of the loaded track: replaced (and disposed) whenever another track loads. */
  private trackView: TrackView | null = null
  private hazardView: HazardView | null = null
  /** Seconds since the track was loaded; only drives hazard animations. */
  private trackTime = 0
  private readonly fixedStep = new FixedStep(1 / SIMULATION_HZ)
  private readonly timer = new THREE.Timer()

  private readonly scene: SceneContext
  private readonly kartView: CharacterView
  private readonly kartEffects = new KartEffects(defaultEffects, this.driftConfig)
  private readonly speedLines = new SpeedLines(SPEED_LINE_STREAKS, defaultEffects.speedLines.color)
  private readonly kartFeedback = new KartFeedback(defaultEffects.camera)
  private readonly chaseCamera: ChaseCamera
  private items = this.createItems(true)
  private itemView = new ItemView()
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
  private botViews: CharacterView[] = []
  private previousBotKarts: KartState[] = []
  private hasSavedRecord = false
  /** True from the start of a race or time trial until the menu is shown again. */
  private racing = false
  private readonly ghostRecorder = new GhostRecorder()
  private readonly ghostView: CharacterView
  private readonly ghostKart: KartState = createKartState({ x: 0, y: 0, z: 0 }, 0)
  /** Best saved ghost of the track, played back during a time trial. */
  private ghost: Ghost | null = null
  private ghostDelta: number | null = null
  private ghostDeltaLaps = 0
  private newRecord = false
  private lastAlpha = 1
  /** True once the player's finish pose and the front camera are on. */
  private finishShown = false
  private currentCharacter: CharacterId
  /** The cup in progress, or null in a quick race or time trial. */
  private cup: CupState | null = null
  /** HUD badge of the cup race, e.g. "Carrera 2/4 · Copa Andina"; empty outside a cup. */
  private cupBadge = ''

  constructor(canvas: HTMLCanvasElement) {
    this.settings = this.initialSettings
    this.world.player.character = this.settings.character
    this.currentCharacter = this.settings.character
    this.kartView = new CharacterView(this.settings.character)
    this.ghostView = new CharacterView(this.settings.character)
    this.scene = createScene(canvas)
    this.setupTrack()
    this.scene.scene.add(
      this.kartView.object,
      this.itemView.object,
      this.kartEffects.object,
      this.speedLines.object,
    )
    this.chaseCamera = new ChaseCamera(this.scene.camera, this.cameraConfig)
    this.itemView.setKarts([this.kartView.object])
    this.ghostView.makeGhost(GHOST_OPACITY, GHOST_COLOR)
    this.ghostView.object.visible = false
    this.scene.scene.add(this.ghostView.object)
    this.previousKart = cloneKartState(this.world.kart)
    this.menu = new QuickRaceMenu(this.settings, (chosen) => this.startRace(chosen))
    this.menu.setTrackOverride(this.trackOverride?.name ?? null)
    this.menu.onTrackChange = () => {
      this.trackOverride = null
    }
    this.menu.onCharacterChange = (id) => this.setPlayerCharacter(id)
    this.menu.show(this.settings)
    this.hud.setVisible(false)
    this.hud.onRematch = () => this.primaryAction()
    this.hud.onMenu = () => this.showMenu()

    const debug = isDebugEnabled()
    this.fpsOverlay = debug ? new FpsOverlay() : null
    if (debug) {
      void createDebugPanel({
        physics: this.physics,
        drift: this.driftConfig,
        camera: this.cameraConfig,
        readout: this.readout,
        onReset: () => {
          if (this.racing && !this.raceLocked()) this.resetKart()
        },
      })
    }
    window.addEventListener('keydown', (event) => {
      if (event.code === RESET_KEY && this.racing && !this.raceLocked()) this.resetKart()
      if (event.code === 'Enter' && this.hud.isFinished) this.primaryAction()
    })
  }

  /**
   * Starts what the menu chose: a quick race, a time trial or the first race of a cup. Loads
   * the track, builds the bots and puts everyone on the grid; the countdown begins.
   */
  startRace(settings: RaceSettings): void {
    this.settings = settings
    this.setPlayerCharacter(settings.character)
    this.menu.hide()
    if (settings.mode === 'copa') {
      // Same player and the same 7 bot characters for the four races
      const characters = [settings.character, ...botCharactersFor(settings.character)]
      this.cup = createCup(settings.cup, characters.slice(0, BOT_COUNT + 1))
      this.trackOverride = null
    } else {
      this.cup = null
    }
    this.launchRace()
  }

  /** Main button of the results: next race of the cup, a new cup, or a rematch. */
  private primaryAction(): void {
    const cup = this.cup
    if (!cup || isCupFinished(cup)) {
      this.startRace(this.settings)
    } else if (isRaceRecorded(cup)) {
      this.cup = advanceCup(cup)
      this.launchRace()
    }
  }

  /** True while the player looks at the cup standings: the race must not be restarted. */
  private raceLocked(): boolean {
    return this.cup !== null && isRaceRecorded(this.cup)
  }

  /** The track to race on now: the cup's current one, the URL override or the chosen one. */
  private currentTrackSource(): TrackSource {
    if (this.cup) return tracks[cupTrackId(this.cup)]
    return this.trackOverride ?? tracks[this.settings.track]
  }

  /** Loads the track of the current race, then builds the bots and starts the countdown. */
  private launchRace(): void {
    const settings = this.settings
    this.hud.setVisible(true)
    this.hud.clearCupResults()
    this.clearBots()
    this.loadTrack(this.currentTrackSource())
    this.cupBadge = this.cup ? cupBadgeText(this.cup, cupInfo(this.cup.cupId).name) : ''
    const timeTrial = settings.mode === 'contrarreloj'
    this.hud.setTimeTrial(timeTrial)
    // The time trial track has no boxes or uchuvas
    this.items = this.createItems(!timeTrial)
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
    const botCharacters = botCharactersFor(settings.character)
    for (let i = 0; i < BOT_COUNT; i++) {
      const character = botCharacters[i % botCharacters.length] ?? settings.character
      manager.addBot(
        new RacingBot({ skill: botDifficulties[settings.difficulty], seed: BOT_SEED }),
        character,
      )
      const view = new CharacterView(character)
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

  /** Changes who the player drives: the sim racer and the kart on screen. */
  private setPlayerCharacter(id: CharacterId): void {
    this.settings = { ...this.settings, character: id }
    this.world.player.character = id
    if (this.currentCharacter === id) return
    this.currentCharacter = id
    this.kartView.setCharacter(id)
    this.ghostView.setCharacter(id)
  }

  /** Stops the race, removes the bots and shows the menu again. */
  showMenu(): void {
    this.clearBots()
    this.racing = false
    this.ghost = null
    this.ghostView.object.visible = false
    this.hasSavedRecord = false
    this.cup = null
    this.cupBadge = ''
    this.hud.clearCupResults()
    this.world.resetKart()
    this.previousKart = cloneKartState(this.world.kart)
    this.chaseCamera.reset()
    this.clearFinishShow()
    this.hud.setVisible(false)
    this.menu.show(this.settings)
  }

  /**
   * Switches the world to another track: tears the old one down, builds the new RaceWorld
   * (the player keeps the chosen character) and sets the new one up. Does nothing if that
   * track is already loaded; callers reset the kart and the race afterwards.
   */
  private loadTrack(source: TrackSource): void {
    if (source === this.trackSource) return
    this.teardownTrack()
    this.trackSource = source
    this.world = new RaceWorld(source.build(), this.physics, this.driftConfig)
    this.world.player.character = this.currentCharacter
    this.items = this.createItems(true)
    // The item view builds its pickup meshes from the first system it sees
    this.itemView = new ItemView()
    this.scene.scene.add(this.itemView.object)
    this.itemView.setKarts([this.kartView.object])
    this.racers = [this.world.player]
    this.previousKart = cloneKartState(this.world.kart)
    this.chaseCamera.reset()
    this.ghost = null
    this.setupTrack()
  }

  /**
   * Boxes, uchuvas, powers and the track's hazards for the loaded world (`withPickups` false
   * for the time trial). Bots see the hazards through `world.obstacles`.
   */
  private createItems(withPickups: boolean): ItemSystem {
    const items = new ItemSystem(
      this.world.track,
      undefined,
      undefined,
      this.driftConfig,
      withPickups,
      this.physics,
    )
    this.world.obstacles = () => items.hazards.obstacles
    return items
  }

  // --- Per-track setup and teardown: the single place to wire what depends on the track ---

  /**
   * Builds everything that belongs to the loaded track (`this.world`, `this.trackSource`).
   * Runs once at start and after every track switch.
   */
  private setupTrack(): void {
    const view = createTrackView(this.world.track, this.trackSource.theme)
    this.trackView = view
    this.scene.scene.add(view)
    this.hazardView = new HazardView(this.world.track)
    this.scene.scene.add(this.hazardView.object)
    this.trackTime = 0
    applySceneTheme(this.scene, this.trackSource.theme)
    this.hud.setTrack(this.world.track)
  }

  /**
   * Removes and disposes everything `setupTrack` created. Runs before another track loads.
   */
  private teardownTrack(): void {
    if (this.trackView) disposeObject(this.trackView)
    if (this.hazardView) disposeObject(this.hazardView.object)
    this.hazardView = null
    this.itemView.setKarts([])
    this.trackView = null
    disposeObject(this.itemView.object)
  }

  /** Per-frame update of the track's own visuals (`dt` in seconds): tide and hazards. */
  private updateTrack(dt: number): void {
    this.trackTime += dt
    this.trackView?.update()
    this.hazardView?.update(this.items.hazards.obstacles, this.trackTime)
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

    this.updateTrack(dt)
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
      if (event.type === 'powerUsed') this.playThrow(event.slot, event.power)
      const text = eventPopupText(event, PLAYER_SLOT)
      if (text) this.hud.showPopup(text)
      if (event.type === 'lightning' && event.slots.includes(PLAYER_SLOT)) this.hud.flash()
    }
  }

  /** The racer in grid slot `slot` makes its throwing gesture. */
  private playThrow(slot: number, power: PowerId): void {
    const view = slot === PLAYER_SLOT ? this.kartView : this.botViews[slot - 1]
    const lookBack = this.itemEntries[slot]?.input.lookBack ?? false
    view?.playAction(throwActionFor(power, lookBack))
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
    this.updateCamera(kart, speedRatio, input, dt, feedback)
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
        this.cupBadge,
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

    renderScene(this.scene)

    this.readout.speedKmh = Math.abs(speed) * MS_PER_KMH
    this.readout.onGround = kart.onGround
    this.fpsOverlay?.update(dt)
  }

  /** Chase camera while racing, front view at the finish, showroom while the menu is up. */
  private updateCamera(
    kart: KartState,
    speedRatio: number,
    input: KartInput,
    dt: number,
    feedback: ReturnType<KartFeedback['update']>,
  ): void {
    const camera = this.scene.camera
    if (!this.racing) {
      placeShowroomCamera(camera, kart.position, kart.heading, this.timer.getElapsed())
      return
    }
    const state = this.world.raceManager.state
    if (state.phase === 'finished') {
      if (!this.finishShown) {
        this.finishShown = true
        const rank = racePosition(this.world.player, this.racers)
        this.kartView.setResult(rank <= PODIUM_PLACES ? 'victory' : 'defeat')
        this.recordCupRace()
      }
      placeFinishCamera(camera, kart.position, kart.heading, dt)
      return
    }
    this.chaseCamera.update(kart.position, kart.heading, speedRatio, input.lookBack, dt, feedback)
  }

  /**
   * Cup mode: when the player finishes, the finishing order of the whole grid goes into the
   * cup (racers still driving are ranked by the current standings) and the cup table shows.
   */
  private recordCupRace(): void {
    const cup = this.cup
    if (!cup || isRaceRecorded(cup)) return
    const order = computeStandings(this.racers).map((racer) => racer.slot)
    this.cup = recordRace(cup, order)
    this.hud.showCupResults(buildCupResultsView(this.cup, cupInfo(cup.cupId).name))
  }

  private clearFinishShow(): void {
    this.finishShown = false
    this.kartView.setResult(null)
  }

  private resetKart(): void {
    this.clearFinishShow()
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

/** The 7 characters the player did not pick, in menu order: one per bot. */
function botCharactersFor(player: CharacterId): CharacterId[] {
  return characterIds.filter((id) => id !== player)
}
