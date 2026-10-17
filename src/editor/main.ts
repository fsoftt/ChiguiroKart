import { cocoraPreset, testPreset } from '../config/tracks/trackPresets'
import type { SurfaceType } from '../sim/race/surface'
import {
  CUSTOM_TRACK_KEY,
  MIN_CONTROL_POINTS,
  SURFACES,
  buildTrackDefinition,
  parseTrackDataText,
  validateTrackData,
  type TrackData,
} from '../sim/trackData'
import {
  addShortcut,
  deleteSelected,
  formatBoxRows,
  formatUchuvaLines,
  hitHandle,
  insertPointAt,
  moveSelected,
  parseBoxRows,
  parseOptionalGates,
  parseUchuvaLines,
  selectedPosition,
  surfaceLabel,
  type Selection,
} from './editorOps'
import { HANDLE_RADIUS, drawScene } from './render'
import { fitView, panBy, screenToWorld, zoomAt, type Viewport } from './viewport'

const DRAFT_KEY = 'chiguirokart.editor.draft.v1'
const UNDO_LIMIT = 50
/** Pointer movement (px) under which a press counts as a click, not a drag. */
const CLICK_TOLERANCE = 4
const HANDLE_HIT_PIXELS = HANDLE_RADIUS + 4

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing element #${id}`)
  return element as T
}

const canvas = byId<HTMLCanvasElement>('canvas')
const context = canvas.getContext('2d')
if (!context) throw new Error('2D canvas is not available')
const ctx: CanvasRenderingContext2D = context

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

let data: TrackData = parseTrackDataText(readStorage(DRAFT_KEY) ?? '') ?? cocoraPreset()
let selection: Selection = null
let view: Viewport = { centerX: 0, centerZ: 0, scale: 2 }
let width = 1
let height = 1
const undoStack: string[] = []

const el = {
  name: byId<HTMLInputElement>('name'),
  halfWidth: byId<HTMLInputElement>('halfWidth'),
  samples: byId<HTMLInputElement>('samples'),
  selectionInfo: byId<HTMLElement>('selection-info'),
  selectionFields: byId<HTMLElement>('selection-fields'),
  ptX: byId<HTMLInputElement>('pt-x'),
  ptZ: byId<HTMLInputElement>('pt-z'),
  ptY: byId<HTMLInputElement>('pt-y'),
  ptYLabel: byId<HTMLElement>('pt-y-label'),
  ptSurface: byId<HTMLSelectElement>('pt-surface'),
  ptSurfaceLabel: byId<HTMLElement>('pt-surface-label'),
  branchFields: byId<HTMLElement>('branch-fields'),
  branchPick: byId<HTMLSelectElement>('branch-pick'),
  branchName: byId<HTMLInputElement>('branch-name'),
  branchWidth: byId<HTMLInputElement>('branch-width'),
  branchSurface: byId<HTMLSelectElement>('branch-surface'),
  cpCount: byId<HTMLInputElement>('cp-count'),
  cpOptional: byId<HTMLInputElement>('cp-optional'),
  boxRows: byId<HTMLTextAreaElement>('box-rows'),
  uchuvaLines: byId<HTMLTextAreaElement>('uchuva-lines'),
  messages: byId<HTMLUListElement>('messages'),
  json: byId<HTMLTextAreaElement>('json'),
  status: byId<HTMLElement>('status'),
}

function setStatus(text: string): void {
  el.status.textContent = text
}

// --- Undo -------------------------------------------------------------------------------------

function pushUndo(): void {
  undoStack.push(JSON.stringify(data))
  if (undoStack.length > UNDO_LIMIT) undoStack.shift()
}

function undo(): void {
  const previous = undoStack.pop()
  const parsed = previous ? parseTrackDataText(previous) : null
  if (!parsed) return
  data = parsed
  selection = null
  changed(true)
}

// --- Panel sync -------------------------------------------------------------------------------

function fillSurfaceSelect(select: HTMLSelectElement): void {
  for (const surface of SURFACES) {
    select.append(new Option(surfaceLabel(surface), surface))
  }
}

