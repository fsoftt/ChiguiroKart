import './quickRaceMenu.css'
import './optionsMenu.css'
import type { KeyboardAction } from '../config/controls'
import { QUALITY_LABELS, QUALITY_LEVELS, type Quality } from '../config/quality'
import {
  defaultBindings,
  isBindableCode,
  keyLabel,
  MAX_KEYS_PER_ACTION,
  REBIND_ACTIONS,
  rebindKey,
} from '../game/keyRebind'
import type { SettingsStore } from '../game/settings'

const VOLUME_STEP = 0.05
const PERCENT = 100
const LISTENING_TEXT = 'Pulsa una tecla…'
const RESERVED_TEXT = 'Esa tecla está reservada'

function el(tag: string, className: string, parent?: HTMLElement): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  parent?.append(node)
  return node
}

function button(className: string, text: string, parent: HTMLElement): HTMLButtonElement {
  const node = el('button', className, parent) as HTMLButtonElement
  node.type = 'button'
  node.textContent = text
  return node
}

/** One line of the screen that the arrows can focus. */
interface Row {
  element: HTMLElement
  /** Left (-1) or right (+1) arrow. */
  adjust?: (direction: -1 | 1) => void
  /** Enter. */
  activate?: () => void
  refresh: () => void
}

type VolumeField = 'masterVolume' | 'musicVolume' | 'sfxVolume'

const VOLUME_ROWS: readonly { field: VolumeField; label: string }[] = [
  { field: 'masterVolume', label: 'Volumen general' },
  { field: 'musicVolume', label: 'Música' },
  { field: 'sfxVolume', label: 'Efectos' },
]

/**
 * Options screen over the menu or the pause menu: graphics quality, volumes, accessibility
 * and key remapping. Up/down move between lines, left/right change the value, Enter
 * activates, Esc closes. While open it swallows every key press so nothing behind reacts.
 */
export class OptionsMenu {
  private readonly root = el('div', 'op-menu')
  private readonly card = el('div', 'qr-card op-card', this.root)
  private readonly rows: Row[] = []
  private readonly status: HTMLElement
  private focusIndex = 0
  private open_ = false
  private onClose: (() => void) | null = null
  /** Control line and key slot being remapped, or null. */
  private listening: { action: KeyboardAction; slot: number } | null = null
  /** Key slot the left/right arrows have selected on each control line. */
  private readonly slotByAction = new Map<KeyboardAction, number>()

  constructor(
    private readonly store: SettingsStore,
    parent: HTMLElement = document.body,
  ) {
    this.root.setAttribute('role', 'dialog')
    this.root.setAttribute('aria-label', 'Opciones')
    el('h1', 'qr-title', this.card).textContent = 'Opciones'
    const list = el('div', 'op-list', this.card)
    this.buildQuality(list)
    for (const { field, label } of VOLUME_ROWS) this.buildVolume(list, field, label)
    this.buildToggle(list, 'colorblind', 'Modo daltonismo')
    this.buildToggle(list, 'reduceShake', 'Reducir sacudidas')
    el('div', 'op-section', list).textContent = 'Controles'
    for (const { action, label } of REBIND_ACTIONS) this.buildControl(list, action, label)
    this.buildAction(list, 'Restaurar teclas', () => {
      this.store.update({ keyBindings: defaultBindings() })
    })
    this.status = el('div', 'op-status', this.card)
    this.status.setAttribute('aria-live', 'polite')
    const back = button('qr-back op-back', 'Volver', this.card)
    back.addEventListener('click', () => this.close())
    this.rows.push({ element: back, activate: () => this.close(), refresh: () => undefined })
    el('div', 'qr-hint', this.card).textContent =
      '↑ ↓: elegir · ← →: cambiar · Enter: aceptar · Esc: volver'

    // Capture phase on the window runs before the menus and the game see the key
    window.addEventListener('keydown', (event) => this.onKey(event), true)
    this.store.subscribe(() => this.refresh())
    parent.append(this.root)
    this.refresh()
  }

