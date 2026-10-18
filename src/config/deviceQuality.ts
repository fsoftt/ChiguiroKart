import type { Quality } from './quality'

/** What the browser tells about the device; every hint may be missing (Safari, Firefox). */
export interface DeviceHints {
  /** `(pointer: coarse)`: a phone or tablet. */
  coarsePointer: boolean
  /** `navigator.deviceMemory`: approximate RAM in GB (Chromium only, capped at 8). */
  deviceMemory?: number | undefined
  /** `navigator.hardwareConcurrency`: logical cores. */
  hardwareConcurrency?: number | undefined
}

/** At or below these, the device gets Baja. */
const LOW_MEMORY_GB = 2
const LOW_CORES = 2
/** At or below these (and above the low ones), Media. */
const MID_MEMORY_GB = 4
const MID_CORES = 4

/**
 * The graphics quality a device starts with when the player has not chosen one: phones and
 * tablets and weak machines get Baja, middling ones Media and the rest Alta. Missing hints
 * count as "no information", never as "weak".
 */
export function defaultQualityFor(hints: DeviceHints): Quality {
  const { coarsePointer, deviceMemory, hardwareConcurrency } = hints
  if (coarsePointer) return 'low'
  if (deviceMemory !== undefined && deviceMemory <= LOW_MEMORY_GB) return 'low'
  if (hardwareConcurrency !== undefined && hardwareConcurrency <= LOW_CORES) return 'low'
  if (deviceMemory !== undefined && deviceMemory <= MID_MEMORY_GB) return 'medium'
  if (hardwareConcurrency !== undefined && hardwareConcurrency <= MID_CORES) return 'medium'
  return 'high'
}

/** Reads the hints from the browser; empty outside one. */
export function readDeviceHints(): Omit<DeviceHints, 'coarsePointer'> {
  if (typeof navigator === 'undefined') return {}
  const { deviceMemory, hardwareConcurrency } = navigator as Navigator & { deviceMemory?: number }
  return { deviceMemory, hardwareConcurrency }
}