function surfaceFromValue(value: string): SurfaceType {
  return SURFACES.find((s) => s === value) ?? 'asphalt'
}

/** Writes the model into the panel inputs, skipping the one being typed in. */
function syncPanel(): void {
  const active = document.activeElement
  const set = (input: HTMLInputElement | HTMLTextAreaElement, value: string): void => {
    if (input !== active) input.value = value
  }
  set(el.name, data.name)
  set(el.halfWidth, String(data.halfWidth))
  set(el.samples, String(data.samplesPerSegment))
  set(el.cpCount, String(data.checkpoints.count))
  set(el.cpOptional, data.checkpoints.optional.map((i) => i + 1).join(', '))
  set(el.boxRows, formatBoxRows(data.itemBoxRows))
  set(el.uchuvaLines, formatUchuvaLines(data.uchuvaLines))

  const position = selectedPosition(data, selection)
  el.selectionInfo.hidden = position !== null
  el.selectionFields.hidden = position === null
  if (position && selection) {
    set(el.ptX, position.x.toFixed(2))
    set(el.ptZ, position.z.toFixed(2))
    const isMain = selection.kind === 'point'
    el.ptYLabel.hidden = !isMain
    el.ptSurfaceLabel.hidden = !isMain
    const point = isMain ? data.points[selection.index] : undefined
    if (point) {
      set(el.ptY, String(point.y))
      el.ptSurface.value = point.surface ?? 'asphalt'
    }
  }

  // Branch list: keep the picked one if it still exists
  const picked = Math.min(Number(el.branchPick.value || 0), data.branches.length - 1)
  const wanted = selection?.kind === 'branch' ? selection.branch : picked
  el.branchPick.replaceChildren(
    ...data.branches.map((b, i) => new Option(`${i + 1}. ${b.name}`, String(i))),
  )
  el.branchFields.hidden = data.branches.length === 0
  const branch = data.branches[Math.max(wanted, 0)]
  if (branch) {
    el.branchPick.value = String(Math.max(wanted, 0))
    set(el.branchName, branch.name)
    set(el.branchWidth, String(branch.halfWidth))
    el.branchSurface.value = branch.surface
  }
}

function refreshMessages(): void {
  const messages = validateTrackData(data)
  el.messages.replaceChildren(
    ...(messages.length === 0
      ? [
          Object.assign(document.createElement('li'), {
            textContent: 'Todo en orden.',
            className: 'ok',
          }),
        ]
      : messages.map((text) =>
          Object.assign(document.createElement('li'), { textContent: text, className: 'warn' }),
        )),
  )
}

// --- Drawing ----------------------------------------------------------------------------------

let frameRequested = false

function requestDraw(): void {
  if (frameRequested) return
  frameRequested = true
  requestAnimationFrame(() => {
    frameRequested = false
    const definition = buildTrackDefinition(data)
    drawScene(ctx, { data, definition, view, selection, width, height })
  })
}

function resize(): void {
  const rect = canvas.getBoundingClientRect()
  const ratio = window.devicePixelRatio || 1
  width = Math.max(rect.width, 1)
  height = Math.max(rect.height, 1)
  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  requestDraw()
}

function fit(): void {
  view = fitView([...data.points, ...data.branches.flatMap((b) => b.points)], width, height)
  requestDraw()
}

/** Call after any model change: redraw, revalidate, resync the panel, autosave. */
function changed(refreshPanel = true): void {
  if (refreshPanel) syncPanel()
  refreshMessages()
  writeStorage(DRAFT_KEY, JSON.stringify(data))
  requestDraw()
}

function replaceData(next: TrackData): void {
  pushUndo()
  data = next
  selection = null
  changed()
  fit()
}

// --- Canvas interaction -----------------------------------------------------------------------

type Drag =
  | {
      mode: 'pan'
      lastX: number
      lastY: number
      startX: number
      startY: number
      moved: boolean
      button: number
    }
  | { mode: 'point' }
  | null

let drag: Drag = null

function pointerPosition(event: PointerEvent): { x: number; z: number } {
  const rect = canvas.getBoundingClientRect()
  return { x: event.clientX - rect.left, z: event.clientY - rect.top }
}

