/**
 * Music as data (docs/diseno.md §2.6): one rhythm style per Colombian genre and one theme
 * per track. A bar is `stepsPerBar` sixteenth steps: 16 for 4/4 genres, 12 for the 6/8 and
 * 3/4 ones (bambuco, pasillo, joropo, currulao, sanjuanero). Everything is generated with
 * oscillators and noise, so there are no audio files and no licenses.
 */
import type { ScaleName } from '../audio/audioMath'
import type { TrackId } from './tracks/catalog'

export type StyleId =
  | 'cumbia'
  | 'vallenato'
  | 'champeta'
  | 'salsa'
  | 'calypso'
  | 'joropo'
  | 'bambuco'
  | 'pasillo'
  | 'currulao'
  | 'sanjuanero'
  | 'andino'
  | 'selva'

/** Velocity 0..1 for each step of a bar; 0 = silent. */
type Hits = readonly number[]

export interface RhythmStyle {
  stepsPerBar: number
  kick: Hits
  snare: Hits
  hat: Hits
  /** Extra percussion (cowbell, tambor, clave). */
  perc: Hits
  /** Bass: degree offset from the bar's chord root on each step, null = rest. */
  bass: readonly (number | null)[]
  /** Chord stabs (accordion, piano, marimba): velocity per step. */
  stab: Hits
}

/** 'x' hit, 'o' soft hit, '.' rest, spaces ignored. */
function hits(text: string): Hits {
  return [...text.replace(/\s+/g, '')].map((c) => (c === 'x' ? 1 : c === 'o' ? 0.55 : 0))
}

/** Space-separated degree offsets, '.' for a rest. */
function bassLine(text: string): readonly (number | null)[] {
  return text
    .trim()
    .split(/\s+/)
    .map((token) => (token === '.' ? null : Number(token)))
}

export const rhythmStyles: Record<StyleId, RhythmStyle> = {
  // Guacharaca ticks, llamador on the offbeats, bass walking root and fifth
  cumbia: {
    stepsPerBar: 16,
    kick: hits('x.......x.......'),
    snare: hits('....o.......o...'),
    hat: hits('x.xxx.xxx.xxx.xx'),
    perc: hits('..o...o...o...o.'),
    bass: bassLine('0 . . . . . 4 . 0 . . . . . 4 .'),
    stab: hits('..x...x...x...x.'),
  },
  // Caja pattern of the paseo, guacharaca straight eighths
  vallenato: {
    stepsPerBar: 16,
    kick: hits('x.......x.......'),
    snare: hits('o..o..o.o..o..o.'),
    hat: hits('x.x.x.x.x.x.x.x.'),
    perc: hits('................'),
    bass: bassLine('0 . . 0 . . 4 . 0 . . 0 . . 4 .'),
    stab: hits('..x...x...x...x.'),
  },
  // Syncopated kick, cowbell and busy hats
  champeta: {
    stepsPerBar: 16,
    kick: hits('x..x..x.x..x..x.'),
    snare: hits('....x.......x...'),
    hat: hits('oxoxoxoxoxoxoxox'),
    perc: hits('..x..x..x..x..x.'),
    bass: bassLine('0 . . 0 . . 4 . 0 . . 0 . . 5 .'),
    stab: hits('x..x..x...x..x..'),
  },
  // 3-2 son clave, tumbao bass and piano montuno
  salsa: {
    stepsPerBar: 16,
    kick: hits('..x...x...x...x.'),
    snare: hits('....o.......o...'),
    hat: hits('x.x.x.x.x.x.x.x.'),
    perc: hits('x..x..x...x.x...'),
    bass: bassLine('. . 0 . . 0 4 . . . 0 . . 0 4 .'),
    stab: hits('.x..x..x.x..x...'),
  },
  // Island groove: four on the floor and offbeat chords
  calypso: {
    stepsPerBar: 16,
    kick: hits('x...x...x...x...'),
    snare: hits('....x.......x...'),
    hat: hits('o.x.o.x.o.x.o.x.'),
    perc: hits('.x..x..x.x..x..x'),
    bass: bassLine('0 . . 0 . . 4 . 0 . . 0 . 4 . 5'),
    stab: hits('..x...x...x...x.'),
  },
  // 6/8 with the maracas running and the harp-like arpeggios in the lead
  joropo: {
    stepsPerBar: 12,
    kick: hits('x.....o.....'),
    snare: hits('..o...o...o.'),
    hat: hits('x.xx.xx.xx.x'),
    perc: hits('............'),
    bass: bassLine('0 . . . 4 . 0 . . . 4 .'),
    stab: hits('..x...x...x.'),
  },
  // Andean 6/8 alternating with 3/4
  bambuco: {
    stepsPerBar: 12,
    kick: hits('x.....o.....'),
    snare: hits('..o...o...o.'),
    hat: hits('x.x.x.x.x.x.'),
    perc: hits('............'),
    bass: bassLine('0 . . 4 . . 0 . 4 . . 4'),
    stab: hits('..x.x...x.x.'),
  },
  // Slow waltz of the Andes
  pasillo: {
    stepsPerBar: 12,
    kick: hits('x...........'),
    snare: hits('....o...o...'),
    hat: hits('o.o.o.o.o.o.'),
    perc: hits('............'),
    bass: bassLine('0 . . . 4 . . . 4 . . .'),
    stab: hits('....x...x...'),
  },
  // Pacific marimba ostinato and drums
  currulao: {
    stepsPerBar: 12,
    kick: hits('x.....x.x...'),
    snare: hits('..x..x..x..x'),
    hat: hits('x.xx.xx.xx.x'),
    perc: hits('o..o..o..o..'),
    bass: bassLine('0 . 0 . . 4 0 . 0 . . 4'),
    stab: hits('x..x..x..x..'),
  },
  // Bright 6/8 of the Huila festivals
  sanjuanero: {
    stepsPerBar: 12,
    kick: hits('x.....x.....'),
    snare: hits('..o...o...o.'),
    hat: hits('x.x.x.x.x.x.'),
    perc: hits('............'),
    bass: bassLine('0 . . 4 . . 0 . . 4 . .'),
    stab: hits('..x.x...x.x.'),
  },
  // Slow bombo legüero pulse
  andino: {
    stepsPerBar: 16,
    kick: hits('x.......x..x....'),
    snare: hits('................'),
    hat: hits('..o...o...o...o.'),
    perc: hits('................'),
    bass: bassLine('0 . . . . . 4 . 0 . . . . . 4 .'),
    stab: hits('x.......x.......'),
  },
  // Tribal toms and a steady pulse
  selva: {
    stepsPerBar: 16,
    kick: hits('x..x..x.x..x..x.'),
    snare: hits('....x.......x...'),
    hat: hits('o.o.o.o.o.o.o.o.'),
    perc: hits('..x...x...x...x.'),
    bass: bassLine('0 . . . 0 . . . 0 . . . 5 . . .'),
    stab: hits('x...............'),
  },
}

