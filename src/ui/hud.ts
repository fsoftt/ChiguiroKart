import './hud.css'
import type { HudModel } from './hudModel'

const PIP_COUNT = 3
const PERFECT_TEXT = '¡Perfecto!'
const SPEED_UNIT = 'km/h'
const PERCENT = 100
const PERCENT_DECIMALS = 1

function el(tag: string, className: string, parent?: HTMLElement): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  parent?.append(node)
  return node
}

function percent(fraction: number): string {
  return `${(fraction * PERCENT).toFixed(PERCENT_DECIMALS)}%`
}

/** Restarts a CSS animation class on an element. */
function replay(node: HTMLElement, className: string): void {
  node.classList.remove(className)
  void node.offsetWidth
  node.classList.add(className)
}

/**
 * DOM heads-up display. `update` compares against the last drawn values and only writes
 * the DOM properties that changed, so a steady frame costs no style or layout work.
 */
export class Hud {
  private readonly root = el('div', 'hud')
  private readonly speedValue: HTMLElement
  private readonly driftBar = el('div', 'hud-drift', this.root)
  private readonly fill: HTMLElement
  private readonly marker: HTMLElement
  private readonly pips: HTMLElement[] = []
  private readonly nitro = el('div', 'hud-nitro', this.root)
  private readonly nitroLabel: HTMLElement
  private readonly nitroTime: HTMLElement
  private readonly perfectPopup: HTMLElement

  private speedKmh = -1
  private barVisible = false
  private fillFraction = -1
  private barColor = ''
  private redZoneStart = -1
  private broken = false
  private readonly pipColors: string[] = ['', '', '']
  private label = ''
  private nitroColor = ''
  private timeFraction = -1
  private perfect = false

  constructor(parent: HTMLElement = document.body) {
    const speed = el('div', 'hud-speed', this.root)
    this.speedValue = el('span', 'hud-speed-value', speed)
    this.speedValue.textContent = '0'
    el('span', 'hud-speed-unit', speed).textContent = SPEED_UNIT

    const track = el('div', 'hud-drift-track', this.driftBar)
    this.fill = el('div', 'hud-drift-fill', track)
    this.marker = el('div', 'hud-drift-marker', track)
    const pipRow = el('div', 'hud-pips', this.driftBar)
    for (let i = 0; i < PIP_COUNT; i++) this.pips.push(el('div', 'hud-pip', pipRow))

    this.nitroLabel = el('div', 'hud-nitro-label', this.nitro)
    this.nitroTime = el('div', 'hud-nitro-time', el('div', 'hud-nitro-track', this.nitro))
    this.perfectPopup = el('div', 'hud-perfect', this.root)
    this.perfectPopup.textContent = PERFECT_TEXT

    parent.append(this.root)
  }

  /** Draws the model, touching only what changed since the previous call. */
  update(model: HudModel): void {
    this.updateSpeed(model)
    this.updateDrift(model)
    this.updateNitro(model)
  }

  private updateSpeed(model: HudModel): void {
    if (model.speedKmh === this.speedKmh) return
    this.speedKmh = model.speedKmh
    this.speedValue.textContent = String(model.speedKmh)
  }

  private updateDrift(model: HudModel): void {
    if (model.barVisible !== this.barVisible) {
      this.barVisible = model.barVisible
      this.driftBar.classList.toggle('is-visible', model.barVisible)
    }
    // Keep the last values while fading out so the bar does not jump to empty.
    if (!model.barVisible) return
    if (model.redZoneStart !== this.redZoneStart) {
      this.redZoneStart = model.redZoneStart
      this.marker.style.left = percent(model.redZoneStart)
    }
    if (model.fill !== this.fillFraction) {
      this.fillFraction = model.fill
      this.fill.style.width = percent(model.fill)
    }
    if (model.barColor !== this.barColor) {
      this.barColor = model.barColor
      this.fill.style.backgroundColor = model.barColor
    }
    if (model.chainBroken !== this.broken) {
      this.broken = model.chainBroken
      this.driftBar.classList.toggle('is-broken', model.chainBroken)
      if (model.chainBroken) replay(this.driftBar, 'is-shaking')
    }
    model.pips.forEach((pip, i) => this.updatePip(i, pip.color))
  }

  private updatePip(index: number, color: string): void {
    if (this.pipColors[index] === color) return
    this.pipColors[index] = color
    const pip = this.pips[index]
    if (!pip) return
    pip.classList.toggle('is-filled', color !== '')
    pip.style.setProperty('--pip-color', color)
    if (color !== '') replay(pip, 'is-popping')
  }

  private updateNitro(model: HudModel): void {
    const labelChanged = model.nitroLabel !== this.label
    if (labelChanged) {
      this.label = model.nitroLabel
      this.nitroLabel.textContent = model.nitroLabel
      this.nitro.classList.toggle('is-active', model.nitroLabel !== '')
      if (model.nitroLabel !== '') replay(this.nitro, 'is-starting')
    }
    if (model.nitroColor !== this.nitroColor) {
      this.nitroColor = model.nitroColor
      this.nitro.style.setProperty('--nitro-color', model.nitroColor)
    }
    if (model.nitroTimeFraction !== this.timeFraction) {
      this.timeFraction = model.nitroTimeFraction
      this.nitroTime.style.width = percent(model.nitroTimeFraction)
    }
    if (model.perfect && (!this.perfect || labelChanged)) replay(this.perfectPopup, 'is-showing')
    this.perfect = model.perfect
  }
}
