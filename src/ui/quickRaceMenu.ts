import './quickRaceMenu.css'
import { BOT_DIFFICULTIES, type BotDifficulty } from '../config/bots'
import {
  shiftDifficulty,
  withDifficulty,
  withRubberBand,
  type RaceSettings,
} from '../game/raceSettings'

const TITLE = 'Carrera rápida'
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
    el('h1', 'qr-title', card).textContent = TITLE
    el('div', 'qr-track', card).textContent = `Pista: ${trackName}`

    el('div', 'qr-label', card).textContent = 'Dificultad de los bots'
    const row = el('div', 'qr-difficulties', card)
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

    this.rubberToggle = el('button', 'qr-toggle', card) as HTMLButtonElement
    this.rubberToggle.type = 'button'
    this.rubberToggle.addEventListener('click', () => {
      this.settings = withRubberBand(this.settings, !this.settings.rubberBandEnabled)
      this.refresh()
    })

    const start = el('button', 'qr-start', card) as HTMLButtonElement
    start.type = 'button'
    start.textContent = '¡A correr!'
    start.addEventListener('click', () => this.start())
    el('div', 'qr-hint', card).textContent = 'Enter: empezar · ← → o A/D: dificultad'

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
    } else if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
      this.settings = shiftDifficulty(this.settings, -1)
      this.refresh()
    } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
      this.settings = shiftDifficulty(this.settings, 1)
      this.refresh()
    }
  }

  private refresh(): void {
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
