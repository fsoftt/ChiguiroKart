import type { DriftConfig } from '../config/drift'
import type { KartPhysicsConfig } from '../config/kartPhysics'
import { forwardSpeed } from '../sim/kart/kartPhysics'
import type { KartState } from '../sim/kart/kartState'
import type { RaceState } from '../sim/race/raceState'

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

export interface FinalTimes {
  lap1: string
  lap2: string
  lap3: string
  total: string
  best: string
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

  // Race data
  countdownLabel: string
  lapText: string
  timeText: string
  bestLapText: string
  wrongWay: boolean
  finished: boolean
  finalTimes: FinalTimes | null
  /** Player position badge, e.g. "1.º"; empty when no standings were given. */
  positionText: string
  /** Total racers badge, e.g. "/4". */
  positionTotalText: string
  /** Results line, e.g. "Posición: 2.º de 4"; empty unless the race is finished. */
  finalPositionText: string
}

/** Player rank (1-based) and number of racers. */
export interface RacePosition {
  rank: number
  total: number
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

/** Formats seconds into MM:SS.cc */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const hundredths = Math.floor((seconds % 1) * 100)
  return `${mins}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`
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

function computeCountdownLabel(race: RaceState): string {
  if (race.phase === 'finished') return ''
  if (race.phase === 'countdown') {
    if (race.countdown > 2.0) return '3'
    if (race.countdown > 1.0) return '2'
    if (race.countdown > 0.0) return '1'
    return '¡YA!'
  }
  if (race.totalRaceTime < 1.4) return '¡YA!'
  return ''
}

/** Spanish ordinal with masculine marker, e.g. "3.º". */
export function formatOrdinal(rank: number): string {
  return `${rank}.º`
}

function computeLapText(race: RaceState): string {
  if (race.phase === 'countdown') return `VUELTA 1/${race.totalLaps}`
  if (race.currentLap === race.totalLaps) return `¡ÚLTIMA VUELTA!`
  return `VUELTA ${race.currentLap}/${race.totalLaps}`
}

/** Builds everything the HUD needs for one frame from the kart and race state. */
export function buildHudModel(
  kart: KartState,
  physics: KartPhysicsConfig,
  drift: DriftConfig,
  race?: RaceState,
  position?: RacePosition,
): HudModel {
  const speed = Math.max(0, forwardSpeed(kart))
  const level = kart.boost.level
  const active = level > 0

  let countdownLabel = ''
  let lapText = ''
  let timeText = ''
  let bestLapText = ''
  let wrongWay = false
  let finished = false
  let finalTimes: FinalTimes | null = null

  const positionText = position ? formatOrdinal(position.rank) : ''
  const positionTotalText = position ? `/${position.total}` : ''
  let finalPositionText = ''

  if (race) {
    countdownLabel = computeCountdownLabel(race)
    lapText = computeLapText(race)
    timeText = formatTime(race.phase === 'finished' ? race.totalRaceTime : race.currentLapTime)
    bestLapText = race.bestLapTime !== null ? `MEJOR: ${formatTime(race.bestLapTime)}` : ''
    wrongWay = race.wrongWay
    finished = race.phase === 'finished'

    if (finished) {
      if (position) {
        finalPositionText = `Posición: ${formatOrdinal(position.rank)} de ${position.total}`
      }
      finalTimes = {
        lap1: formatTime(race.lapTimes[0] ?? 0),
        lap2: formatTime(race.lapTimes[1] ?? 0),
        lap3: formatTime(race.lapTimes[2] ?? 0),
        total: formatTime(race.totalRaceTime),
        best: formatTime(race.bestLapTime ?? 0),
      }
    }
  }

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

    countdownLabel,
    lapText,
    timeText,
    bestLapText,
    wrongWay,
    finished,
    finalTimes,
    positionText,
    positionTotalText,
    finalPositionText,
  }
}
