/** Starting grid layout. Distances in meters. */
export interface GridConfig {
  /** Sideways distance of each kart from the centerline. */
  lateralOffset: number
  /** Distance between consecutive rows along the start heading. */
  rowSpacing: number
  /** Extra distance the right-hand kart of a row sits behind the left-hand one. */
  stagger: number
}

export const defaultGrid: GridConfig = {
  lateralOffset: 3,
  rowSpacing: 5,
  stagger: 2,
}
