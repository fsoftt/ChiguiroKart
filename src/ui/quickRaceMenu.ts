import './quickRaceMenu.css'
import { BOT_DIFFICULTIES, type BotDifficulty } from '../config/bots'
import { characterIds, characters, type CharacterId } from '../config/characters'
import { tracks, type CupId, type TrackId } from '../config/tracks/catalog'
import { CHARACTER_COLORS, characterInitial, statRows } from './characterSelectModel'
import { cupCards, moveTrackSelection, trackGroups, type GridDirection } from './trackSelectModel'
import {
  RACE_MODES,
  shiftCharacter,
  shiftCup,
  shiftDifficulty,
  shiftMode,
  withCharacter,
  withCup,
  withDifficulty,
  withMode,
  withRubberBand,
  withTrack,
  type RaceMode,
  type RaceSettings,
} from '../game/raceSettings'

const MODE_LABELS: Record<RaceMode, string> = {
  carrera: 'Carrera rápida',
  copa: 'Copa',
  contrarreloj: 'Contrarreloj',
}
const DIFFICULTY_LABELS: Record<BotDifficulty, string> = {
  facil: 'Fácil',
  normal: 'Normal',
  dificil: 'Difícil',
}

/**
 * The four screens of the menu: game mode, track (or cup), character, then the race options.
 */
export type MenuStep = 'mode' | 'track' | 'character' | 'race'

const MODE_HINTS: Record<RaceMode, string> = {
  carrera: 'Una pista contra 7 bots',
  copa: 'Cuatro pistas seguidas con puntos',
  contrarreloj: 'Tú solo contra tu mejor fantasma',
}

const KEY_DIRECTIONS: Record<string, GridDirection> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
}

function isConfirm(event: KeyboardEvent): boolean {
  return event.code === 'Enter' || event.code === 'NumpadEnter'
}

function isBack(event: KeyboardEvent): boolean {
  return event.code === 'Escape' || event.code === 'Backspace'
}

function el(tag: string, className: string, parent?: HTMLElement): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  parent?.append(node)
  return node
}

/**
 * Start menu shown over the 3D scene, in four steps. Step 1: game mode (arrows up/down).
 * Step 2: the track (grid of 12 by cup) or, in the cup mode, the cup (arrows). Step 3: the
 * character (arrows or A/D). Step 4: race options (arrows or A/D change the difficulty).
 * Enter always goes forward and starts the race on the last step; Escape or Backspace goes back.
 */
export class QuickRaceMenu {
  private readonly root = el('div', 'qr-menu')
  private readonly title: HTMLElement
  private readonly modeCard: HTMLElement
  private readonly modeButtons = new Map<RaceMode, HTMLButtonElement>()
  private readonly modeHint: HTMLElement
  private readonly trackCard: HTMLElement
  private readonly trackTitle: HTMLElement
  private readonly trackGrid: HTMLElement
  private readonly cupGrid: HTMLElement
  private readonly trackButtons = new Map<TrackId, HTMLButtonElement>()
  private readonly cupButtons = new Map<CupId, HTMLButtonElement>()
  private readonly raceTrack: HTMLElement
  private readonly botOptions: HTMLElement
  private readonly difficultyButtons = new Map<BotDifficulty, HTMLButtonElement>()
  private readonly rubberToggle: HTMLButtonElement
  private readonly picker: HTMLElement
  private readonly card: HTMLElement
  private readonly characterButtons = new Map<CharacterId, HTMLButtonElement>()
  private readonly detail: HTMLElement
  private readonly raceCharacter: HTMLElement
  private settings: RaceSettings
  private visible = false
  /** Name of a URL-forced track (`?pista=test`) shown instead of the picked one; else null. */
  private trackOverrideName: string | null = null
  private currentStep: MenuStep = 'mode'

  /** Called when the selected character changes and every time the menu is shown. */
  onCharacterChange: ((id: CharacterId) => void) | null = null
  /** Called when the player picks a track or a cup, not when the menu shows its initial one. */
  onTrackChange: (() => void) | null = null

