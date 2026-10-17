import type { Vec2 } from '../sim/math'
import type { Track } from '../sim/track'

/** Same colors as the bots' karts, in grid order. */
const BOT_DOT_COLORS = ['#3c7be8', '#3cc15a', '#e8c53c', '#a43ce8', '#3ce0e0', '#e8883c', '#e83ca8']

export class Minimap {
  readonly element: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly bgCanvas: HTMLCanvasElement
  private readonly bgCtx: CanvasRenderingContext2D

  private readonly size: number
  private scale = 1
  private offsetX = 0
  private offsetZ = 0

  constructor(size = 140) {
    this.size = size
    this.element = document.createElement('canvas')
    this.element.width = size
    this.element.height = size
    this.element.className = 'hud-minimap'

    const ctx = this.element.getContext('2d')
    if (!ctx) throw new Error('Could not get 2d context for minimap')
    this.ctx = ctx

    this.bgCanvas = document.createElement('canvas')
    this.bgCanvas.width = size
    this.bgCanvas.height = size
    const bgCtx = this.bgCanvas.getContext('2d')
    if (!bgCtx) throw new Error('Could not get 2d context for minimap background')
    this.bgCtx = bgCtx
  }

  setTrack(track: Track): void {
    // Calculate bounding box of centerline
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity

    for (const pt of track.centerline) {
      if (pt.x < minX) minX = pt.x
      if (pt.x > maxX) maxX = pt.x
      if (pt.z < minZ) minZ = pt.z
      if (pt.z > maxZ) maxZ = pt.z
    }

    const padding = 16
    const trackWidth = maxX - minX || 1
    const trackHeight = maxZ - minZ || 1

    const scaleX = (this.size - padding * 2) / trackWidth
    const scaleZ = (this.size - padding * 2) / trackHeight
    this.scale = Math.min(scaleX, scaleZ)

    this.offsetX = this.size / 2 - ((minX + maxX) / 2) * this.scale
    this.offsetZ = this.size / 2 - ((minZ + maxZ) / 2) * this.scale

    this.renderBackground(track)
  }

  private toCanvas(pos: Vec2): { x: number; y: number } {
    return {
      x: pos.x * this.scale + this.offsetX,
      y: pos.z * this.scale + this.offsetZ,
    }
  }

  private renderBackground(track: Track): void {
    const ctx = this.bgCtx
    ctx.clearRect(0, 0, this.size, this.size)

    // Outer circular radar glow
    ctx.fillStyle = 'rgba(12, 18, 24, 0.65)'
    ctx.beginPath()
    ctx.arc(this.size / 2, this.size / 2, this.size / 2 - 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.stroke()

    // Draw track path
    ctx.beginPath()
    for (let i = 0; i < track.centerline.length; i++) {
      const pt = track.point(i)
      const { x, y } = this.toCanvas(pt)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()

    // Road casing
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.lineWidth = 7
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    // Road center
    ctx.strokeStyle = '#2b2f38'
    ctx.lineWidth = 5
    ctx.stroke()

    // Shortcut branches (thinner, on top of the main road)
    for (const branch of track.branches) {
      ctx.beginPath()
      branch.points.forEach((pt, i) => {
        const { x, y } = this.toCanvas(pt)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.strokeStyle = branch.surface === 'mud' ? '#7a5230' : '#2b2f38'
      ctx.lineWidth = 3
      ctx.stroke()
    }

    // Start/Finish line marker
    const start = this.toCanvas(track.point(0))
    ctx.fillStyle = '#ffdd44'
    ctx.beginPath()
    ctx.arc(start.x, start.y, 3.5, 0, Math.PI * 2)
    ctx.fill()
  }

  /** @param others positions of the rival karts, drawn as dots under the player's arrow */
  update(playerPos: Vec2, playerHeading: number, others: readonly Vec2[] = []): void {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.size, this.size)

    // Draw cached track background
    ctx.drawImage(this.bgCanvas, 0, 0)

    for (let i = 0; i < others.length; i++) {
      const other = others[i]
      if (!other) continue
      const o = this.toCanvas(other)
      ctx.fillStyle = BOT_DOT_COLORS[i % BOT_DOT_COLORS.length] ?? '#ffffff'
      ctx.beginPath()
      ctx.arc(o.x, o.y, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'
      ctx.stroke()
    }

    // Draw player arrow / marker
    const p = this.toCanvas(playerPos)

    ctx.save()
    ctx.translate(p.x, p.y)
    // In our coordinate system, heading angle: x = cos(heading), z = -sin(heading).
    // Canvas y is +z. Canvas angle = -heading + PI / 2:
    const angle = Math.atan2(Math.sin(-playerHeading), Math.cos(-playerHeading)) + Math.PI / 2
    ctx.rotate(angle)

    // Outer glow
    ctx.fillStyle = '#ff6b35'
    ctx.beginPath()
    ctx.arc(0, 0, 5, 0, Math.PI * 2)
    ctx.fill()

    // Arrow pointing forward
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(0, -6)
    ctx.lineTo(4, 4)
    ctx.lineTo(0, 2)
    ctx.lineTo(-4, 4)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }
}
