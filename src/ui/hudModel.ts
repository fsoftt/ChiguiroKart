import type { DriftConfig } from '../config/drift'
import type { KartPhysicsConfig } from '../config/kartPhysics'
import { forwardSpeed } from '../sim/kart/kartPhysics'
import type { KartState } from '../sim/kart/kartState'

const KMH_PER_MS = 3.6
const FALLBACK_COLOR = '#ff3b30'
const HEX_RADIX = 16
const HEX_DIGITS_PER_CHANNEL = 2
const CHANNEL_MAX = 255
const RGB_CHANNELS = 3

export interface HudPip {
  filled: boolean
  /** Level color when filled, empty string otherwise. */
  color: string
}

/** Plain data the HUD draws; contains no DOM and no simulation references. */
export interface HudModel {
  /** Forward speed in whole km/h (never negative). */
  speedKmh: number
  /** Forward speed over the base top speed, 0..1 (boosts clamp at 1). */
  speedRatio: number
  barVisible: boolean
  /** Charge bar fill, 0..1. */
  fill: number
  redZoneStart: number
  barColor: string
  chainBroken: boolean
  pips: readonly [HudPip, HudPip, HudPip]
  /** Text of the active nitro, empty when none. */
  nitroLabel: string
  nitroColor: string
  /** Remaining nitro time over the reserve cap, 0..1. */
  nitroTimeFraction: number
  perfect: boolean
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function parseHex(color: string): number[] {
  const digits = color.replace('#', '')
  const channels: number[] = []
  for (let i = 0; i < RGB_CHANNELS; i++) {
    const start = i * HEX_DIGITS_PER_CHANNEL
    channels.push(parseInt(digits.slice(start, start + HEX_DIGITS_PER_CHANNEL), HEX_RADIX))
  }
  return channels
}

function toHex(channel: number): string {
  const clamped = Math.min(CHANNEL_MAX, Math.max(0, Math.round(channel)))
  return clamped.toString(HEX_RADIX).padStart(HEX_DIGITS_PER_CHANNEL, '0')
}

/** Linear interpolation between two `#rrggbb` colors. */
export function mixColors(from: string, to: string, t: number): string {
  const a = parseHex(from)
  const b = parseHex(to)
  return `#${a.map((channel, i) => toHex(channel + ((b[i] ?? channel) - channel) * t)).join('')}`
}

/** Bar color: smoke gradient up to the red zone, last smoke color inside it, dark when broken. */
export function chargeColor(charge: number, broken: boolean, drift: DriftConfig): string {
  if (broken) return drift.brokenSmokeColor
  const colors = drift.smokeColors
  const last = colors[colors.length - 1] ?? FALLBACK_COLOR
  if (charge >= drift.redZoneStart || colors.length < 2) return last
  const position = clamp01(charge / drift.redZoneStart) * (colors.length - 1)
  const index = Math.min(Math.floor(position), colors.length - 2)
  const from = colors[index] ?? last
  const to = colors[index + 1] ?? last
  return mixColors(from, to, position - index)
}

function pipAt(kart: KartState, drift: DriftConfig, index: number): HudPip {
  const filled = kart.drift.nitrosInChain > index
  return { filled, color: filled ? (drift.levels[index]?.color ?? '') : '' }
}

/** Builds everything the HUD needs for one frame from the (interpolated) kart. */
export function buildHudModel(
  kart: KartState,
  physics: KartPhysicsConfig,
  drift: DriftConfig,
): HudModel {
  const speed = Math.max(0, forwardSpeed(kart))
  const level = kart.boost.level
  const active = level > 0
  return {
    speedKmh: Math.round(speed * KMH_PER_MS),
    speedRatio: clamp01(speed / physics.maxSpeed),
    barVisible: kart.drift.direction !== 0,
    fill: clamp01(kart.drift.charge),
    redZoneStart: drift.redZoneStart,
    barColor: chargeColor(kart.drift.charge, kart.drift.chainBroken, drift),
    chainBroken: kart.drift.chainBroken,
    pips: [pipAt(kart, drift, 0), pipAt(kart, drift, 1), pipAt(kart, drift, 2)],
    nitroLabel: active ? `NITRO ${level}` : '',
    nitroColor: active ? (drift.levels[level - 1]?.color ?? '') : '',
    nitroTimeFraction: active ? clamp01(kart.boost.timeLeft / drift.maxReserve) : 0,
    perfect: active && kart.boost.perfect,
  }
}