  constructor(
    initial: RaceSettings,
    private readonly onStart: (settings: RaceSettings) => void,
    parent: HTMLElement = document.body,
  ) {
    this.settings = initial
    this.modeCard = el('div', 'qr-card', this.root)
    this.modeHint = this.buildModeCard()
    this.trackCard = el('div', 'qr-card qr-card-wide', this.root)
    this.trackTitle = el('h1', 'qr-title', this.trackCard)
    this.trackGrid = el('div', 'qr-tracks', this.trackCard)
    this.cupGrid = el('div', 'qr-cups', this.trackCard)
    this.buildTrackCard()
    this.picker = el('div', 'qr-picker', this.root)
    this.detail = this.buildPicker()
    const card = el('div', 'qr-card', this.root)
    this.card = card
    this.title = el('h1', 'qr-title', card)
    this.raceTrack = el('div', 'qr-track', card)
    this.raceCharacter = el('div', 'qr-chosen', card)

    this.botOptions = el('div', 'qr-bot-options', card)
    el('div', 'qr-label', this.botOptions).textContent = 'Dificultad de los bots'
    const row = el('div', 'qr-difficulties', this.botOptions)
    for (const level of BOT_DIFFICULTIES) {
      const button = el('button', 'qr-option', row) as HTMLButtonElement
      button.type = 'button'
      button.textContent = DIFFICULTY_LABELS[level]
      button.addEventListener('click', () => {
        this.settings = withDifficulty(this.settings, level)
        this.refresh()
      })
      this.difficultyButtons.set(level, button)
    }

    this.rubberToggle = el('button', 'qr-toggle', this.botOptions) as HTMLButtonElement
    this.rubberToggle.type = 'button'
    this.rubberToggle.addEventListener('click', () => {
      this.settings = withRubberBand(this.settings, !this.settings.rubberBandEnabled)
      this.refresh()
    })

    const start = el('button', 'qr-start', card) as HTMLButtonElement
    start.type = 'button'
    start.textContent = '¡A correr!'
    start.addEventListener('click', () => this.start())
    const back = el('button', 'qr-back', card) as HTMLButtonElement
    back.type = 'button'
    back.textContent = 'Volver'
    back.addEventListener('click', () => this.goTo('character'))
    el('div', 'qr-hint', card).textContent = 'Enter: empezar · Esc: volver · ← → o A/D: dificultad'

    window.addEventListener('keydown', (event) => this.onKey(event))
    this.refresh()
    parent.append(this.root)
  }

  /** Shows `name` as the track of the race until the player picks a track or a cup. */
  setTrackOverride(name: string | null): void {
    this.trackOverrideName = name
    this.refresh()
  }

  get isVisible(): boolean {
    return this.visible
  }

  /** The screen being shown. */
  get step(): MenuStep {
    return this.currentStep
  }

  show(settings: RaceSettings): void {
    this.settings = settings
    this.visible = true
    this.currentStep = 'mode'
    this.root.classList.add('is-visible')
    this.refresh()
    this.onCharacterChange?.(this.settings.character)
  }

  hide(): void {
    this.visible = false
    this.root.classList.remove('is-visible')
  }

  private buildModeCard(): HTMLElement {
    const card = this.modeCard
    el('h1', 'qr-title', card).textContent = 'ChiguiroKart'
    el('div', 'qr-track', card).textContent = 'Elige el modo de juego'
    const list = el('div', 'qr-modes', card)
    for (const mode of RACE_MODES) {
      const button = el('button', 'qr-option qr-mode', list) as HTMLButtonElement
      button.type = 'button'
      button.textContent = MODE_LABELS[mode]
      button.addEventListener('click', () => {
        this.settings = withMode(this.settings, mode)
        this.refresh()
      })
      this.modeButtons.set(mode, button)
    }
    const hint = el('div', 'qr-chosen', card)
    const next = el('button', 'qr-start', card) as HTMLButtonElement
    next.type = 'button'
    next.textContent = 'Siguiente'
    next.addEventListener('click', () => this.goTo('track'))
    el('div', 'qr-hint', card).textContent = 'Enter: siguiente · ↑ ↓: modo'
    return hint
  }