canvas.addEventListener('pointerdown', (event) => {
  canvas.focus()
  canvas.setPointerCapture(event.pointerId)
  const pixel = pointerPosition(event)
  const world = screenToWorld(view, width, height, pixel)
  const hit =
    event.button === 0 ? hitHandle(data, world.x, world.z, HANDLE_HIT_PIXELS / view.scale) : null
  if (hit) {
    pushUndo()
    selection = hit
    drag = { mode: 'point' }
    syncPanel()
    requestDraw()
    return
  }
  drag = {
    mode: 'pan',
    lastX: event.clientX,
    lastY: event.clientY,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    button: event.button,
  }
})

canvas.addEventListener('pointermove', (event) => {
  if (!drag) return
  if (drag.mode === 'point') {
    const world = screenToWorld(view, width, height, pointerPosition(event))
    moveSelected(data, selection, Math.round(world.x * 10) / 10, Math.round(world.z * 10) / 10)
    changed()
    return
  }
  if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > CLICK_TOLERANCE) {
    drag.moved = true
  }
  if (drag.moved) {
    view = panBy(view, event.clientX - drag.lastX, event.clientY - drag.lastY)
    requestDraw()
  }
  drag.lastX = event.clientX
  drag.lastY = event.clientY
})

canvas.addEventListener('pointerup', (event) => {
  const finished = drag
  drag = null
  if (!finished || finished.mode !== 'pan' || finished.moved || finished.button !== 0) return
  // A click without dragging: add a point on the road, or clear the selection on empty ground
  const world = screenToWorld(view, width, height, pointerPosition(event))
  const before = JSON.stringify(data)
  const inserted = insertPointAt(data, world.x, world.z)
  if (inserted) {
    undoStack.push(before)
    selection = inserted
  } else {
    selection = null
  }
  changed()
})

canvas.addEventListener('pointercancel', () => {
  drag = null
})

canvas.addEventListener('contextmenu', (event) => event.preventDefault())

canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault()
    view = zoomAt(
      view,
      width,
      height,
      pointerPosition(event as unknown as PointerEvent),
      event.deltaY,
    )
    requestDraw()
  },
  { passive: false },
)

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

window.addEventListener('keydown', (event) => {
  if (isTyping(event.target)) return
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    deleteCurrent()
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    undo()
  }
})

function deleteCurrent(): void {
  const before = JSON.stringify(data)
  if (deleteSelected(data, selection)) {
    undoStack.push(before)
    selection = null
    changed()
  } else if (selection) {
    setStatus(
      `No se puede borrar: se necesitan al menos ${MIN_CONTROL_POINTS} puntos (2 en un atajo).`,
    )
  }
}

// --- Panel events -----------------------------------------------------------------------------

