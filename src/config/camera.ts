export interface ChaseCameraConfig {
  /** Distance behind the kart (m). */
  distance: number
  /** Height above the kart (m). */
  height: number
  /** Height of the point the camera looks at (m). */
  lookHeight: number
  /** How far ahead of the kart the camera looks (m). */
  lookAhead: number
  /** How quickly the camera catches up with the kart (1/s). */
  followSmoothing: number
  /** Field of view when stopped (degrees). */
  baseFov: number
  /** Extra field of view at top speed (degrees). */
  speedFovBoost: number
}

export const defaultChaseCamera: ChaseCameraConfig = {
  distance: 6.5,
  height: 2.6,
  lookHeight: 1,
  lookAhead: 4,
  followSmoothing: 7,
  baseFov: 62,
  speedFovBoost: 14,
}