  get isOpen(): boolean {
    return this.open_
  }

  /** Shows the screen; `onClose` runs when the player leaves it. */
  open(onClose: () => void): void {
    this.onClose = onClose
    this.open_ = true
    this.listening = null
    this.focusIndex = 0
    this.status.textContent = ''
    this.root.classList.add('is-visible')
    this.refresh()
  }

  close(): void {
    if (!this.open_) return
    this.open_ = false
    this.listening = null
    this.root.classList.remove('is-visible')
    const callback = this.onClose
    this.onClose = null
    callback?.()
  }

  // --- Building the lines ---

  private addRow(row: Row, list: HTMLElement): void {
    const index = this.rows.length
    row.element.classList.add('op-row')
    row.element.addEventListener('pointerdown', () => this.focusRow(index))
    list.append(row.element)
    this.rows.push(row)
  }

  private buildQuality(list: HTMLElement): void {
    const element = el('div', 'op-line')
    el('span', 'op-label', element).textContent = 'Calidad gráfica'
    const group = el('div', 'op-choices', element)
    const buttons = new Map<Quality, HTMLButtonElement>()
    for (const level of QUALITY_LEVELS) {
      const choice = button('qr-option', QUALITY_LABELS[level], group)
      choice.addEventListener('click', () => this.store.update({ quality: level }))
      buttons.set(level, choice)
    }
    this.addRow(
      {
        element,
        adjust: (direction) => {
          const index = QUALITY_LEVELS.indexOf(this.store.get().quality) + direction
          const next = QUALITY_LEVELS[Math.min(Math.max(index, 0), QUALITY_LEVELS.length - 1)]
          if (next) this.store.update({ quality: next })
        },
        refresh: () => {
          for (const [level, choice] of buttons) {
            const selected = level === this.store.get().quality
            choice.classList.toggle('is-selected', selected)
            choice.setAttribute('aria-pressed', String(selected))
          }
        },
      },
      list,
    )
  }

  private buildVolume(list: HTMLElement, field: VolumeField, label: string): void {
    const element = el('div', 'op-line')
    el('span', 'op-label', element).textContent = label
    const slider = el('input', 'op-slider', element) as HTMLInputElement
    slider.type = 'range'
    slider.min = '0'
    slider.max = String(PERCENT)
    slider.step = String(VOLUME_STEP * PERCENT)
    slider.setAttribute('aria-label', label)
    slider.tabIndex = -1
    const value = el('span', 'op-value', element)
    slider.addEventListener('input', () => {
      this.store.update({ [field]: Number(slider.value) / PERCENT })
    })
    const change = (delta: number): void => {
      const next = Math.min(1, Math.max(0, this.store.get()[field] + delta))
      this.store.update({ [field]: Math.round(next / VOLUME_STEP) * VOLUME_STEP })
    }
    this.addRow(
      {
        element,
        adjust: (direction) => change(direction * VOLUME_STEP),
        refresh: () => {
          const percent = Math.round(this.store.get()[field] * PERCENT)
          slider.value = String(percent)
          value.textContent = `${percent}%`
        },
      },
      list,
    )
  }

  private buildToggle(list: HTMLElement, field: 'colorblind' | 'reduceShake', label: string): void {
    const element = el('div', 'op-line')
    el('span', 'op-label', element).textContent = label
    const toggle = button('qr-toggle op-toggle', '', element)
    const flip = (): void => this.store.update({ [field]: !this.store.get()[field] })
    toggle.addEventListener('click', flip)
    this.addRow(
      {
        element,
        adjust: (direction) => this.store.update({ [field]: direction > 0 }),
        activate: flip,
        refresh: () => {
          const on = this.store.get()[field]
          toggle.classList.toggle('is-on', on)
          toggle.setAttribute('aria-pressed', String(on))
          toggle.textContent = on ? 'Sí' : 'No'
        },
      },
      list,
    )
  }

