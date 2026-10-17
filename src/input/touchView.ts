import './touchControls.css'
import { shouldShowTouchControls, steerFromPadX, TouchSource, type TouchButton } from './touch'

interface ButtonSpec {
  button: TouchButton
  label: string
  /** CSS modifier that places and sizes the button. */
  className: string
}

const BUTTONS: readonly ButtonSpec[] = [
  { button: 'throttle', label: 'Acelerar', className: 'tc-throttle' },
  { button: 'brake', label: 'Frenar', className: 'tc-brake' },
  { button: 'jump', label: 'Saltar', className: 'tc-jump' },
  { button: 'boost', label: 'Nitro', className: 'tc-boost' },
  { button: 'useItem', label: 'Poder', className: 'tc-item' },
  { button: 'lookBack', label: 'Atrás', className: 'tc-back' },
]

const ACTIVE_BODY_CLASS = 'has-touch-controls'

function el(tag: string, className: string, parent: HTMLElement): HTMLElement {
  const element = document.createElement(tag)
  element.className = className
  parent.append(element)
  return element
}

/** On-screen controls for phones and tablets, plus the input source they feed. */
export class TouchControls {
  readonly source = new TouchSource(() => this.root.getClientRects().length > 0)
  private readonly root = document.createElement('div')
  private readonly pad: HTMLElement
  private readonly knob: HTMLElement
  private raceVisible = false
  private touchStarted = false

  constructor(parent: HTMLElement = document.body) {
    this.root.className = 'touch-controls'
    this.root.hidden = true
    this.root.addEventListener('contextmenu', (event) => event.preventDefault())

    this.pad = el('div', 'tc-pad', this.root)
    el('span', 'tc-pad-arrow is-left', this.pad).textContent = '◀'
    el('span', 'tc-pad-arrow is-right', this.pad).textContent = '▶'
    this.knob = el('div', 'tc-pad-knob', this.pad)
    this.bindPad()

    for (const spec of BUTTONS) this.bindButton(spec)
    parent.append(this.root)

    // A phone that reported no touch support still gets the controls on its first touch
    window.addEventListener(
      'touchstart',
      () => {
        this.touchStarted = true
        this.refresh()
      },
      { passive: true, once: true },
    )
    window.addEventListener('blur', () => this.source.releaseAll())
    this.refresh()
  }

  /** Shown only while a race is on screen (not in the menu) and the device is a touch one. */
  setVisible(visible: boolean): void {
    this.raceVisible = visible
    this.refresh()
  }

  private refresh(): void {
    const detected = shouldShowTouchControls({
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      finePointer: window.matchMedia('(pointer: fine)').matches,
      maxTouchPoints: navigator.maxTouchPoints,
      touchStarted: this.touchStarted,
    })
    document.body.classList.toggle(ACTIVE_BODY_CLASS, detected)
    const shown = detected && this.raceVisible
    this.root.hidden = !shown
    if (!shown) this.resetVisuals()
  }

  private resetVisuals(): void {
    this.source.releaseAll()
    this.knob.style.transform = ''
    this.knob.classList.remove('is-active')
    for (const pressed of this.root.querySelectorAll('.is-pressed')) {
      pressed.classList.remove('is-pressed')
    }
  }

  private bindButton(spec: ButtonSpec): void {
    const element = el('button', `tc-button ${spec.className}`, this.root) as HTMLButtonElement
    element.type = 'button'
    element.textContent = spec.label
    element.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      element.setPointerCapture(event.pointerId)
      this.source.press(event.pointerId, spec.button)
      element.classList.add('is-pressed')
    })
    const end = (event: PointerEvent): void => {
      this.source.release(event.pointerId)
      element.classList.remove('is-pressed')
    }
    element.addEventListener('pointerup', end)
    element.addEventListener('pointercancel', end)
    element.addEventListener('lostpointercapture', end)
  }

  private bindPad(): void {
    const steerTo = (event: PointerEvent): void => {
      const rect = this.pad.getBoundingClientRect()
      this.source.steer(event.pointerId, steerFromPadX(event.clientX, rect.left, rect.width))
      const travel = (rect.width / 2) * 0.9
      const offset = event.clientX - (rect.left + rect.width / 2)
      this.knob.style.transform = `translateX(${Math.max(-travel, Math.min(travel, offset))}px)`
    }
    this.pad.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      this.pad.setPointerCapture(event.pointerId)
      this.knob.classList.add('is-active')
      steerTo(event)
    })
    this.pad.addEventListener('pointermove', (event) => {
      if (this.pad.hasPointerCapture(event.pointerId)) steerTo(event)
    })
    const end = (event: PointerEvent): void => {
      this.source.release(event.pointerId)
      this.knob.style.transform = ''
      this.knob.classList.remove('is-active')
    }
    this.pad.addEventListener('pointerup', end)
    this.pad.addEventListener('pointercancel', end)
    this.pad.addEventListener('lostpointercapture', end)
  }
}
