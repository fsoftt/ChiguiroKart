import type { CharacterId } from '../config/characters'
import type { CupId, TrackId } from '../config/tracks/catalog'
import type { PowerId } from '../sim/items/itemTypes'
import { t } from './index'

/** Display names in the current language. Config names stay Spanish: they are data keys. */
export const characterName = (id: CharacterId): string => t(`characters.${id}.name`)
export const perkName = (id: CharacterId): string => t(`characters.${id}.perkName`)
export const perkDescription = (id: CharacterId): string => t(`characters.${id}.perkDescription`)
export const trackName = (id: TrackId): string => t(`tracks.${id}`)
export const cupName = (id: CupId): string => t(`cups.${id}`)
export const powerName = (id: PowerId): string => t(`powers.${id}`)
