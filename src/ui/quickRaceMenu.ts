import './quickRaceMenu.css'
import { BOT_DIFFICULTIES, type BotDifficulty } from '../config/bots'
import {
  RACE_MODES,
  shiftDifficulty,
  shiftMode,
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

function el(tag: string, className: string, parent?: HTMLElement): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  parent?.append(node)
  return node
}

/** Start menu shown over the 3D scene. Enter starts; arrows or A/D change the difficulty. */
export class QuickRaceMenu {
  private readonly root = el('div', 'qr-menu')
  private readonly title: HTMLElement
  private readonly modeButtons = new Map<RaceMode, HTMLButtonElement>()
  private readonly botOptions: HTMLElement
  private readonly difficultyButtons = new Map<BotDifficulty, HTMLButtonElement>()
  private readonly rubberToggle: HTMLButtonElement
  private settings: RaceSettings
  private visible = false

  constructor(
    initial: RaceSettings,
    trackName: string,
    private readonly onStart: (settings: RaceSettings) => void,
    parent: HTMLElement = document.body,
  ) {
    this.settings = initial
    const card = el('div', 'qr-card', this.root)
    this.title = el('h1', 'qr-title', card)
    el('div', 'qr-track', card).textContent = `Pista: ${trackName}`

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
    el('div', 'qr-hint', card).textContent = 'Enter: empezar · ↑ ↓: modo · ← → o A/D: dificultad'

    window.addEventListener('keydown', (event) => this.onKey(event))
    this.refresh()
    parent.append(this.root)
  }

  get isVisible(): boolean {
    return this.visible
  }

  show(settings: RaceSettings): void {
    this.settings = settings
    this.visible = true
    this.root.classList.add('is-visible')
    this.refresh()
  }

  hide(): void {
    this.visible = false
    this.root.classList.remove('is-visible')
  }

  private start(): void {
    if (!this.visible) return
    this.hide()
    this.onStart(this.settings)
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.visible || event.repeat) return
    if (event.code === 'Enter' || event.code === 'NumpadEnter') {
      event.preventDefault()
      this.start()
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

  private refresh(): void {
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
