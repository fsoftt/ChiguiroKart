import type { Vec2 } from '../sim/math'
import type { SurfaceType } from '../sim/race/surface'
import { Track, type TrackDefinition } from '../sim/track'
import type { TrackData } from '../sim/trackData'
import { selectedPosition, type Selection } from './editorOps'
import { gridStep, screenToWorld, worldToScreen, type Viewport } from './viewport'

const SURFACE_COLORS: Record<SurfaceType, string> = {
  asphalt: '#59605a',
  dirt: '#a07c55',
  grass: '#3f7d45',
  mud: '#6e4a2b',
  wood: '#b78552',
  ice: '#bfe6f5',
  sand: '#e6cf8f',
  water: '#3f8fc9',
}
const BACKGROUND = '#26361f'
const GRID_MINOR = 'rgba(255,255,255,0.06)'
const GRID_MAJOR = 'rgba(255,255,255,0.14)'
const HANDLE_RADIUS = 6
const ARROW_EVERY = 12

export interface DrawState {
  data: TrackData
  definition: TrackDefinition
  view: Viewport
  selection: Selection
  width: number
  height: number
}

function drawGrid(ctx: CanvasRenderingContext2D, s: DrawState): void {
  const step = gridStep(s.view.scale)
  const topLeft = screenToWorld(s.view, s.width, s.height, { x: 0, z: 0 })
  const bottomRight = screenToWorld(s.view, s.width, s.height, { x: s.width, z: s.height })
  ctx.font = '10px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  for (let gx = Math.ceil(topLeft.x / step) * step; gx <= bottomRight.x; gx += step) {
    const sx = worldToScreen(s.view, s.width, s.height, { x: gx, z: 0 }).x
    ctx.strokeStyle = gx % (step * 5) === 0 ? GRID_MAJOR : GRID_MINOR
    ctx.beginPath()
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, s.height)
    ctx.stroke()
    ctx.fillText(`${gx} m`, sx + 2, 10)
  }
  for (let gz = Math.ceil(topLeft.z / step) * step; gz <= bottomRight.z; gz += step) {
    const sz = worldToScreen(s.view, s.width, s.height, { x: 0, z: gz }).z
    ctx.strokeStyle = gz % (step * 5) === 0 ? GRID_MAJOR : GRID_MINOR
    ctx.beginPath()
    ctx.moveTo(0, sz)
    ctx.lineTo(s.width, sz)
    ctx.stroke()
    ctx.fillText(`${gz} m`, 2, sz - 2)
  }
}

function drawRoad(ctx: CanvasRenderingContext2D, s: DrawState, track: Track): void {
  const line = s.definition.centerline
  const n = line.length
  const half = s.data.halfWidth
  ctx.lineJoin = 'round'
  for (let i = 0; i < n; i++) {
    const a = line[i]
    const b = line[(i + 1) % n]
    if (!a || !b) continue
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
    const nx = (-(b.z - a.z) / len) * half
    const nz = ((b.x - a.x) / len) * half
    const quad = [
      { x: a.x + nx, z: a.z + nz },
      { x: b.x + nx, z: b.z + nz },
      { x: b.x - nx, z: b.z - nz },
      { x: a.x - nx, z: a.z - nz },
    ].map((p) => worldToScreen(s.view, s.width, s.height, p))
    const color = SURFACE_COLORS[track.surfaceAt(a.x, a.z)]
    ctx.fillStyle = color
    ctx.strokeStyle = color
    ctx.beginPath()
    quad.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x, p.z) : ctx.lineTo(p.x, p.z)))
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  // Centerline
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.setLineDash([6, 8])
  ctx.beginPath()
  line.forEach((p, i) => {
    const q = worldToScreen(s.view, s.width, s.height, p)
    if (i === 0) ctx.moveTo(q.x, q.z)
    else ctx.lineTo(q.x, q.z)
  })
  ctx.closePath()
  ctx.stroke()
  ctx.setLineDash([])
}

function drawArrows(ctx: CanvasRenderingContext2D, s: DrawState): void {
  const line = s.definition.centerline
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  for (let i = 0; i < line.length; i += ARROW_EVERY) {
    const a = line[i]
    const b = line[(i + 1) % line.length]
    if (!a || !b) continue
    const p = worldToScreen(s.view, s.width, s.height, a)
    const q = worldToScreen(s.view, s.width, s.height, b)
    const angle = Math.atan2(q.z - p.z, q.x - p.x)
    ctx.save()
    ctx.translate(p.x, p.z)
    ctx.rotate(angle)
    ctx.beginPath()
    ctx.moveTo(6, 0)
    ctx.lineTo(-4, 4)
    ctx.lineTo(-4, -4)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
}

function drawBranches(ctx: CanvasRenderingContext2D, s: DrawState): void {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const branch of s.data.branches) {
    ctx.strokeStyle = SURFACE_COLORS[branch.surface]
    ctx.lineWidth = branch.halfWidth * 2 * s.view.scale
    ctx.beginPath()
    branch.points.forEach((p, i) => {
      const q = worldToScreen(s.view, s.width, s.height, p)
      if (i === 0) ctx.moveTo(q.x, q.z)
      else ctx.lineTo(q.x, q.z)
    })
    ctx.stroke()
  }
  ctx.lineWidth = 1
  ctx.lineCap = 'butt'
}

