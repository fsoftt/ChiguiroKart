import { applyDeadzone } from './gamepad'
import { NEUTRAL_INPUT, type InputSource, type KartInput } from './kartInput'

/** On-screen buttons; each one maps to a field of `KartInput`. */
export type TouchButton = 'throttle' | 'brake' | 'jump' | 'boost' | 'useItem' | 'lookBack'

/** Share of the pad's half width around the center that steers nothing. */
export const TOUCH_STEER_DEADZONE = 0.12
/** Share of the pad's half width at which the steering reaches its maximum. */
export const TOUCH_STEER_SATURATION = 0.9

/** Facts about the device that decide whether the touch controls are shown. */
export interface TouchDetection {
  /** `matchMedia('(pointer: coarse)')`: the primary pointer is a finger. */
  coarsePointer: boolean
  /** `matchMedia('(pointer: fine)')`: the primary pointer is a mouse or trackpad. */
  finePointer: boolean
  /** `navigator.maxTouchPoints`. */
  maxTouchPoints: number
  /** A `touchstart` has been seen on the page. */
  touchStarted: boolean
}

/** Phones and tablets show the controls; a desktop with a mouse never does, even with a touch screen. */
export function shouldShowTouchControls(d: TouchDetection): boolean {
  if (d.touchStarted || d.coarsePointer) return true
  return d.maxTouchPoints > 0 && !d.finePointer
}

/** Steering -1..1 from the horizontal position of a finger on the slide pad. */
export function steerFromPadX(
  x: number,
  padLeft: number,
  padWidth: number,
  deadzone = TOUCH_STEER_DEADZONE,
): number {
  if (padWidth <= 0) return 0
  const half = padWidth / 2
  const offset = (x - (padLeft + half)) / (half * TOUCH_STEER_SATURATION)
  const clamped = Math.max(-1, Math.min(1, offset))
  return applyDeadzone(clamped, deadzone)
}

/** Maps the pressed buttons and the pad steering to the kart's input. */
export function touchToInput(pressed: ReadonlySet<TouchButton>, steer: number): KartInput {
  return {
    throttle: pressed.has('throttle') ? 1 : 0,
    brake: pressed.has('brake') ? 1 : 0,
    steer: Math.max(-1, Math.min(1, steer)),
    jump: pressed.has('jump'),
    boost: pressed.has('boost'),
    useItem: pressed.has('useItem'),
    lookBack: pressed.has('lookBack'),
  }
}

/** Tracks every finger by pointer id, so several can press at once. */
export class TouchSource implements InputSource {
  private readonly buttonPointers = new Map<number, TouchButton>()
  private readonly steerPointers = new Map<number, number>()

  /** `isActive` tells whether the controls are on screen; when not, fingers are ignored. */
  constructor(private readonly isActive: () => boolean = () => true) {}

  /** Finger `id` went down on a button. */
  press(id: number, button: TouchButton): void {
    this.buttonPointers.set(id, button)
  }

  /** Sets the steering of the finger `id` on the pad. */
  steer(id: number, value: number): void {
    this.steerPointers.set(id, value)
  }

  /** Finger `id` was lifted or cancelled. */
  release(id: number): void {
    this.buttonPointers.delete(id)
    this.steerPointers.delete(id)
  }

  /** Drops every finger (the controls were hidden). */
  releaseAll(): void {
    this.buttonPointers.clear()
    this.steerPointers.clear()
  }

  read(): KartInput {
    if (this.buttonPointers.size === 0 && this.steerPointers.size === 0) return { ...NEUTRAL_INPUT }
    if (!this.isActive()) {
      // Hidden controls never get the pointerup of a finger that was still down
      this.releaseAll()
      return { ...NEUTRAL_INPUT }
    }
    const pressed = new Set<TouchButton>(this.buttonPointers.values())
    let steer = 0
    for (const value of this.steerPointers.values()) {
      if (Math.abs(value) > Math.abs(steer)) steer = value
    }
    return touchToInput(pressed, steer)
  }
}
