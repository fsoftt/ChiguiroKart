import type { SurfaceType } from '../sim/race/surface'
import type { TideRule } from '../sim/track'

/** Surface a tidal branch shows: the sandbank at low tide, shallow water at high tide. */
export function tideSurface(rule: TideRule, low: boolean): SurfaceType {
  return low ? rule.lowSurface : rule.highSurface
}
