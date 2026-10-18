/** Menu screens in the order the player walks through them. */
export const MENU_STEP_ORDER = ['mode', 'track', 'character', 'race'] as const
export type StepName = (typeof MENU_STEP_ORDER)[number]

/** How a screen enters: from the right (forward), from the left (back) or a plain pop-in. */
export type StepDirection = 'forward' | 'back' | 'enter'

/** Direction of the transition between two menu steps; `enter` when the menu just opened. */
export function stepDirection(from: StepName | null, to: StepName): StepDirection {
  if (from === null || from === to) return 'enter'
  return MENU_STEP_ORDER.indexOf(to) > MENU_STEP_ORDER.indexOf(from) ? 'forward' : 'back'
}

/**
 * Whether animations are reduced. A saved choice wins; with none, the system preference
 * (`prefers-reduced-motion`) decides.
 */
export function resolveReduceMotion(saved: unknown, systemPrefersReduced: boolean): boolean {
  return typeof saved === 'boolean' ? saved : systemPrefersReduced
}

/** Longest stagger step index; later items share the last delay so long lists stay quick. */
export const MAX_STAGGER_INDEX = 12

export function staggerIndex(index: number): number {
  if (!Number.isFinite(index) || index < 0) return 0
  return Math.min(Math.floor(index), MAX_STAGGER_INDEX)
}
