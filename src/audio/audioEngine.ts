import { defaultVolumes, VOLUME_SMOOTHING, type AudioVolumes } from '../config/audio'

type ContextConstructor = new () => AudioContext

interface AudioWindow {
  AudioContext?: ContextConstructor
  webkitAudioContext?: ContextConstructor
}

function contextConstructor(): ContextConstructor | null {
  if (typeof window === 'undefined') return null
  const source = window as unknown as AudioWindow
  return source.AudioContext ?? source.webkitAudioContext ?? null
}

const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const

/**
 * Owns the single AudioContext and the buses master -> { music, sfx }. The context is only
 * created inside a user gesture (browsers keep it suspended otherwise) and everything else
 * checks `context`, which stays null where Web Audio is missing or not yet unlocked, so the
 * game runs silently instead of failing (and the pure audio logic runs in Node tests).
 */
export class AudioEngine {
  private ctx: AudioContext | null = null
  private masterBus: GainNode | null = null
  private musicBus: GainNode | null = null
  private sfxBus: GainNode | null = null
  private volumes: AudioVolumes
  private readonly readyListeners: ((engine: AudioEngine) => void)[] = []

  constructor(volumes: AudioVolumes = defaultVolumes) {
    this.volumes = { ...volumes }
  }

  /** True where the browser offers Web Audio. */
  get available(): boolean {
    return contextConstructor() !== null
  }

  /** The context once unlocked and running, else null. */
  get context(): AudioContext | null {
    return this.ctx
  }

  get music(): GainNode | null {
    return this.musicBus
  }

  get sfx(): GainNode | null {
    return this.sfxBus
  }

  /** Audio clock in seconds; 0 while locked. */
  get now(): number {
    return this.ctx?.currentTime ?? 0
  }

  /** Calls `listener` once the context exists (immediately if it already does). */
  onReady(listener: (engine: AudioEngine) => void): void {
    if (this.ctx) listener(this)
    else this.readyListeners.push(listener)
  }

  /** Waits for the first user gesture to create the context; also suspends it in hidden tabs. */
  installUnlock(): void {
    if (typeof window === 'undefined' || !this.available) return
    const unlock = (): void => {
      this.unlock()
      if (this.ctx?.state === 'running') {
        for (const name of UNLOCK_EVENTS) window.removeEventListener(name, unlock, true)
      }
    }
    for (const name of UNLOCK_EVENTS) window.addEventListener(name, unlock, true)
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return
      if (document.hidden) void this.ctx.suspend()
      else void this.ctx.resume()
    })
  }

  /** Creates the context and buses (once) and resumes it. Call from a user gesture. */
  unlock(): void {
    const Constructor = contextConstructor()
    if (!Constructor) return
    if (!this.ctx) {
      try {
        this.ctx = new Constructor()
      } catch {
        return
      }
      const master = this.ctx.createGain()
      const music = this.ctx.createGain()
      const sfx = this.ctx.createGain()
      music.connect(master)
      sfx.connect(master)
      master.connect(this.ctx.destination)
      this.masterBus = master
      this.musicBus = music
      this.sfxBus = sfx
      this.applyVolumes(true)
      for (const listener of this.readyListeners.splice(0)) listener(this)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined)
  }

  /** Sets the three volumes (0..1); changes are smoothed so sliders do not click. */
  setVolumes(volumes: AudioVolumes): void {
    this.volumes = { ...volumes }
    this.applyVolumes(false)
  }

  getVolumes(): AudioVolumes {
    return { ...this.volumes }
  }

  private applyVolumes(immediate: boolean): void {
    const ctx = this.ctx
    if (!ctx || !this.masterBus || !this.musicBus || !this.sfxBus) return
    const set = (node: GainNode, value: number): void => {
      const target = Math.min(Math.max(value, 0), 1)
      if (immediate) node.gain.value = target
      else node.gain.setTargetAtTime(target, ctx.currentTime, VOLUME_SMOOTHING)
    }
    set(this.masterBus, this.volumes.master)
    set(this.musicBus, this.volumes.music)
    set(this.sfxBus, this.volumes.sfx)
  }
}
