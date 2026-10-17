import './quickRaceMenu.css'
import './optionsMenu.css'
import { t, type TranslationKey } from '../i18n'
import { LiveLabels } from '../i18n/liveLabels'

function el(tag: string, className: string, parent?: HTMLElement): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  parent?.append(node)
  return node
}

interface Entry {
  label: TranslationKey
  run: () => void
}

/**
 * Pause overlay (Continuar, Reiniciar carrera, Opciones, Salir al menú) and the small pause
 * button for touch screens. Up/down move, Enter activates, Esc or P resume. While open it
 * swallows key presses so the game behind does not react.
 */
export class PauseMenu {
  onResume: (() => void) | null = null
  onRestart: (() => void) | null = null
  onOptions: (() => void) | null = null
  onQuit: (() => void) | null = null
  /** The touch pause button was pressed. */
  onPauseRequest: (() => void) | null = null

  private readonly root = el('div', 'pm-menu')
  private readonly labels = new LiveLabels()
  private readonly pauseButton = el('button', 'pm-button') as HTMLButtonElement
  private readonly buttons: HTMLButtonElement[] = []
  private readonly entries: Entry[]
  private open_ = false
  private suspended = false
  private focusIndex = 0

  constructor(parent: HTMLElement = document.body) {
    this.root.setAttribute('role', 'dialog')
    this.labels.attr(this.root, 'aria-label', () => t('pause.title'))
    const card = el('div', 'qr-card pm-card', this.root)
    this.labels.text(el('h1', 'qr-title', card), () => t('pause.title'))
    const list = el('div', 'pm-buttons', card)
    this.entries = [
      { label: 'pause.resume', run: () => this.onResume?.() },
      { label: 'pause.restart', run: () => this.onRestart?.() },
      { label: 'common.options', run: () => this.onOptions?.() },
      { label: 'pause.quit', run: () => this.onQuit?.() },
    ]
    this.entries.forEach((entry, index) => {
      const button = el('button', 'qr-start', list) as HTMLButtonElement
      button.type = 'button'
      this.labels.text(button, () => t(entry.label))
      button.addEventListener('click', entry.run)
      button.addEventListener('pointerenter', () => this.focus(index))
      this.buttons.push(button)
    })
    this.labels.text(el('div', 'qr-hint', card), () => t('pause.hint'))

    this.pauseButton.type = 'button'
    this.pauseButton.textContent = '⏸'
    this.labels.attr(this.pauseButton, 'aria-label', () => t('pause.title'))
    this.pauseButton.addEventListener('click', () => this.onPauseRequest?.())

    window.addEventListener('keydown', (event) => this.onKey(event), true)
    parent.append(this.root, this.pauseButton)
    this.focus(0)
  }

  get isOpen(): boolean {
    return this.open_
  }

  /** True while the Options screen is on top and the pause menu must not take keys. */
  setSuspended(suspended: boolean): void {
    this.suspended = suspended
    this.root.classList.toggle('is-suspended', suspended)
    this.root.style.visibility = suspended && this.open_ ? 'hidden' : ''
  }

  show(): void {
    this.open_ = true
    this.focus(0)
    this.root.classList.add('is-visible')
    this.buttons[0]?.focus({ preventScroll: true })
  }

  hide(): void {
    this.open_ = false
    this.suspended = false
    this.root.style.visibility = ''
    this.root.classList.remove('is-visible')
  }

  /** Shows the touch pause button (it only displays on touch devices). */
  setButtonVisible(visible: boolean): void {
    this.pauseButton.classList.toggle('is-shown', visible)
  }

  private focus(index: number): void {
    this.focusIndex = (index + this.entries.length) % this.entries.length
    this.buttons.forEach((button, i) =>
      button.classList.toggle('is-focused', i === this.focusIndex),
    )
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.open_ || this.suspended) return
    event.stopPropagation()
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.focus(this.focusIndex - 1)
        break
      case 'ArrowDown':
      case 'KeyS':
        this.focus(this.focusIndex + 1)
        break
      case 'Enter':
      case 'NumpadEnter':
      case 'Space':
        if (!event.repeat) this.entries[this.focusIndex]?.run()
        break
      case 'Escape':
      case 'KeyP':
        if (!event.repeat) this.onResume?.()
        break
      default:
        return
    }
    event.preventDefault()
  }
}
