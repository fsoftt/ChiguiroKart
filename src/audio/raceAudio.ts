/**
 * Glue between the game and the audio: turns the player's per-frame state, the race phase
 * and the item events into engine pitch, effects and music. Everything is silent until the
 * first user gesture unlocks the AudioContext (see `AudioEngine`).
 */
import { defaultVolumes, engineProfiles, powerSounds, type AudioVolumes } from '../config/audio'
import type { CharacterId } from '../config/characters'
import type { TrackId } from '../config/tracks/catalog'
import type { Vec3 } from '../sim/math'
import type { KartState } from '../sim/kart/kartState'
import type { ItemEvent } from '../sim/items/itemTypes'
import type { RaceState } from '../sim/race/raceState'
import { AudioEngine } from './audioEngine'
import { distanceGain, engineTarget, volumesFromSearch } from './audioMath'
import { DriftSound, EngineSound } from './loops'
import { MusicPlayer } from './musicPlayer'
import {
  desiredMusic,
  detectCues,
  isDriftSqueal,
  type AudioCue,
  type AudioFrame,
} from './raceAudioLogic'
import { SfxPlayer } from './sfxPlayer'
import { voiceFor, type SfxId } from './sfxRecipes'
import { VoiceLimiter } from './voiceLimiter'

/** Everything `update` needs from the game, once per rendered frame. */
export interface RaceAudioInput {
  kart: KartState
  /** Forward speed over top speed. */
  speedRatio: number
  throttle: number
  race: RaceState
  /** Player's place, 1 = first. */
  rank: number
  /** False while the menu is up. */
  racing: boolean
  /** Catalog id of the loaded track, or null for the test and custom tracks. */
  trackId: TrackId | null
  character: CharacterId
  /** True while the pause menu is open: the loops go quiet and no cues fire. */
  paused: boolean
}

/** Seconds after the finish fanfare before the character's voice. */
const FINISH_VOICE_DELAY = 0.45

interface Players {
  sfx: SfxPlayer
  engine: EngineSound
  drift: DriftSound
  music: MusicPlayer
}

export class RaceAudio {
  readonly engine: AudioEngine
  private players: Players | null = null
  private previous: AudioFrame | null = null
  private character: CharacterId = 'chiguiro'
  private readonly playerPosition: Vec3 = { x: 0, y: 0, z: 0 }

  constructor(volumes: AudioVolumes | null = null) {
    const search = typeof window === 'undefined' ? '' : window.location.search
    this.engine = new AudioEngine(volumes ?? volumesFromSearch(search))
    this.engine.installUnlock()
    this.engine.onReady((engine) => {
      const ctx = engine.context
      if (!ctx) return
      const limiter = new VoiceLimiter()
      this.players = {
        sfx: new SfxPlayer(engine, limiter, ctx),
        engine: new EngineSound(ctx, engine),
        drift: new DriftSound(ctx, engine),
        music: new MusicPlayer(ctx, engine),
      }
    })
    if (typeof document !== 'undefined') {
      // Menu buttons click: one delegated listener instead of touching every menu
      document.addEventListener('click', (event) => {
        const target = event.target
        if (target instanceof Element && target.closest('button')) this.play('click')
      })
    }
  }

  /** For the settings screen; `?volumen=` still scales the master (handy for testing). */
  setVolumes(volumes: AudioVolumes): void {
    const search = typeof window === 'undefined' ? '' : window.location.search
    const scale = volumesFromSearch(search).master / defaultVolumes.master
    this.engine.setVolumes({ ...volumes, master: volumes.master * scale })
  }

  play(id: SfxId, gain = 1): void {
    this.players?.sfx.play(id, { gain })
  }

  /** Per-frame update from the game's render loop. */
  update(input: RaceAudioInput): void {
    const frame = toFrame(input)
    this.character = input.character
    const position = input.kart.position
    this.playerPosition.x = position.x
    this.playerPosition.y = position.y
    this.playerPosition.z = position.z
    const players = this.players
    if (players && input.paused) {
      players.engine.mute()
      players.drift.update(false, 0, 0)
      return
    }
    if (players) {
      for (const cue of detectCues(this.previous, frame)) this.playCue(players, cue)
      const profile = engineProfiles[input.character]
      players.engine.update(
        engineTarget(
          {
            speedRatio: frame.speedRatio,
            throttle: frame.throttle,
            airborne: !frame.onGround,
            nitroLevel: frame.boostLevel,
            active: frame.racing,
            finished: frame.phase === 'finished',
          },
          profile,
        ),
      )
      players.drift.update(isDriftSqueal(frame), frame.driftCharge, frame.speedRatio)
      const music = desiredMusic(frame, input.trackId)
      players.music.setTheme(music.theme, music.tempoScale)
    }
    this.previous = frame
  }

