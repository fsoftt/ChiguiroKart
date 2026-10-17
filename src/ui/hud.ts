import './hud.css'
import type { Vec2 } from '../sim/math'
import type { Track } from '../sim/track'
import type { FinalTimes, HudModel } from './hudModel'
import { Minimap } from './minimap'

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
  readonly minimap = new Minimap()

  // Race UI
  private readonly lapBadge = el('div', 'hud-lap-badge', this.root)
  private readonly positionBadge = el('div', 'hud-position', this.root)
  private readonly positionValue: HTMLElement
  private readonly positionTotal: HTMLElement
  private readonly timerContainer = el('div', 'hud-timer-badge', this.root)
  private readonly timerValue: HTMLElement
  private readonly bestLapValue: HTMLElement
  private readonly countdownBadge = el('div', 'hud-countdown', this.root)
  private readonly wrongWayBadge = el('div', 'hud-wrong-way', this.root)

  // Results
  private readonly resultsOverlay = el('div', 'hud-results', this.root)
  private readonly resultsCard = el('div', 'hud-results-card', this.resultsOverlay)
  private readonly resultsPosition: HTMLElement
  private readonly resultsTable: HTMLTableElement

  // Kart controls & physics UI
  private readonly speedValue: HTMLElement
  private readonly driftBar = el('div', 'hud-drift', this.root)
  private readonly fill: HTMLElement
  private readonly marker: HTMLElement
  private readonly pips: HTMLElement[] = []
  private readonly nitro = el('div', 'hud-nitro', this.root)
  private readonly nitroLabel: HTMLElement
  private readonly nitroTime: HTMLElement
  private readonly perfectPopup: HTMLElement

  // Cached state
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

  private lapText = ''
  private positionText = ''
  private positionTotalText = ''
  private finalPositionText = ''
  private timeText = ''
  private bestLapText = ''
  private countdownLabel = ''
  private wrongWay = false
  private finished = false

  constructor(parent: HTMLElement = document.body) {
    this.root.append(this.minimap.element)

    // Top race badges
    this.lapBadge.textContent = 'VUELTA 1/3'
    this.positionValue = el('span', 'hud-position-value', this.positionBadge)
    this.positionTotal = el('span', 'hud-position-total', this.positionBadge)
    this.timerValue = el('span', 'hud-timer-value', this.timerContainer)
    this.timerValue.textContent = '0:00.00'
    this.bestLapValue = el('span', 'hud-best-lap', this.timerContainer)

    this.wrongWayBadge.textContent = '¡VÍA CONTRARIA!'

    // Results modal
    const title = el('h2', 'hud-results-title', this.resultsCard)
    title.textContent = '¡CARRERA TERMINADA!'
    this.resultsPosition = el('div', 'hud-results-position', this.resultsCard)
    this.resultsTable = document.createElement('table')
    this.resultsTable.className = 'hud-results-table'
    this.resultsCard.append(this.resultsTable)
    const restartPrompt = el('div', 'hud-results-restart', this.resultsCard)
    restartPrompt.textContent = 'Presiona R para reiniciar la carrera'

    // Speedometer
    const speed = el('div', 'hud-speed', this.root)
    this.speedValue = el('span', 'hud-speed-value', speed)
    this.speedValue.textContent = '0'
    el('span', 'hud-speed-unit', speed).textContent = SPEED_UNIT

    // Drift Bar
    const track = el('div', 'hud-drift-track', this.driftBar)
    this.fill = el('div', 'hud-drift-fill', track)
    this.marker = el('div', 'hud-drift-marker', track)
    const pipRow = el('div', 'hud-pips', this.driftBar)
    for (let i = 0; i < PIP_COUNT; i++) this.pips.push(el('div', 'hud-pip', pipRow))

    // Nitro badge
    this.nitroLabel = el('div', 'hud-nitro-label', this.nitro)
    this.nitroTime = el('div', 'hud-nitro-time', el('div', 'hud-nitro-track', this.nitro))
    this.perfectPopup = el('div', 'hud-perfect', this.root)
    this.perfectPopup.textContent = PERFECT_TEXT

    parent.append(this.root)
  }

  setTrack(track: Track): void {
    this.minimap.setTrack(track)
  }

  /** Draws the model, touching only what changed since the previous call. */
  update(model: HudModel, playerPos?: Vec2, playerHeading?: number): void {
    this.updateSpeed(model)
    this.updateDrift(model)
    this.updateNitro(model)
    this.updateRace(model)

    if (playerPos && playerHeading !== undefined) {
      this.minimap.update(playerPos, playerHeading)
    }
  }

  private updateRace(model: HudModel): void {
    if (model.lapText !== this.lapText) {
      this.lapText = model.lapText
      this.lapBadge.textContent = model.lapText
    }

    if (model.positionText !== this.positionText) {
      this.positionText = model.positionText
      this.positionValue.textContent = model.positionText
    }

    if (model.positionTotalText !== this.positionTotalText) {
      this.positionTotalText = model.positionTotalText
      this.positionTotal.textContent = model.positionTotalText
    }

    if (model.finalPositionText !== this.finalPositionText) {
      this.finalPositionText = model.finalPositionText
      this.resultsPosition.textContent = model.finalPositionText
    }

    if (model.timeText !== this.timeText) {
      this.timeText = model.timeText
      this.timerValue.textContent = model.timeText
    }

    if (model.bestLapText !== this.bestLapText) {
      this.bestLapText = model.bestLapText
      this.bestLapValue.textContent = model.bestLapText
    }

    if (model.countdownLabel !== this.countdownLabel) {
      this.countdownLabel = model.countdownLabel
      this.countdownBadge.textContent = model.countdownLabel
      this.countdownBadge.classList.toggle('is-active', model.countdownLabel !== '')
    }

    if (model.wrongWay !== this.wrongWay) {
      this.wrongWay = model.wrongWay
      this.wrongWayBadge.classList.toggle('is-visible', model.wrongWay)
    }

    if (model.finished !== this.finished) {
      this.finished = model.finished
      this.resultsOverlay.classList.toggle('is-visible', model.finished)
      if (model.finished && model.finalTimes) {
        this.renderResultsTable(model.finalTimes)
      }
    }
  }

  private renderResultsTable(times: FinalTimes): void {
    this.resultsTable.innerHTML = `
      <tr><td>Vuelta 1:</td><td>${times.lap1}</td></tr>
      <tr><td>Vuelta 2:</td><td>${times.lap2}</td></tr>
      <tr><td>Vuelta 3:</td><td>${times.lap3}</td></tr>
      <tr style="border-top: 2px solid rgba(255,255,255,0.2)"><td>Total:</td><td>${times.total}</td></tr>
      <tr><td>Mejor Vuelta:</td><td style="color: #a8e6cf">${times.best}</td></tr>
    `
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
