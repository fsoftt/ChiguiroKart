import type { KeyBindings } from '../config/controls'
import { detectLanguage, isLanguage, type Language } from '../i18n'
import { QUALITY_LEVELS, type Quality } from '../config/quality'
import { defaultBindings, parseKeyBindings } from './keyRebind'

export const SETTINGS_KEY = 'chiguirokart.settings.v1'

/** Options the player changes in the Options screen; saved between sessions. */
export interface GameSettings {
  quality: Quality
  /** Volumes 0..1. Only stored for now; the audio module reads them through the store. */
  masterVolume: number
  musicVolume: number
  sfxVolume: number
  /** Color-blind safe nitro colors plus the tier number on the HUD. */
  colorblind: boolean
  /** No camera shake and a gentler FOV kick. */
  reduceShake: boolean
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
): GameSettings {
  return {
    quality: coarsePointer ? 'medium' : 'high',
    masterVolume: DEFAULT_VOLUME.master,
    musicVolume: DEFAULT_VOLUME.music,
    sfxVolume: DEFAULT_VOLUME.sfx,
    colorblind: false,
    reduceShake: false,
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
  return {
    quality: quality ?? defaults.quality,
    masterVolume: volumeOr(data.masterVolume, defaults.masterVolume),
    musicVolume: volumeOr(data.musicVolume, defaults.musicVolume),
    sfxVolume: volumeOr(data.sfxVolume, defaults.sfxVolume),
    colorblind: typeof data.colorblind === 'boolean' ? data.colorblind : defaults.colorblind,
    reduceShake: typeof data.reduceShake === 'boolean' ? data.reduceShake : defaults.reduceShake,
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
    this.current = { ...this.current, ...partial }
    this.persist(this.current)
    for (const listener of this.listeners) listener(this.current)
  }

  /** Calls `listener` on every change (not on subscribe). Returns the unsubscribe function. */
  subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}
