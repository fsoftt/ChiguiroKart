import {
  BOT_DIFFICULTIES,
  defaultRubberBand,
  type BotDifficulty,
  type RubberBandConfig,
} from '../config/bots'
import { characterIds, type CharacterId } from '../config/characters'
import {
  cups,
  isCupId,
  isTrackId,
  trackIds,
  type CupId,
  type TrackId,
} from '../config/tracks/catalog'

export const DEFAULT_DIFFICULTY: BotDifficulty = 'normal'

/**
 * Game modes: quick race against bots, a cup of four races with points, or a time trial alone
 * against your best ghost.
 */
export const RACE_MODES = ['carrera', 'copa', 'contrarreloj'] as const
export type RaceMode = (typeof RACE_MODES)[number]
export const DEFAULT_MODE: RaceMode = 'carrera'
export const DEFAULT_CHARACTER: CharacterId = 'chiguiro'
export const DEFAULT_TRACK: TrackId = 'cocora'
export const DEFAULT_CUP: CupId = 'andina'

/** What the player picks in the quick race menu. */
export interface RaceSettings {
  mode: RaceMode
  difficulty: BotDifficulty
  /** "Ayuda de remontada": the rubber band that keeps bots close to the player. */
  rubberBandEnabled: boolean
  /** The player's character. */
  character: CharacterId
  /** Track of the quick race and the time trial. */
  track: TrackId
  /** Cup of the cup mode. */
  cup: CupId
}

/**
 * Reads `?modo=carrera|copa|contrarreloj`, `?dificultad=facil|normal|dificil`, `?remontada=0`
 * (turns the rubber band off), `?personaje=<id>`, `?pista=<TrackId>` and `?copa=<CupId>`.
 * A valid `?copa` without `?modo` starts the cup mode.
 */
export function parseRaceSettings(search: string): RaceSettings {
  const params = new URLSearchParams(search)
  const requested = params.get('dificultad')
  const requestedMode = params.get('modo')
  const requestedCharacter = params.get('personaje')
  const requestedTrack = params.get('pista')
  const requestedCup = params.get('copa')
  const cupGiven = isCupId(requestedCup)
  return {
    mode: RACE_MODES.find((mode) => mode === requestedMode) ?? (cupGiven ? 'copa' : DEFAULT_MODE),
    difficulty: BOT_DIFFICULTIES.find((level) => level === requested) ?? DEFAULT_DIFFICULTY,
    rubberBandEnabled: params.get('remontada') !== '0',
    character: characterIds.find((id) => id === requestedCharacter) ?? DEFAULT_CHARACTER,
    track: isTrackId(requestedTrack) ? requestedTrack : DEFAULT_TRACK,
    cup: cupGiven ? requestedCup : DEFAULT_CUP,
  }
}

/** Moves the difficulty selection by `step` levels, clamped at both ends. */
export function shiftDifficulty(settings: RaceSettings, step: number): RaceSettings {
  const index = BOT_DIFFICULTIES.indexOf(settings.difficulty)
  const next = Math.min(Math.max(index + step, 0), BOT_DIFFICULTIES.length - 1)
  return { ...settings, difficulty: BOT_DIFFICULTIES[next] ?? settings.difficulty }
}

/** Returns the settings with a new game mode. */
export function withMode(settings: RaceSettings, mode: RaceMode): RaceSettings {
  return { ...settings, mode }
}

/** Moves the mode selection by `step` entries, clamped at both ends. */
export function shiftMode(settings: RaceSettings, step: number): RaceSettings {
  const index = RACE_MODES.indexOf(settings.mode)
  const next = Math.min(Math.max(index + step, 0), RACE_MODES.length - 1)
  return withMode(settings, RACE_MODES[next] ?? settings.mode)
}

/** Returns the settings with a new difficulty. */
export function withDifficulty(settings: RaceSettings, difficulty: BotDifficulty): RaceSettings {
  return { ...settings, difficulty }
}

/** Returns the settings with the rubber band turned on or off. */
export function withRubberBand(settings: RaceSettings, enabled: boolean): RaceSettings {
  return { ...settings, rubberBandEnabled: enabled }
}

/** Returns the settings with a new character. */
export function withCharacter(settings: RaceSettings, character: CharacterId): RaceSettings {
  return { ...settings, character }
}

/** Moves the character selection by `step`, wrapping around the roster. */
export function shiftCharacter(settings: RaceSettings, step: number): RaceSettings {
  const count = characterIds.length
  const index = characterIds.indexOf(settings.character)
  const next = (((index + step) % count) + count) % count
  return withCharacter(settings, characterIds[next] ?? settings.character)
}

/** The rubber band config that matches the player's choice. */
export function rubberBandFor(settings: RaceSettings): RubberBandConfig {
  return { ...defaultRubberBand, enabled: settings.rubberBandEnabled }
}

/** Returns the settings with a new track. */
export function withTrack(settings: RaceSettings, track: TrackId): RaceSettings {
  return { ...settings, track }
}

/** Returns the settings with a new cup. */
export function withCup(settings: RaceSettings, cup: CupId): RaceSettings {
  return { ...settings, cup }
}

/** Moves the track selection by `step` entries through the 12 tracks, wrapping around. */
export function shiftTrack(settings: RaceSettings, step: number): RaceSettings {
  const count = trackIds.length
  const index = trackIds.indexOf(settings.track)
  const next = (((index + step) % count) + count) % count
  return withTrack(settings, trackIds[next] ?? settings.track)
}

/** Moves the cup selection by `step`, clamped at both ends. */
export function shiftCup(settings: RaceSettings, step: number): RaceSettings {
  const index = cups.findIndex((cup) => cup.id === settings.cup)
  const next = Math.min(Math.max(index + step, 0), cups.length - 1)
  return withCup(settings, cups[next]?.id ?? settings.cup)
}
