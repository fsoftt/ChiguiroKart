import './hud.css'
import './quickRaceMenu.css'
import type { Vec2 } from '../sim/math'
import type { Track } from '../sim/track'
import type { FinalTimes, HudModel, ItemHudModel } from './hudModel'
import { Minimap } from './minimap'

const PIP_COUNT = 3
const PERFECT_TEXT = '¡Perfecto!'
const SPEED_UNIT = 'km/h'
const PERCENT = 100
const MOSQUITO_BLOTCHES = 14
const PERCENT_DECIMALS = 1
const RACE_TITLE = '¡CARRERA TERMINADA!'
const TIME_TRIAL_TITLE = '¡CONTRARRELOJ TERMINADA!'

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
  private readonly ghostDeltaValue: HTMLElement
  private readonly countdownBadge = el('div', 'hud-countdown', this.root)
  private readonly wrongWayBadge = el('div', 'hud-wrong-way', this.root)

  // Results
  private readonly resultsOverlay = el('div', 'hud-results', this.root)
  private readonly resultsCard = el('div', 'hud-results-card', this.resultsOverlay)
  private readonly resultsTitle: HTMLElement
  private readonly resultsRecord: HTMLElement
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

  // Items
  private readonly itemSlot = el('div', 'hud-item', this.root)
  private readonly itemIcon: HTMLElement
  private readonly itemName: HTMLElement
  private readonly itemUses: HTMLElement
  private readonly itemCharged: HTMLElement
  private readonly uchuvaBadge = el('div', 'hud-uchuvas', this.root)
  private readonly uchuvaValue: HTMLElement
  private readonly uchuvaFullTag: HTMLElement
  private readonly mosquitoOverlay = el('div', 'hud-mosquitos', this.root)
  private readonly flashOverlay = el('div', 'hud-flash', this.root)
  private readonly eventPopup = el('div', 'hud-event-popup', this.root)
  private itemState: ItemHudModel | null = null
  private blind = -1

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
  private ghostDeltaText = ''
  private ghostAhead = false
  private newRecord = false
  private countdownLabel = ''
  private wrongWay = false
  private finished = false

  /** Called by the results modal buttons. */
  onRematch: (() => void) | null = null
  onMenu: (() => void) | null = null

  constructor(parent: HTMLElement = document.body) {
    this.root.append(this.minimap.element)

    // Top race badges
    this.lapBadge.textContent = 'VUELTA 1/3'
    this.positionValue = el('span', 'hud-position-value', this.positionBadge)
    this.positionTotal = el('span', 'hud-position-total', this.positionBadge)
    this.timerValue = el('span', 'hud-timer-value', this.timerContainer)
    this.timerValue.textContent = '0:00.00'
    this.bestLapValue = el('span', 'hud-best-lap', this.timerContainer)
    this.ghostDeltaValue = el('span', 'hud-ghost-delta', this.timerContainer)

    this.wrongWayBadge.textContent = '¡VÍA CONTRARIA!'

    // Results modal
    this.resultsTitle = el('h2', 'hud-results-title', this.resultsCard)
    this.resultsTitle.textContent = RACE_TITLE
    this.resultsRecord = el('div', 'hud-results-record', this.resultsCard)
    this.resultsRecord.textContent = '¡Nuevo récord!'
    this.resultsPosition = el('div', 'hud-results-position', this.resultsCard)
    this.resultsTable = document.createElement('table')
    this.resultsTable.className = 'hud-results-table'
    this.resultsCard.append(this.resultsTable)
    const restartPrompt = el('div', 'hud-results-restart', this.resultsCard)
    restartPrompt.textContent = 'Enter: revancha · R: reiniciar'
    const actions = el('div', 'hud-results-actions', this.resultsCard)
    const rematch = el('button', 'hud-results-button', actions) as HTMLButtonElement
    rematch.type = 'button'
    rematch.textContent = 'Revancha'
    rematch.addEventListener('click', () => this.onRematch?.())
    const menu = el('button', 'hud-results-button is-secondary', actions) as HTMLButtonElement
    menu.type = 'button'
    menu.textContent = 'Menú'
    menu.addEventListener('click', () => this.onMenu?.())

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

    // Item slot, uchuva counter and overlays
    this.itemIcon = el('span', 'hud-item-icon', this.itemSlot)
    const itemText = el('div', 'hud-item-text', this.itemSlot)
    this.itemName = el('span', 'hud-item-name', itemText)
    this.itemUses = el('span', 'hud-item-uses', itemText)
    this.itemCharged = el('span', 'hud-item-charged', itemText)
    this.itemCharged.textContent = 'BIEN CARGADO'
    el('span', 'hud-uchuvas-icon', this.uchuvaBadge).textContent = '🟠'
    this.uchuvaValue = el('span', 'hud-uchuvas-value', this.uchuvaBadge)
    this.uchuvaFullTag = el('span', 'hud-uchuvas-full', this.uchuvaBadge)
    this.uchuvaFullTag.textContent = '¡Bien Cargado!'
    for (let i = 0; i < MOSQUITO_BLOTCHES; i++) el('span', 'hud-mosquito', this.mosquitoOverlay)

    parent.append(this.root)
  }

  /** Short message in the middle of the screen (hit, blocked, robbed...). */
  showPopup(text: string): void {
    this.eventPopup.textContent = text
    replay(this.eventPopup, 'is-showing')
  }

  /** Brief white flash over the screen (lightning). */
  flash(): void {
    replay(this.flashOverlay, 'is-flashing')
  }

  /** Whether the results modal is showing. */
  get isFinished(): boolean {
    return this.finished
  }

  /** Shows or hides the whole HUD (race badges, minimap and results), e.g. behind the menu. */
  setVisible(visible: boolean): void {
    this.root.classList.toggle('is-hidden', !visible)
  }

  /** Time trial hides the position badge and the item widgets, which only make sense with bots. */
  setTimeTrial(enabled: boolean): void {
    this.root.classList.toggle('is-time-trial', enabled)
    this.resultsTitle.textContent = enabled ? TIME_TRIAL_TITLE : RACE_TITLE
  }

  setTrack(track: Track): void {
    this.minimap.setTrack(track)
  }

  /** Draws the model, touching only what changed since the previous call. */
  update(
    model: HudModel,
    playerPos?: Vec2,
    playerHeading?: number,
    others?: readonly Vec2[],
  ): void {
    this.updateSpeed(model)
    this.updateDrift(model)
    this.updateNitro(model)
    this.updateRace(model)
    this.updateItems(model.items)

    if (playerPos && playerHeading !== undefined) {
      this.minimap.update(playerPos, playerHeading, others)
    }
  }

  private updateItems(items: ItemHudModel): void {
    const prev = this.itemState
    if (!prev || items.icon !== prev.icon || items.name !== prev.name) {
      this.itemIcon.textContent = items.icon
      this.itemName.textContent = items.name
      this.itemSlot.classList.toggle('is-filled', items.hasPower)
    }
    if (!prev || items.rolling !== prev.rolling) {
      this.itemSlot.classList.toggle('is-rolling', items.rolling)
    }
    if (!prev || items.usesText !== prev.usesText) this.itemUses.textContent = items.usesText
    if (!prev || items.charged !== prev.charged) {
      this.itemSlot.classList.toggle('is-charged', items.charged)
    }
    if (!prev || items.uchuvaText !== prev.uchuvaText) {
      this.uchuvaValue.textContent = items.uchuvaText
    }
    if (!prev || items.uchuvaFull !== prev.uchuvaFull) {
      this.uchuvaBadge.classList.toggle('is-full', items.uchuvaFull)
    }
    this.itemState = items
    if (items.blind !== this.blind) {
      this.blind = items.blind
      this.mosquitoOverlay.style.opacity = String(items.blind)
      this.mosquitoOverlay.classList.toggle('is-active', items.blind > 0)
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

    if (model.ghostDeltaText !== this.ghostDeltaText) {
      this.ghostDeltaText = model.ghostDeltaText
      this.ghostDeltaValue.textContent = model.ghostDeltaText
    }

    if (model.ghostAhead !== this.ghostAhead) {
      this.ghostAhead = model.ghostAhead
      this.ghostDeltaValue.classList.toggle('is-ahead', model.ghostAhead)
    }

    if (model.newRecord !== this.newRecord) {
      this.newRecord = model.newRecord
      this.resultsRecord.classList.toggle('is-visible', model.newRecord)
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
