import type { Quality } from './quality'

/** Renderer cost of one frame (shadow pass and bloom included), as `renderer.info` counts it. */
export interface FrameCost {
  drawCalls: number
  triangles: number
}

/**
 * Per-frame limits with 8 karts on screen. Baja is the phone default (target: 30 FPS on a
 * mid-range phone); Alta has no limit. `scripts/perfReport.mjs` checks them on every track.
 */
export const perfBudgets: Record<Quality, FrameCost> = {
  low: { drawCalls: 150, triangles: 300_000 },
  medium: { drawCalls: 250, triangles: 700_000 },
  high: { drawCalls: Infinity, triangles: Infinity },
}

/** What a frame goes over the budget of its quality in: empty when it fits. */
export function budgetViolations(quality: Quality, cost: FrameCost): string[] {
  const budget = perfBudgets[quality]
  const broken: string[] = []
  if (cost.drawCalls > budget.drawCalls) broken.push('drawCalls')
  if (cost.triangles > budget.triangles) broken.push('triangles')
  return broken
}
