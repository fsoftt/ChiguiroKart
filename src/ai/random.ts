/** Deterministic random numbers in [0, 1) (mulberry32), so bots replay identically. */
export type Rng = () => number

export function createRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Mixes a base seed with a slot number into one well-spread seed. */
export function seedFor(base: number, slot: number): number {
  return Math.imul(base ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(slot + 1, 0xc2b2ae35)
}