  /** Sounds for the item events of this step (`playerSlot` is the human's grid slot). */
  onItemEvents(events: readonly ItemEvent[], playerSlot: number): void {
    const sfx = this.players?.sfx
    if (!sfx) return
    for (const event of events) {
      switch (event.type) {
        case 'boxTaken':
          if (event.slot === playerSlot) sfx.play('box')
          break
        case 'uchuvaTaken':
          if (event.slot === playerSlot) sfx.play('uchuva', { pitch: 0.95 + Math.random() * 0.15 })
          break
        case 'powerUsed':
          if (event.slot === playerSlot) {
            sfx.play(`power-${powerSounds[event.power]}`, { gain: event.charged ? 1.25 : 1 })
          }
          break
        case 'hit':
          if (event.slot === playerSlot) {
            sfx.play('hit')
            sfx.playLayers(`voice-${this.character}`, voiceFor(this.character, 'hit'), {
              delay: 0.05,
            })
          } else {
            sfx.play('hit', { gain: 0.6 * this.gainAt(event.position) })
          }
          break
        case 'blocked':
          sfx.play('block', { gain: event.slot === playerSlot ? 1 : this.gainAt(event.position) })
          break
        case 'explosion':
          sfx.play('explosion', { gain: this.gainAt(event.position) })
          break
        case 'lightning':
          if (event.slots.includes(playerSlot)) sfx.play('lightning')
          break
        case 'uchuvasStolen':
          if (event.from === playerSlot) sfx.play('stolen')
          break
        case 'hazardBump':
          if (event.slot === playerSlot) sfx.play('bump')
          break
        case 'iceWallBroken':
          sfx.play('iceBreak', { gain: this.gainAt(event.position) })
          break
        case 'iceWallRestored':
          break
      }
    }
  }

  private gainAt(position: Vec3): number {
    const p = this.playerPosition
    return distanceGain(Math.hypot(position.x - p.x, position.y - p.y, position.z - p.z))
  }

  private playCue(players: Players, cue: AudioCue): void {
    const sfx = players.sfx
    switch (cue.type) {
      case 'countdown':
        sfx.play('beepLow')
        break
      case 'go':
        sfx.play('beepGo')
        break
      case 'lap':
        sfx.play('lap')
        break
      case 'finalLap':
        sfx.play('finalLap')
        break
      case 'finish':
        sfx.play(cue.win ? 'fanfareWin' : 'fanfareLose')
        sfx.playLayers(
          `voice-${this.character}`,
          voiceFor(this.character, cue.win ? 'win' : 'lose'),
          { delay: FINISH_VOICE_DELAY },
        )
        break
      case 'nitro':
        sfx.play(`nitro${cue.level}`)
        break
      case 'chainBreak':
        sfx.play('chainBreak')
        break
      case 'jump':
        sfx.play('jump')
        break
      case 'landing':
        sfx.play('landing', { gain: cue.strength, pitch: 1.3 - 0.5 * cue.strength })
        break
      case 'bump':
        sfx.play('bump', { gain: cue.strength })
        break
    }
  }
}

function toFrame(input: RaceAudioInput): AudioFrame {
  const { kart, race } = input
  return {
    racing: input.racing,
    phase: race.phase,
    countdown: race.countdown,
    currentLap: race.currentLap,
    totalLaps: race.totalLaps,
    lapsDone: race.lapTimes.length,
    rank: input.rank,
    onGround: kart.onGround,
    airTime: kart.airTime,
    speedRatio: input.speedRatio,
    throttle: input.throttle,
    driftDirection: kart.drift.direction,
    driftCharge: kart.drift.charge,
    chainBroken: kart.drift.chainBroken,
    boostLevel: kart.boost.level,
    boostTimeLeft: kart.boost.timeLeft,
  }
}
