import './quickRaceMenu.css'
import { BOT_DIFFICULTIES, type BotDifficulty } from '../config/bots'
import { characterIds, characters, type CharacterId } from '../config/characters'
import { CHARACTER_COLORS, characterInitial, statRows } from './characterSelectModel'
import {
  RACE_MODES,
  shiftCharacter,
  shiftDifficulty,
  shiftMode,
  withCharacter,
  withDifficulty,
  withMode,
  withRubberBand,
  type RaceMode,
  type RaceSettings,
} from '../game/raceSettings'

const MODE_LABELS: Record<RaceMode, string> = {
  carrera: 'Carrera rápida',
  contrarreloj: 'Contrarreloj',
}
const DIFFICULTY_LABELS: Record<BotDifficulty, string> = {
  facil: 'Fácil',
  normal: 'Normal',
  dificil: 'Difícil',
}

/** The two screens of the menu: pick a character, then the race options. */
export type MenuStep = 'character' | 'race'

function el(tag: string, className: string, parent?: HTMLElement): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  parent?.append(node)
  return node
}

/**
 * Start menu shown over the 3D scene, in two steps. Step 1: pick a character (arrows or A/D,
 * Enter for next). Step 2: race options (arrows or A/D change the difficulty, Enter starts,
 * Escape or Backspace goes back).
 */
export class QuickRaceMenu {
  private readonly root = el('div', 'qr-menu')
  private readonly title: HTMLElement
  private readonly modeButtons = new Map<RaceMode, HTMLButtonElement>()
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
  private currentStep: MenuStep = 'character'

  /** Called when the selected character changes and every time the menu is shown. */
  onCharacterChange: ((id: CharacterId) => void) | null = null

  constructor(
    initial: RaceSettings,
    trackName: string,
    private readonly onStart: (settings: RaceSettings) => void,
    parent: HTMLElement = document.body,
  ) {
    this.settings = initial
    this.picker = el('div', 'qr-picker', this.root)
    this.detail = this.buildPicker()
    const card = el('div', 'qr-card', this.root)
    this.card = card
    this.title = el('h1', 'qr-title', card)
    el('div', 'qr-track', card).textContent = `Pista: ${trackName}`
    this.raceCharacter = el('div', 'qr-chosen', card)

    const modeRow = el('div', 'qr-difficulties', card)
    for (const mode of RACE_MODES) {
      const button = el('button', 'qr-option', modeRow) as HTMLButtonElement
      button.type = 'button'
      button.textContent = MODE_LABELS[mode]
      button.addEventListener('click', () => {
        this.settings = withMode(this.settings, mode)
        this.refresh()
      })
      this.modeButtons.set(mode, button)
    }

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
    el('div', 'qr-hint', card).textContent =
      'Enter: empezar · Esc: volver · ↑ ↓: modo · ← → o A/D: dificultad'

    window.addEventListener('keydown', (event) => this.onKey(event))
    this.refresh()
    parent.append(this.root)
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
    this.currentStep = 'character'
    this.root.classList.add('is-visible')
    this.refresh()
    this.onCharacterChange?.(this.settings.character)
  }

  hide(): void {
    this.visible = false
    this.root.classList.remove('is-visible')
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
    el('div', 'qr-hint', this.picker).textContent = 'Enter: siguiente · ← → o A/D: cambiar piloto'
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
    if (this.currentStep === 'character') {
      this.onCharacterKey(event)
      return
    }
    if (event.code === 'Enter' || event.code === 'NumpadEnter') {
      event.preventDefault()
      this.start()
    } else if (event.code === 'Escape' || event.code === 'Backspace') {
      event.preventDefault()
      this.goTo('character')
    } else if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
      event.preventDefault()
      this.settings = shiftMode(this.settings, event.code === 'ArrowUp' ? -1 : 1)
      this.refresh()
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

  private onCharacterKey(event: KeyboardEvent): void {
    if (event.code === 'Enter' || event.code === 'NumpadEnter') {
      event.preventDefault()
      this.goTo('race')
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

  private refresh(): void {
    const picking = this.currentStep === 'character'
    this.root.classList.toggle('is-picking', picking)
    this.picker.hidden = !picking
    this.card.hidden = picking
    this.raceCharacter.textContent = `Piloto: ${characters[this.settings.character].name}`
    this.refreshPicker()
    this.title.textContent = MODE_LABELS[this.settings.mode]
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
