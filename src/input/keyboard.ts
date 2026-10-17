import { defaultKeyBindings, type KeyBindings, type KeyboardAction } from '../config/controls'
import type { InputSource, KartInput } from './kartInput'

export function keysToInput(pressed: ReadonlySet<string>, bindings: KeyBindings): KartInput {
  const isDown = (action: KeyboardAction): boolean =>
    bindings[action].some((code) => pressed.has(code))
  const axis = (negative: KeyboardAction, positive: KeyboardAction): number =>
    (isDown(positive) ? 1 : 0) - (isDown(negative) ? 1 : 0)

  return {
    throttle: isDown('throttle') ? 1 : 0,
    brake: isDown('brake') ? 1 : 0,
    steer: axis('left', 'right'),
    jump: isDown('jump'),
    boost: isDown('boost'),
    useItem: isDown('useItem'),
    lookBack: isDown('lookBack'),
  }
}

export class KeyboardSource implements InputSource {
  private readonly pressed = new Set<string>()
  private bindings: KeyBindings
  private boundCodes: ReadonlySet<string>

  constructor(
    bindings: KeyBindings = defaultKeyBindings,
    private readonly target: Window = window,
  ) {
    this.bindings = bindings
    this.boundCodes = new Set(Object.values(bindings).flat())
    target.addEventListener('keydown', this.onKeyDown)
    target.addEventListener('keyup', this.onKeyUp)
    target.addEventListener('blur', this.onBlur)
  }

  /** Switches to new key bindings right away; keys held down are released. */
  setBindings(bindings: KeyBindings): void {
    this.bindings = bindings
    this.boundCodes = new Set(Object.values(bindings).flat())
    this.pressed.clear()
  }

  read(): KartInput {
    return keysToInput(this.pressed, this.bindings)
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown)
    this.target.removeEventListener('keyup', this.onKeyUp)
    this.target.removeEventListener('blur', this.onBlur)
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.boundCodes.has(event.code)) return
    // Keep arrows and space from scrolling the page
    event.preventDefault()
    this.pressed.add(event.code)
  }

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code)
  }

  /** Releasing keys while the window is unfocused never fires keyup. */
  private readonly onBlur = (): void => {
    this.pressed.clear()
  }
}
