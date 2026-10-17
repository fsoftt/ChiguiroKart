import type { TrackDefinition } from '../../sim/track'
import { buildTrackDefinition, type TrackData } from '../../sim/trackData'
import { cocoraTheme } from './cocoraTheme'
import { cocoraTrack } from './cocoraTrack'
import type { TrackTheme } from './theme'
import { nevadoData, nevadoTheme } from './nevadoTrack'
import { zipaquiraData, zipaquiraTheme } from './zipaquiraTrack'
import { bogotaData, bogotaTheme } from './bogotaTrack'
import { cartagenaData, cartagenaTheme } from './cartagenaTrack'
import { ciudadPerdidaData, ciudadPerdidaTheme } from './ciudadPerdidaTrack'
import { sanAndresData, sanAndresTheme } from './sanAndresTrack'
import { barranquillaData, barranquillaTheme } from './barranquillaTrack'
import { canoCristalesData, canoCristalesTheme } from './canoCristalesTrack'
import { llanosData, llanosTheme } from './llanosTrack'
import { amazonasData, amazonasTheme } from './amazonasTrack'
import { tatacoaData, tatacoaTheme } from './tatacoaTrack'

export type TrackId =
  | 'cocora'
  | 'nevado'
  | 'zipaquira'
  | 'bogota'
  | 'cartagena'
  | 'ciudadPerdida'
  | 'sanAndres'
  | 'barranquilla'
  | 'canoCristales'
  | 'llanos'
  | 'amazonas'
  | 'tatacoa'

export type CupId = 'andina' | 'caribe' | 'selva'

export interface TrackInfo {
  id: TrackId
  /** Shown in menus; also the key of records and ghosts. */
  name: string
  cup: CupId
  theme: TrackTheme
  /** Builds the simulation track (cheap enough to call when a race starts). */
  build(): TrackDefinition
}

export interface CupInfo {
  id: CupId
  name: string
  /** The four tracks, in race order. */
  tracks: readonly [TrackId, TrackId, TrackId, TrackId]
}

function dataTrack(id: TrackId, cup: CupId, data: TrackData, theme: TrackTheme): TrackInfo {
  return { id, name: data.name, cup, theme, build: () => buildTrackDefinition(data) }
}

export const tracks: Record<TrackId, TrackInfo> = {
  cocora: {
    id: 'cocora',
    name: cocoraTrack.name,
    cup: 'andina',
    theme: cocoraTheme,
    build: () => cocoraTrack,
  },
  nevado: dataTrack('nevado', 'andina', nevadoData, nevadoTheme),
  zipaquira: dataTrack('zipaquira', 'andina', zipaquiraData, zipaquiraTheme),
  bogota: dataTrack('bogota', 'andina', bogotaData, bogotaTheme),
  cartagena: dataTrack('cartagena', 'caribe', cartagenaData, cartagenaTheme),
  ciudadPerdida: dataTrack('ciudadPerdida', 'caribe', ciudadPerdidaData, ciudadPerdidaTheme),
  sanAndres: dataTrack('sanAndres', 'caribe', sanAndresData, sanAndresTheme),
  barranquilla: dataTrack('barranquilla', 'caribe', barranquillaData, barranquillaTheme),
  canoCristales: dataTrack('canoCristales', 'selva', canoCristalesData, canoCristalesTheme),
  llanos: dataTrack('llanos', 'selva', llanosData, llanosTheme),
  amazonas: dataTrack('amazonas', 'selva', amazonasData, amazonasTheme),
  tatacoa: dataTrack('tatacoa', 'selva', tatacoaData, tatacoaTheme),
}

export const cups: readonly CupInfo[] = [
  { id: 'andina', name: 'Copa Andina', tracks: ['cocora', 'nevado', 'zipaquira', 'bogota'] },
  {
    id: 'caribe',
    name: 'Copa Caribe',
    tracks: ['cartagena', 'ciudadPerdida', 'sanAndres', 'barranquilla'],
  },
  {
    id: 'selva',
    name: 'Copa Selva y Llano',
    tracks: ['canoCristales', 'llanos', 'amazonas', 'tatacoa'],
  },
]

/** Every track id, cup by cup. */
export const trackIds: readonly TrackId[] = cups.flatMap((cup) => cup.tracks)

export function isTrackId(value: string | null): value is TrackId {
  return trackIds.some((id) => id === value)
}

export function isCupId(value: string | null): value is CupId {
  return cups.some((cup) => cup.id === value)
}

export function cupInfo(id: CupId): CupInfo {
  const cup = cups.find((c) => c.id === id)
  if (!cup) throw new Error(`Unknown cup ${id}`)
  return cup
}