function numberOf(input: HTMLInputElement): number | null {
  const value = Number(input.value)
  return input.value.trim() !== '' && Number.isFinite(value) ? value : null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Edits via the panel: one undo step per edit, and no panel resync of the focused field. */
function edit(apply: () => void): void {
  pushUndo()
  apply()
  changed()
}

el.name.addEventListener('input', () => edit(() => (data.name = el.name.value.trim() || 'Pista')))
el.halfWidth.addEventListener('input', () => {
  const v = numberOf(el.halfWidth)
  if (v !== null) edit(() => (data.halfWidth = clamp(v, 2, 40)))
})
el.samples.addEventListener('input', () => {
  const v = numberOf(el.samples)
  if (v !== null) edit(() => (data.samplesPerSegment = clamp(Math.round(v), 2, 40)))
})

for (const [input, key] of [
  [el.ptX, 'x'],
  [el.ptZ, 'z'],
] as const) {
  input.addEventListener('input', () => {
    const v = numberOf(input)
    const target = selectedPosition(data, selection)
    if (v !== null && target) edit(() => (target[key] = v))
  })
}
el.ptY.addEventListener('input', () => {
  const v = numberOf(el.ptY)
  const point = selection?.kind === 'point' ? data.points[selection.index] : undefined
  if (v !== null && point) edit(() => (point.y = clamp(v, -100, 500)))
})
el.ptSurface.addEventListener('change', () => {
  const point = selection?.kind === 'point' ? data.points[selection.index] : undefined
  if (!point) return
  const surface = surfaceFromValue(el.ptSurface.value)
  edit(() => {
    if (surface === 'asphalt') delete point.surface
    else point.surface = surface
  })
})
byId('pt-delete').addEventListener('click', deleteCurrent)

el.branchPick.addEventListener('change', () => {
  selection = null
  syncPanel()
  requestDraw()
})
function pickedBranch(): TrackData['branches'][number] | undefined {
  return data.branches[Number(el.branchPick.value)]
}
el.branchName.addEventListener('input', () => {
  const branch = pickedBranch()
  if (branch) edit(() => (branch.name = el.branchName.value.trim() || 'Atajo'))
})
el.branchWidth.addEventListener('input', () => {
  const branch = pickedBranch()
  const v = numberOf(el.branchWidth)
  if (branch && v !== null) edit(() => (branch.halfWidth = clamp(v, 2, 40)))
})
el.branchSurface.addEventListener('change', () => {
  const branch = pickedBranch()
  if (branch) edit(() => (branch.surface = surfaceFromValue(el.branchSurface.value)))
})
byId('branch-add').addEventListener('click', () => {
  pushUndo()
  selection = addShortcut(data)
  changed()
})
byId('branch-delete').addEventListener('click', () => {
  const index = Number(el.branchPick.value)
  if (!pickedBranch()) return
  pushUndo()
  data.branches.splice(index, 1)
  selection = null
  changed()
})

el.cpCount.addEventListener('input', () => {
  const v = numberOf(el.cpCount)
  if (v === null) return
  edit(() => {
    data.checkpoints.count = clamp(Math.round(v), 1, 64)
    data.checkpoints.optional = data.checkpoints.optional.filter((i) => i < data.checkpoints.count)
  })
})
el.cpOptional.addEventListener('input', () =>
  edit(
    () =>
      (data.checkpoints.optional = parseOptionalGates(el.cpOptional.value, data.checkpoints.count)),
  ),
)
el.boxRows.addEventListener('input', () =>
  edit(() => (data.itemBoxRows = parseBoxRows(el.boxRows.value))),
)
el.uchuvaLines.addEventListener('input', () =>
  edit(() => (data.uchuvaLines = parseUchuvaLines(el.uchuvaLines.value))),
)

byId('preset-cocora').addEventListener('click', () => replaceData(cocoraPreset()))
byId('preset-test').addEventListener('click', () => replaceData(testPreset()))
byId('fit').addEventListener('click', fit)

// --- Import / export / play -------------------------------------------------------------------

byId('json-show').addEventListener('click', () => {
  el.json.value = JSON.stringify(data, null, 2)
  setStatus('JSON actualizado. Cópialo o descárgalo.')
})

function loadText(text: string): void {
  const parsed = parseTrackDataText(text)
  if (!parsed) {
    setStatus('JSON inválido: revisa la versión, los puntos y los números.')
    return
  }
  replaceData(parsed)
  setStatus(`Pista "${parsed.name}" cargada.`)
}

byId('json-load').addEventListener('click', () => loadText(el.json.value))

byId<HTMLInputElement>('file').addEventListener('change', (event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  void file.text().then(loadText)
})

byId('download').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${data.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'pista'}.json`
  link.click()
  URL.revokeObjectURL(url)
})

byId('play').addEventListener('click', () => {
  if (data.points.length < MIN_CONTROL_POINTS) {
    setStatus(`Faltan puntos: se necesitan al menos ${MIN_CONTROL_POINTS}.`)
    return
  }
  if (!writeStorage(CUSTOM_TRACK_KEY, JSON.stringify(data))) {
    setStatus('No se pudo guardar la pista en el navegador (almacenamiento bloqueado).')
    return
  }
  window.open('index.html?pista=custom', '_blank')
})

// --- Start ------------------------------------------------------------------------------------

fillSurfaceSelect(el.ptSurface)
fillSurfaceSelect(el.branchSurface)
window.addEventListener('resize', resize)
resize()
fit()
changed()