function drawCheckpoints(ctx: CanvasRenderingContext2D, s: DrawState): void {
  for (const cp of s.definition.checkpoints ?? []) {
    const rightX = cp.forward.z
    const rightZ = -cp.forward.x
    const half = cp.width / 2
    const a = worldToScreen(s.view, s.width, s.height, {
      x: cp.position.x + rightX * half,
      z: cp.position.z + rightZ * half,
    })
    const b = worldToScreen(s.view, s.width, s.height, {
      x: cp.position.x - rightX * half,
      z: cp.position.z - rightZ * half,
    })
    const start = cp.index === 0
    ctx.strokeStyle = start ? '#ffffff' : cp.mandatory ? '#4fc3f7' : '#ba8cff'
    ctx.lineWidth = start ? 4 : 2
    ctx.setLineDash(cp.mandatory ? [] : [5, 4])
    ctx.beginPath()
    ctx.moveTo(a.x, a.z)
    ctx.lineTo(b.x, b.z)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#ffffff'
    ctx.font = '11px system-ui, sans-serif'
    const mid = worldToScreen(s.view, s.width, s.height, cp.position)
    ctx.fillText(start ? 'SALIDA' : String(cp.index + 1), mid.x + 6, mid.z - 6)
  }
  ctx.lineWidth = 1
}

function drawPickups(ctx: CanvasRenderingContext2D, s: DrawState): void {
  ctx.fillStyle = '#ffd24a'
  for (const p of s.definition.itemBoxes ?? []) {
    const q = worldToScreen(s.view, s.width, s.height, p)
    ctx.fillRect(q.x - 4, q.z - 4, 8, 8)
  }
  ctx.fillStyle = '#ff8a3d'
  for (const p of s.definition.uchuvas ?? []) {
    const q = worldToScreen(s.view, s.width, s.height, p)
    ctx.beginPath()
    ctx.arc(q.x, q.z, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawHandle(
  ctx: CanvasRenderingContext2D,
  s: DrawState,
  p: Vec2,
  color: string,
  selected: boolean,
  label: string,
): void {
  const q = worldToScreen(s.view, s.width, s.height, p)
  ctx.fillStyle = color
  ctx.strokeStyle = selected ? '#ffffff' : '#101410'
  ctx.lineWidth = selected ? 3 : 2
  ctx.beginPath()
  ctx.arc(q.x, q.z, selected ? HANDLE_RADIUS + 2 : HANDLE_RADIUS, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.lineWidth = 1
  if (label) {
    ctx.fillStyle = '#ffffff'
    ctx.font = '11px system-ui, sans-serif'
    ctx.fillText(label, q.x + 9, q.z + 4)
  }
}

function drawHandles(ctx: CanvasRenderingContext2D, s: DrawState): void {
  s.data.points.forEach((p, i) => {
    const selected = s.selection?.kind === 'point' && s.selection.index === i
    drawHandle(ctx, s, p, '#f2b632', selected, `${i} · y ${p.y.toFixed(1)}`)
  })
  s.data.branches.forEach((branch, b) => {
    branch.points.forEach((p, i) => {
      const selected =
        s.selection?.kind === 'branch' && s.selection.branch === b && s.selection.index === i
      drawHandle(ctx, s, p, '#e0763a', selected, '')
    })
  })
}

/** Draws the whole editor scene. The canvas must already be scaled for the pixel ratio. */
export function drawScene(ctx: CanvasRenderingContext2D, s: DrawState): void {
  ctx.clearRect(0, 0, s.width, s.height)
  ctx.fillStyle = BACKGROUND
  ctx.fillRect(0, 0, s.width, s.height)
  drawGrid(ctx, s)
  if (s.data.points.length >= 4) {
    const track = new Track(s.definition)
    drawRoad(ctx, s, track)
    drawBranches(ctx, s)
    drawArrows(ctx, s)
    drawCheckpoints(ctx, s)
    drawPickups(ctx, s)
  }
  drawHandles(ctx, s)
  const selected = selectedPosition(s.data, s.selection)
  if (selected) {
    const q = worldToScreen(s.view, s.width, s.height, selected)
    ctx.fillStyle = '#ffffff'
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillText(`(${selected.x.toFixed(1)}, ${selected.z.toFixed(1)})`, q.x + 9, q.z - 10)
  }
}

export { HANDLE_RADIUS }
