import type { KeyBindings } from '../config/controls'
import { detectLanguage, isLanguage, type Language } from '../i18n'
import { defaultQualityFor, readDeviceHints, type DeviceHints } from '../config/deviceQuality'
import { QUALITY_LEVELS, type Quality } from '../config/quality'
import { defaultBindings, parseKeyBindings } from './keyRebind'
import { systemPrefersReducedMotion } from '../ui/motion'
import { resolveReduceMotion } from '../ui/motionModel'

export const SETTINGS_KEY = 'chiguirokart.settings.v1'

/** Options the player changes in the Options screen; saved between sessions. */
export interface GameSettings {
  quality: Quality
  /**
   * True once the player picked a quality. Until then the quality is the device's automatic
   * default (see `defaultQualityFor`).
   */
  qualityChosen: boolean
  /** Volumes 0..1. Only stored for now; the audio module reads them through the store. */
  masterVolume: number
  musicVolume: number
  sfxVolume: number
  /** Color-blind safe nitro colors plus the tier number on the HUD. */
  colorblind: boolean
  /** No camera shake and a gentler FOV kick. */
  reduceShake: boolean
  /** Fade-only menu and race transitions. Follows `prefers-reduced-motion` until the player picks. */
  reduceMotion: boolean
  keyBindings: KeyBindings
  /** Language of every menu and HUD text. */
  language: Language
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const DEFAULT_VOLUME = { master: 0.8, music: 0.7, sfx: 0.9 }

/** True on phones and tablets, where the lighter quality is the default. */
function isCoarsePointer(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  } catch {
    return false
  }
}

export function defaultSettings(
  coarsePointer: boolean = isCoarsePointer(),
  language: Language = detectLanguage(),
  prefersReducedMotion: boolean = systemPrefersReducedMotion(),
  hints: Omit<DeviceHints, 'coarsePointer'> = readDeviceHints(),
): GameSettings {
  return {
    quality: defaultQualityFor({ coarsePointer, ...hints }),
    qualityChosen: false,
    masterVolume: DEFAULT_VOLUME.master,
    musicVolume: DEFAULT_VOLUME.music,
    sfxVolume: DEFAULT_VOLUME.sfx,
    colorblind: false,
    reduceShake: false,
    reduceMotion: resolveReduceMotion(undefined, prefersReducedMotion),
    keyBindings: defaultBindings(),
    language,
  }
}

function volumeOr(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(1, Math.max(0, value))
}

/** Reads saved settings text, falling back to `defaults` field by field. Never throws. */
export function parseSettings(text: string | null, defaults = defaultSettings()): GameSettings {
  let raw: unknown
  try {
    raw = JSON.parse(text ?? '')
  } catch {
    return defaults
  }
  if (typeof raw !== 'object' || raw === null) return defaults
  const data = raw as Record<string, unknown>
  const quality = QUALITY_LEVELS.find((level) => level === data.quality)
  // Settings saved before the flag existed keep their quality: it may have been picked. An
  // unchosen quality is detected again, so it follows the device
  const qualityChosen =
    quality !== undefined && (typeof data.qualityChosen === 'boolean' ? data.qualityChosen : true)
  return {
    quality: qualityChosen && quality ? quality : defaults.quality,
    qualityChosen,
    masterVolume: volumeOr(data.masterVolume, defaults.masterVolume),
    musicVolume: volumeOr(data.musicVolume, defaults.musicVolume),
    sfxVolume: volumeOr(data.sfxVolume, defaults.sfxVolume),
    colorblind: typeof data.colorblind === 'boolean' ? data.colorblind : defaults.colorblind,
    reduceShake: typeof data.reduceShake === 'boolean' ? data.reduceShake : defaults.reduceShake,
    reduceMotion: resolveReduceMotion(data.reduceMotion, defaults.reduceMotion),
    keyBindings: 'keyBindings' in data ? parseKeyBindings(data.keyBindings) : defaults.keyBindings,
    language: isLanguage(data.language) ? data.language : defaults.language,
  }
}

function resolveStorage(custom?: StorageLike): StorageLike | null {
  if (custom) return custom
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

export function loadSettings(storage?: StorageLike): GameSettings {
  try {
    return parseSettings(resolveStorage(storage)?.getItem(SETTINGS_KEY) ?? null)
  } catch {
    return defaultSettings()
  }
}

export function saveSettings(settings: GameSettings, storage?: StorageLike): void {
  try {
    resolveStorage(storage)?.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Storage may be full or blocked; the settings still apply for this session
  }
}

export type SettingsListener = (settings: GameSettings) => void

/** Holds the current settings, saves every change and tells the subscribers. */
export class SettingsStore {
  private current: GameSettings
  private readonly listeners = new Set<SettingsListener>()

  constructor(
    initial: GameSettings = loadSettings(),
    private readonly persist: (settings: GameSettings) => void = (settings) =>
      saveSettings(settings),
  ) {
    this.current = initial
  }

  get(): GameSettings {
    return this.current
  }

  update(partial: Partial<GameSettings>): void {
    // Picking a quality (in Options) turns the automatic default off for good
    const chosen =
      'quality' in partial && !('qualityChosen' in partial) ? { qualityChosen: true } : {}
    this.current = { ...this.current, ...partial, ...chosen }
    this.persist(this.current)
    for (const listener of this.listeners) listener(this.current)
  }

  /** Calls `listener` on every change (not on subscribe). Returns the unsubscribe function. */
  subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}
