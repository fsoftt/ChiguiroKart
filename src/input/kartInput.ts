/** Everything a kart can be told to do in one tick. Produced by players and bots alike. */
export interface KartInput {
  /** 0..1 */
  throttle: number
  /** 0..1 */
  brake: number
  /** -1 (left) .. 1 (right) */
  steer: number
  jump: boolean
  boost: boolean
  useItem: boolean
  lookBack: boolean
}

export interface InputSource {
  read(): KartInput
}

export const NEUTRAL_INPUT: Readonly<KartInput> = Object.freeze({
  throttle: 0,
  brake: 0,
  steer: 0,
  jump: false,
  boost: false,
  useItem: false,
  lookBack: false,
})

/** Merges several devices: strongest analog value wins, buttons are OR-ed. */
export function combineInputs(inputs: readonly KartInput[]): KartInput {
  const result: KartInput = { ...NEUTRAL_INPUT }
  for (const input of inputs) {
    result.throttle = Math.max(result.throttle, input.throttle)
    result.brake = Math.max(result.brake, input.brake)
    if (Math.abs(input.steer) > Math.abs(result.steer)) result.steer = input.steer
    result.jump ||= input.jump
    result.boost ||= input.boost
    result.useItem ||= input.useItem
    result.lookBack ||= input.lookBack
  }
  return result
}
