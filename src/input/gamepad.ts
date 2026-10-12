import { GAMEPAD_DEADZONE } from '../config/controls'
import { NEUTRAL_INPUT, type InputSource, type KartInput } from './kartInput'

/** Subset of the browser Gamepad API, so mapping can be tested without a device. */
export interface GamepadLike {
  readonly axes: readonly number[]
  readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[]
}

/** Button indexes of the W3C "standard" gamepad mapping. */
const Button = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LeftBumper: 4,
  RightBumper: 5,
  LeftTrigger: 6,
  RightTrigger: 7,
} as const

const LEFT_STICK_X = 0

export function applyDeadzone(value: number, deadzone: number): number {
  const magnitude = Math.abs(value)
  if (magnitude < deadzone) return 0
  return (Math.sign(value) * (magnitude - deadzone)) / (1 - deadzone)
}

export function gamepadToInput(pad: GamepadLike, deadzone = GAMEPAD_DEADZONE): KartInput {
  const value = (index: number): number => pad.buttons[index]?.value ?? 0
  const pressed = (index: number): boolean => pad.buttons[index]?.pressed ?? false

  return {
    throttle: Math.max(pressed(Button.A) ? 1 : 0, value(Button.RightTrigger)),
    brake: Math.max(pressed(Button.B) ? 1 : 0, value(Button.LeftTrigger)),
    steer: applyDeadzone(pad.axes[LEFT_STICK_X] ?? 0, deadzone),
    jump: pressed(Button.RightBumper),
    boost: pressed(Button.LeftBumper),
    useItem: pressed(Button.X),
    lookBack: pressed(Button.Y),
  }
}

/** Reads the first connected gamepad that uses the standard mapping. */
export class GamepadSource implements InputSource {
  read(): KartInput {
    const pad = navigator.getGamepads().find((p) => p?.connected && p.mapping === 'standard')
    return pad ? gamepadToInput(pad) : { ...NEUTRAL_INPUT }
  }
}
