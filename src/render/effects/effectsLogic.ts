import type { DriftConfig } from '../../config/drift'
import type { SpeedLinesConfig } from '../../config/effects'
import { clamp, lerp } from '../../sim/math'
import type { BoostState, DriftState, NitroLevel } from '../../sim/kart/driftState'

/** Red, green, blue in 0..1. */
export interface Rgb {
  r: number
  g: number
  b: number
}

/** Boost time increase (s) that counts as a new nitro rather than float noise. */
const NEW_NITRO_EPSILON = 1e-4

/** Parses `#rrggbb` into 0..1 channels. */
export function hexToRgb(hex: string, out: Rgb = { r: 0, g: 0, b: 0 }): Rgb {
  const value = Number.parseInt(hex.replace('#', ''), 16)
  out.r = ((value >> 16) & 0xff) / 255
  out.g = ((value >> 8) & 0xff) / 255
  out.b = (value & 0xff) / 255
  return out
}

/** Precomputed RGB for every smoke color so per-frame selection allocates nothing. */
export interface SmokePalette {
  /** Colors interpolated while charging, before the red zone. */
  gradient: readonly Rgb[]
  redZone: Rgb
  broken: Rgb
}

export function createSmokePalette(config: DriftConfig): SmokePalette {
  const colors = config.smokeColors.map((hex) => hexToRgb(hex))
  const redZone = colors[colors.length - 1] ?? hexToRgb(config.brokenSmokeColor)
  const gradient = colors.length > 1 ? colors.slice(0, -1) : [redZone]
  return { gradient, redZone, broken: hexToRgb(config.brokenSmokeColor) }
}

function copyRgb(from: Rgb, out: Rgb): Rgb {
  out.r = from.r
  out.g = from.g
  out.b = from.b
  return out
}

/**
 * Smoke color for the current drift: black when the chain is broken, the last color in the
 * red zone, otherwise an interpolation through the remaining colors as charge rises.
 */
export function smokeColorAt(
  drift: Pick<DriftState, 'charge' | 'chainBroken'>,
  redZoneStart: number,
  palette: SmokePalette,
  out: Rgb,
): Rgb {
  if (drift.chainBroken) return copyRgb(palette.broken, out)
  if (drift.charge >= redZoneStart) return copyRgb(palette.redZone, out)
  const { gradient } = palette
  const segments = gradient.length - 1
  const position = clamp(drift.charge / redZoneStart, 0, 1) * segments
  const index = Math.min(Math.floor(position), Math.max(segments - 1, 0))
  const from = gradient[index]
  const to = gradient[Math.min(index + 1, segments)]
  if (!from || !to) return copyRgb(palette.redZone, out)
  const t = position - index
  out.r = lerp(from.r, to.r, t)
  out.g = lerp(from.g, to.g, t)
  out.b = lerp(from.b, to.b, t)
  return out
}

/**
 * Level of a nitro that started between two boost snapshots, or 0 if none did.
 * A start is a higher level or more boost time than before (a refreshed or chained nitro).
 */
export function detectNitroStart(
  previous: Pick<BoostState, 'level' | 'timeLeft'>,
  current: Pick<BoostState, 'level' | 'timeLeft'>,
): NitroLevel {
  if (current.level === 0) return 0
  const started =
    current.level > previous.level || current.timeLeft > previous.timeLeft + NEW_NITRO_EPSILON
  return started ? current.level : 0
}

/** True on the frame the drift chain becomes broken. */
export function detectChainBreak(
  previous: Pick<DriftState, 'chainBroken'>,
  current: Pick<DriftState, 'chainBroken'>,
): boolean {
  return !previous.chainBroken && current.chainBroken
}

/** Speed line strength 0..1 from speed ratio and active nitro level. */
export function speedLineTarget(
  speedRatio: number,
  level: NitroLevel,
  config: SpeedLinesConfig,
): number {
  const t = clamp((Math.abs(speedRatio) - config.startRatio) / (1 - config.startRatio), 0, 1)
  const speedPart = config.baseIntensity * t * t * (3 - 2 * t)
  const boostPart = level > 0 ? (config.levelIntensity[level - 1] ?? 0) : 0
  return clamp(speedPart + boostPart, 0, 1)
}