  private buildAction(list: HTMLElement, label: string, run: () => void): void {
    const element = el('div', 'op-line op-line-button')
    const control = button('qr-option op-action', label, element)
    control.addEventListener('click', run)
    this.addRow({ element, activate: run, refresh: () => undefined }, list)
  }

  private buildControl(list: HTMLElement, action: KeyboardAction, label: string): void {
    const element = el('div', 'op-line')
    el('span', 'op-label', element).textContent = label
    const group = el('div', 'op-keys', element)
    const slots: HTMLButtonElement[] = []
    for (let slot = 0; slot < MAX_KEYS_PER_ACTION; slot++) {
      const key = button('qr-option op-key', '', group)
      key.addEventListener('click', () => {
        this.focusRowOf(element)
        this.slotByAction.set(action, slot)
        this.startListening(action, slot)
      })
      slots.push(key)
    }
    this.addRow(
      {
        element,
        adjust: (direction) => {
          const current = this.slotByAction.get(action) ?? 0
          const next = Math.min(Math.max(current + direction, 0), MAX_KEYS_PER_ACTION - 1)
          this.slotByAction.set(action, next)
          this.refresh()
        },
        activate: () => this.startListening(action, this.slotByAction.get(action) ?? 0),
        refresh: () => {
          const keys = this.store.get().keyBindings[action]
          const selected = this.slotByAction.get(action) ?? 0
          slots.forEach((key, slot) => {
            const waiting = this.listening?.action === action && this.listening.slot === slot
            const code = keys[slot]
            key.textContent = waiting ? LISTENING_TEXT : code ? keyLabel(code) : '—'
            key.classList.toggle('is-listening', waiting)
            key.classList.toggle('is-selected', selected === slot)
          })
        },
      },
      list,
    )
  }

  // --- State ---

  private startListening(action: KeyboardAction, slot: number): void {
    this.listening = { action, slot }
    this.status.textContent = 'Pulsa la tecla nueva · Esc cancela'
    this.refresh()
  }

  private finishListening(): void {
    this.listening = null
    this.refresh()
  }

  private focusRow(index: number): void {
    this.focusIndex = Math.min(Math.max(index, 0), this.rows.length - 1)
    this.refresh()
    this.rows[this.focusIndex]?.element.scrollIntoView?.({ block: 'nearest' })
  }

  private focusRowOf(element: HTMLElement): void {
    const index = this.rows.findIndex((row) => row.element === element)
    if (index >= 0) this.focusRow(index)
  }

  private refresh(): void {
    this.rows.forEach((row, index) => {
      row.element.classList.toggle('is-focused', index === this.focusIndex)
      row.refresh()
    })
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.open_) return
    event.stopPropagation()
    if (event.repeat && this.listening) {
      event.preventDefault()
      return
    }
    if (this.listening) {
      event.preventDefault()
      this.captureKey(event.code)
      return
    }
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.focusRow(this.focusIndex - 1)
        break
      case 'ArrowDown':
      case 'KeyS':
        this.focusRow(this.focusIndex + 1)
        break
      case 'ArrowLeft':
      case 'KeyA':
        this.rows[this.focusIndex]?.adjust?.(-1)
        break
      case 'ArrowRight':
      case 'KeyD':
        this.rows[this.focusIndex]?.adjust?.(1)
        break
      case 'Enter':
      case 'NumpadEnter':
      case 'Space':
        this.rows[this.focusIndex]?.activate?.()
        break
      case 'Escape':
      case 'Backspace':
        this.close()
        break
      default:
        return
    }
    event.preventDefault()
  }

  private captureKey(code: string): void {
    const target = this.listening
    if (!target) return
    if (code === 'Escape') {
      this.status.textContent = ''
      this.finishListening()
      return
    }
    if (!isBindableCode(code)) {
      this.status.textContent = RESERVED_TEXT
      return
    }
    const bindings = rebindKey(this.store.get().keyBindings, target.action, target.slot, code)
    this.status.textContent = ''
    this.listening = null
    this.store.update({ keyBindings: bindings })
  }
}