  private buildTrackCard(): void {
    const card = this.trackCard
    for (const group of trackGroups()) {
      const row = el('div', 'qr-track-row', this.trackGrid)
      el('div', 'qr-cup-label', row).textContent = group.cupName
      const buttons = el('div', 'qr-track-buttons', row)
      for (const track of group.tracks) {
        const button = el('button', 'qr-track-button', buttons) as HTMLButtonElement
        button.type = 'button'
        button.textContent = track.name
        button.addEventListener('click', () => this.pickTrack(track.id))
        this.trackButtons.set(track.id, button)
      }
    }
    for (const cup of cupCards()) {
      const button = el('button', 'qr-cup-card', this.cupGrid) as HTMLButtonElement
      button.type = 'button'
      el('span', 'qr-cup-name', button).textContent = cup.name
      const list = el('ol', 'qr-cup-tracks', button)
      for (const name of cup.trackNames) el('li', '', list).textContent = name
      button.addEventListener('click', () => this.pickCup(cup.id))
      this.cupButtons.set(cup.id, button)
    }
    const next = el('button', 'qr-start', card) as HTMLButtonElement
    next.type = 'button'
    next.textContent = 'Siguiente'
    next.addEventListener('click', () => this.goTo('character'))
    const back = el('button', 'qr-back', card) as HTMLButtonElement
    back.type = 'button'
    back.textContent = 'Volver'
    back.addEventListener('click', () => this.goTo('mode'))
    el('div', 'qr-hint', card).textContent = 'Enter: siguiente · Esc: volver · ← → ↑ ↓: elegir'
  }

  private pickTrack(id: TrackId): void {
    this.trackOverrideName = null
    this.settings = withTrack(this.settings, id)
    this.refresh()
    this.onTrackChange?.()
  }

  private pickCup(id: CupId): void {
    this.trackOverrideName = null
    this.settings = withCup(this.settings, id)
    this.refresh()
    this.onTrackChange?.()
  }

  private buildPicker(): HTMLElement {
    el('h1', 'qr-title', this.picker).textContent = 'Elige tu piloto'
    const grid = el('div', 'qr-characters', this.picker)
    for (const id of characterIds) {
      const button = el('button', 'qr-character', grid) as HTMLButtonElement
      button.type = 'button'
      const dot = el('span', 'qr-dot', button)
      dot.style.background = CHARACTER_COLORS[id]
      dot.textContent = characterInitial(id)
      el('span', 'qr-character-name', button).textContent = characters[id].name
      button.addEventListener('click', () => this.setCharacter(id))
      this.characterButtons.set(id, button)
    }
    const detail = el('div', 'qr-detail', this.picker)
    const next = el('button', 'qr-start', this.picker) as HTMLButtonElement
    next.type = 'button'
    next.textContent = 'Siguiente'
    next.addEventListener('click', () => this.goTo('race'))
    const back = el('button', 'qr-back', this.picker) as HTMLButtonElement
    back.type = 'button'
    back.textContent = 'Volver'
    back.addEventListener('click', () => this.goTo('track'))
    el('div', 'qr-hint', this.picker).textContent =
      'Enter: siguiente · Esc: volver · ← → o A/D: cambiar piloto'
    return detail
  }

  private goTo(step: MenuStep): void {
    this.currentStep = step
    this.refresh()
  }

  private setCharacter(id: CharacterId): void {
    if (id === this.settings.character) return
    this.settings = withCharacter(this.settings, id)
    this.refresh()
    this.onCharacterChange?.(id)
  }