/** A lead note: start step inside the motif, scale degree (0 = root), length in steps. */
export type LeadNote = readonly [step: number, degree: number, length: number]

export interface MusicTheme {
  style: StyleId
  /** Beats per minute; four steps per beat. */
  tempo: number
  /** MIDI note of the tonic (the bass plays an octave below, the lead one above). */
  root: number
  scale: ScaleName
  /** Chord root as a scale degree, one per bar; the progression loops. */
  chords: readonly number[]
  /** Length of the lead motif in bars; it loops. */
  leadBars: number
  lead: readonly LeadNote[]
  leadWave: OscillatorType
}

export type ThemeId = TrackId | 'menu'

export const musicThemes: Record<ThemeId, MusicTheme> = {
  menu: {
    style: 'calypso',
    tempo: 104,
    root: 62,
    scale: 'major',
    chords: [0, 5, 3, 4],
    leadBars: 2,
    lead: [
      [0, 4, 2],
      [2, 5, 2],
      [4, 7, 4],
      [10, 5, 2],
      [12, 4, 4],
      [16, 2, 2],
      [18, 4, 2],
      [20, 5, 4],
      [26, 4, 2],
      [28, 2, 4],
    ],
    leadWave: 'triangle',
  },
  // Bambuco: the Valle de Cocora's palms and a gentle melody
  cocora: {
    style: 'bambuco',
    tempo: 100,
    root: 55,
    scale: 'major',
    chords: [0, 3, 4, 0],
    leadBars: 2,
    lead: [
      [0, 4, 3],
      [3, 2, 3],
      [6, 0, 3],
      [9, 2, 2],
      [12, 4, 3],
      [15, 5, 3],
      [18, 4, 3],
      [21, 2, 3],
    ],
    leadWave: 'triangle',
  },
  // Slow pentatonic Andean theme over the bombo
  nevado: {
    style: 'andino',
    tempo: 84,
    root: 52,
    scale: 'minor',
    chords: [0, 5, 6, 0],
    leadBars: 2,
    lead: [
      [0, 4, 4],
      [4, 2, 2],
      [6, 0, 2],
      [8, -1, 6],
      [16, 2, 4],
      [20, 4, 2],
      [22, 5, 2],
      [24, 4, 8],
    ],
    leadWave: 'sine',
  },
  // Dark minor pasillo for the salt cathedral
  zipaquira: {
    style: 'pasillo',
    tempo: 112,
    root: 50,
    scale: 'minor',
    chords: [0, 3, 4, 0],
    leadBars: 2,
    lead: [
      [0, 4, 4],
      [4, 5, 2],
      [6, 4, 4],
      [10, 2, 2],
      [12, 3, 4],
      [16, 2, 4],
      [20, 1, 2],
      [22, 0, 2],
    ],
    leadWave: 'triangle',
  },
  // Urban salsa with a brassy lead
  bogota: {
    style: 'salsa',
    tempo: 104,
    root: 57,
    scale: 'dorian',
    chords: [0, 3, 0, 4],
    leadBars: 2,
    lead: [
      [0, 4, 2],
      [3, 4, 1],
      [4, 5, 2],
      [7, 4, 1],
      [8, 2, 4],
      [16, 4, 2],
      [19, 5, 1],
      [20, 7, 2],
      [23, 5, 1],
      [24, 4, 4],
    ],
    leadWave: 'square',
  },
  // Champeta of the walled city
  cartagena: {
    style: 'champeta',
    tempo: 100,
    root: 53,
    scale: 'minor',
    chords: [0, 5, 3, 4],
    leadBars: 2,
    lead: [
      [0, 4, 3],
      [3, 4, 1],
      [4, 2, 2],
      [8, 4, 3],
      [11, 5, 1],
      [12, 4, 4],
      [16, 7, 3],
      [19, 5, 1],
      [20, 4, 2],
      [24, 2, 4],
    ],
    leadWave: 'sawtooth',
  },
  // Vallenato: accordion-like reed lead for the Sierra Nevada
  ciudadPerdida: {
    style: 'vallenato',
    tempo: 98,
    root: 55,
    scale: 'major',
    chords: [0, 3, 4, 0],
    leadBars: 2,
    lead: [
      [0, 2, 2],
      [2, 4, 2],
      [4, 5, 2],
      [6, 4, 2],
      [8, 2, 4],
      [16, 4, 2],
      [18, 5, 2],
      [20, 7, 2],
      [22, 5, 2],
      [24, 4, 4],
    ],
    leadWave: 'sawtooth',
  },
  // Calypso for the island
  sanAndres: {
    style: 'calypso',
    tempo: 108,
    root: 60,
    scale: 'mixolydian',
    chords: [0, 3, 0, 6],
    leadBars: 2,
    lead: [
      [0, 4, 2],
      [2, 2, 2],
      [4, 4, 2],
      [6, 5, 2],
      [8, 4, 4],
      [16, 2, 2],
      [18, 0, 2],
      [20, 2, 2],
      [22, 4, 2],
      [24, 2, 4],
    ],
    leadWave: 'triangle',
  },
  // Carnival cumbia
  barranquilla: {
    style: 'cumbia',
    tempo: 96,
    root: 50,
    scale: 'major',
    chords: [0, 3, 4, 0],
    leadBars: 2,
    lead: [
      [0, 4, 2],
      [2, 5, 2],
      [4, 7, 4],
      [8, 5, 2],
      [10, 4, 2],
      [12, 2, 4],
      [16, 4, 2],
      [18, 5, 2],
      [20, 4, 2],
      [22, 2, 2],
      [24, 0, 6],
    ],
    leadWave: 'sawtooth',
  },
  // Pacific currulao for the river of five colors
  canoCristales: {
    style: 'currulao',
    tempo: 116,
    root: 57,
    scale: 'mixolydian',
    chords: [0, 6, 3, 0],
    leadBars: 2,
    lead: [
      [0, 4, 3],
      [3, 2, 3],
      [6, 4, 3],
      [9, 5, 3],
      [12, 4, 3],
      [15, 2, 3],
      [18, 0, 3],
      [21, 2, 3],
    ],
    leadWave: 'triangle',
  },
  // Joropo of the plains: fast harp-like arpeggios over a 6/8 pulse
  llanos: {
    style: 'joropo',
    tempo: 138,
    root: 57,
    scale: 'major',
    chords: [0, 4, 0, 4],
    leadBars: 2,
    lead: [
      [0, 7, 2],
      [2, 4, 2],
      [4, 2, 2],
      [6, 4, 2],
      [8, 7, 2],
      [10, 9, 2],
      [12, 8, 2],
      [14, 6, 2],
      [16, 4, 2],
      [18, 6, 2],
      [20, 8, 2],
      [22, 7, 2],
    ],
    leadWave: 'triangle',
  },
  // Jungle: toms and a sparse flute
  amazonas: {
    style: 'selva',
    tempo: 92,
    root: 50,
    scale: 'dorian',
    chords: [0, 0, 6, 6],
    leadBars: 2,
    lead: [
      [0, 7, 6],
      [8, 6, 2],
      [10, 4, 6],
      [16, 4, 4],
      [20, 5, 2],
      [22, 7, 8],
    ],
    leadWave: 'sine',
  },
  // Sanjuanero for the desert of Huila
  tatacoa: {
    style: 'sanjuanero',
    tempo: 118,
    root: 52,
    scale: 'major',
    chords: [0, 3, 4, 0],
    leadBars: 2,
    lead: [
      [0, 4, 3],
      [3, 5, 3],
      [6, 7, 3],
      [9, 5, 3],
      [12, 4, 3],
      [15, 2, 3],
      [18, 4, 3],
      [21, 0, 3],
    ],
    leadWave: 'square',
  },
}

/** Theme for a track that has none (the test track or the editor's custom track). */
export const FALLBACK_THEME: ThemeId = 'cocora'
