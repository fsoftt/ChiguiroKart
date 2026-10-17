import type { TrackTheme } from '../../src/config/tracks/theme'

/**
 * Every kind of scenery a theme shows: scattered decorations, plant models of its environment
 * and environment props. A landmark may live in any of them.
 */
export function themeLandmarks(theme: TrackTheme): string[] {
  const environment = theme.environment
  return [
    ...theme.decorations.filter((set) => set.count > 0).map((set) => set.kind),
    ...Object.values(environment?.vegetation.models ?? {}),
    ...(environment?.decor.props.map((prop) => prop.kind) ?? []),
  ]
}
