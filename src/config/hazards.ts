/**
 * Tuning of boost pads and track hazards (see `TrackDefinition.boostPads` / `hazards`).
 * Bumps reuse the wall bounce and friction of the kart physics.
 */

export interface HazardsConfig {
  pad: {
    /** Seconds of level 1 nitro a pad gives; touching it again refreshes it, never stacks. */
    boostDuration: number
  }
  obstacle: {
    /** Largest height gap (m) at which a kart still touches an obstacle (jumping over it). */
    contactHeight: number
    /** Into-obstacle speed (m/s) under which a bump makes no event (resting contact). */
    bumpEventSpeed: number
    /** Nitro level needed to break an ice wall. */
    breakLevel: number
    /** Seconds a broken ice wall stays open before it comes back. */
    iceWallRespawn: number
  }
}

export const defaultHazards: HazardsConfig = {
  pad: { boostDuration: 0.7 },
  obstacle: {
    contactHeight: 2.5,
    bumpEventSpeed: 3,
    breakLevel: 3,
    iceWallRespawn: 8,
  },
}
