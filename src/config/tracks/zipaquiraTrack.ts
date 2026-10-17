import type { TrackData } from '../../sim/trackData'
import { DEFAULT_THEME, type TrackTheme } from './theme'

// Placeholder layout: a plain oval until the real circuit is designed
export const zipaquiraData: TrackData = {
  version: 1,
  name: 'Catedral de Sal de Zipaquirá',
  halfWidth: 9,
  samplesPerSegment: 14,
  points: [
    { x: 0, z: -100, y: 0 },
    { x: 100, z: -70, y: 0 },
    { x: 130, z: 0, y: 0 },
    { x: 100, z: 70, y: 0 },
    { x: 0, z: 100, y: 0 },
    { x: -100, z: 70, y: 0 },
    { x: -130, z: 0, y: 0 },
    { x: -100, z: -70, y: 0 },
  ],
  branches: [],
  checkpoints: { count: 6, optional: [] },
  itemBoxRows: [{ at: 0.2, count: 4 }],
  uchuvaLines: [{ at: 0.4, count: 5, offset: 0 }],
}

export const zipaquiraTheme: TrackTheme = DEFAULT_THEME
