export type KeyboardAction =
  'throttle' | 'brake' | 'left' | 'right' | 'jump' | 'boost' | 'useItem' | 'lookBack'

/** Keyboard bindings by `KeyboardEvent.code`, so they follow key position, not layout. */
export type KeyBindings = Record<KeyboardAction, readonly string[]>

export const defaultKeyBindings: KeyBindings = {
  throttle: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  boost: ['ShiftLeft', 'ShiftRight'],
  useItem: ['KeyE'],
  lookBack: ['KeyQ'],
}

/** Stick values below this are treated as zero. */
export const GAMEPAD_DEADZONE = 0.15
