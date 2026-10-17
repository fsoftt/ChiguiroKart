import type { Rng } from '../../ai/random'
import type { ItemsConfig, PowerBand } from '../../config/items'
import { POWER_IDS, type PowerId } from './itemTypes'

/** Band of the distribution table for a 1-based rank among `total` racers. */
export function bandFor(config: ItemsConfig, rank: number, total: number): PowerBand {
  // A lone racer counts as the leader
  const fraction = total <= 1 ? 0 : rank / total
  const last = config.distribution[config.distribution.length - 1]
  const band = config.distribution.find((candidate) => fraction <= candidate.upTo) ?? last
  if (!band) throw new Error('The power distribution has no bands')
  return band
}

/** Weighted random power for a rank. Iterates in a fixed order so a seed replays the same. */
export function pickPower(config: ItemsConfig, rank: number, total: number, rng: Rng): PowerId {
  const { weights } = bandFor(config, rank, total)
  const entries = POWER_IDS.map((id) => [id, weights[id] ?? 0] as const).filter(
    ([, weight]) => weight > 0,
  )
  const sum = entries.reduce((acc, [, weight]) => acc + weight, 0)
  let roll = rng() * sum
  for (const [id, weight] of entries) {
    roll -= weight
    if (roll < 0) return id
  }
  const fallback = entries[entries.length - 1]
  if (!fallback) throw new Error('The power band has no weights')
  return fallback[0]
}

/** Uses a freshly rolled power has (3 mangos, 2 tejos when charged...). */
export function usesFor(config: ItemsConfig, power: PowerId, charged: boolean): number {
  if (power === 'mango') {
    return charged ? config.powers.mango.chargedUses : config.powers.mango.uses
  }
  if (power === 'tejo') return charged ? config.powers.tejo.chargedUses : config.powers.tejo.uses
  return 1
}