  private start(): void {
    if (!this.visible) return
    this.hide()
    this.onStart(this.settings)
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.visible || event.repeat) return
    if (this.currentStep === 'mode') {
      this.onModeKey(event)
      return
    }
    if (this.currentStep === 'track') {
      this.onTrackKey(event)
      return
    }
    if (this.currentStep === 'character') {
      this.onCharacterKey(event)
      return
    }
    if (isConfirm(event)) {
      event.preventDefault()
      this.start()
    } else if (isBack(event)) {
      event.preventDefault()
      this.goTo('character')
    } else if (this.settings.mode !== 'carrera') {
      // Difficulty only applies to the quick race
    } else if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
      this.settings = shiftDifficulty(this.settings, -1)
      this.refresh()
    } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
      this.settings = shiftDifficulty(this.settings, 1)
      this.refresh()
    }
  }

  private onModeKey(event: KeyboardEvent): void {
    const direction = KEY_DIRECTIONS[event.code]
    if (isConfirm(event)) {
      event.preventDefault()
      this.goTo('track')
    } else if (direction === 'up' || direction === 'left') {
      event.preventDefault()
      this.settings = shiftMode(this.settings, -1)
      this.refresh()
    } else if (direction === 'down' || direction === 'right') {
      event.preventDefault()
      this.settings = shiftMode(this.settings, 1)
      this.refresh()
    }
  }

  private onTrackKey(event: KeyboardEvent): void {
    const direction = KEY_DIRECTIONS[event.code]
    if (isConfirm(event)) {
      event.preventDefault()
      this.goTo('character')
    } else if (isBack(event)) {
      event.preventDefault()
      this.goTo('mode')
    } else if (!direction) {
      return
    } else if (this.settings.mode === 'copa') {
      event.preventDefault()
      if (direction === 'left' || direction === 'right') {
        this.pickCup(shiftCup(this.settings, direction === 'left' ? -1 : 1).cup)
      }
    } else {
      event.preventDefault()
      this.pickTrack(moveTrackSelection(this.settings.track, direction))
    }
  }

  private onCharacterKey(event: KeyboardEvent): void {
    if (isConfirm(event)) {
      event.preventDefault()
      this.goTo('race')
    } else if (isBack(event)) {
      event.preventDefault()
      this.goTo('track')
    } else if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
      event.preventDefault()
      this.setCharacter(shiftCharacter(this.settings, -1).character)
    } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
      event.preventDefault()
      this.setCharacter(shiftCharacter(this.settings, 1).character)
    }
  }

  private refreshPicker(): void {
    for (const [id, button] of this.characterButtons) {
      const selected = id === this.settings.character
      button.classList.toggle('is-selected', selected)
      button.setAttribute('aria-pressed', String(selected))
    }
    const character = characters[this.settings.character]
    this.detail.replaceChildren()
    el('div', 'qr-detail-name', this.detail).textContent = character.name
    const perk = el('div', 'qr-perk', this.detail)
    el('div', 'qr-perk-name', perk).textContent = `Habilidad: ${character.perk.name}`
    el('div', 'qr-perk-text', perk).textContent = character.perk.description
    for (const row of statRows(this.settings.character)) {
      const line = el('div', 'qr-stat', this.detail)
      el('span', 'qr-stat-label', line).textContent = row.label
      const bar = el('span', 'qr-stat-bar', line)
      bar.setAttribute('role', 'img')
      bar.setAttribute('aria-label', `${row.label}: ${row.value} de ${row.segments.length}`)
      for (const filled of row.segments) {
        el('span', filled ? 'qr-segment is-filled' : 'qr-segment', bar)
      }
    }
  }

  private refreshTrackStep(): void {
    const cup = this.settings.mode === 'copa'
    this.trackTitle.textContent = cup ? 'Elige la copa' : 'Elige la pista'
    this.trackGrid.hidden = cup
    this.cupGrid.hidden = !cup
    for (const [id, button] of this.trackButtons) {
      const selected = id === this.settings.track
      button.classList.toggle('is-selected', selected)
      button.setAttribute('aria-pressed', String(selected))
    }
    for (const [id, button] of this.cupButtons) {
      const selected = id === this.settings.cup
      button.classList.toggle('is-selected', selected)
      button.setAttribute('aria-pressed', String(selected))
    }
  }

  private refresh(): void {
    const picking = this.currentStep === 'character'
    this.root.classList.toggle('is-picking', picking)
    this.modeCard.hidden = this.currentStep !== 'mode'
    this.trackCard.hidden = this.currentStep !== 'track'
    this.picker.hidden = !picking
    this.card.hidden = this.currentStep !== 'race'
    this.raceCharacter.textContent = `Piloto: ${characters[this.settings.character].name}`
    this.raceTrack.textContent =
      this.settings.mode === 'copa'
        ? (cupCards().find((cup) => cup.id === this.settings.cup)?.name ?? '')
        : `Pista: ${this.trackOverrideName ?? tracks[this.settings.track].name}`
    this.refreshPicker()
    this.refreshTrackStep()
    this.title.textContent = MODE_LABELS[this.settings.mode]
    this.modeHint.textContent = MODE_HINTS[this.settings.mode]
    this.botOptions.hidden = this.settings.mode !== 'carrera'
    for (const [mode, button] of this.modeButtons) {
      const selected = mode === this.settings.mode
      button.classList.toggle('is-selected', selected)
      button.setAttribute('aria-pressed', String(selected))
    }
    for (const [level, button] of this.difficultyButtons) {
      const selected = level === this.settings.difficulty
      button.classList.toggle('is-selected', selected)
      button.setAttribute('aria-pressed', String(selected))
    }
    const on = this.settings.rubberBandEnabled
    this.rubberToggle.classList.toggle('is-on', on)
    this.rubberToggle.setAttribute('aria-pressed', String(on))
    this.rubberToggle.textContent = `Ayuda de remontada: ${on ? 'Sí' : 'No'}`
  }
}
