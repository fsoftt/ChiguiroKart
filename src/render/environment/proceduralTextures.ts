import * as THREE from 'three'
import { seededRandom } from '../scenery/random'

/** Canvas-drawn textures of the environment: no files, same pixels on every machine. */

type Random = () => number

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('2D canvas is not available')
  return [canvas, context]
}

function toTexture(canvas: HTMLCanvasElement, srgb = true, repeat = true): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas)
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 8
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  return texture
}

/** Adds per-pixel noise of +-`amount` (0..255 scale) to a canvas. */
function grain(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  random: Random,
  amount: number,
  block = 1,
): void {
  const image = context.getImageData(0, 0, width, height)
  const data = image.data
  for (let y = 0; y < height; y += block) {
    for (let x = 0; x < width; x += block) {
      const n = (random() - 0.5) * 2 * amount
      for (let dy = 0; dy < block && y + dy < height; dy++) {
        for (let dx = 0; dx < block && x + dx < width; dx++) {
          const k = ((y + dy) * width + x + dx) * 4
          data[k] = Math.min(255, Math.max(0, (data[k] as number) + n))
          data[k + 1] = Math.min(255, Math.max(0, (data[k + 1] as number) + n))
          data[k + 2] = Math.min(255, Math.max(0, (data[k + 2] as number) + n))
        }
      }
    }
  }
  context.putImageData(image, 0, 0)
}

/** Soft round blotch drawn at the wrapped positions, so the tile stays seamless. */
function wrappedBlotch(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  for (const ox of [-width, 0, width]) {
    for (const oy of [-height, 0, height]) {
      const cx = x + ox
      const cy = y + oy
      if (cx + radius < 0 || cx - radius > width || cy + radius < 0 || cy - radius > height) {
        continue
      }
      const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, radius)
      gradient.addColorStop(0, color)
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      context.fillStyle = gradient
      context.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)
    }
  }
}

/** Neutral light speckle that multiplies the terrain's vertex colors with blade-like detail. */
export function grassDetailTexture(seed: number): THREE.CanvasTexture {
  const size = 256
  const random = seededRandom(seed + 101)
  const [canvas, context] = makeCanvas(size, size)
  context.fillStyle = '#d4d4d4'
  context.fillRect(0, 0, size, size)
  for (let i = 0; i < 70; i++) {
    const light = random() < 0.5
    wrappedBlotch(
      context,
      size,
      size,
      random() * size,
      random() * size,
      14 + random() * 34,
      light ? 'rgba(255,255,255,0.22)' : 'rgba(60,60,60,0.14)',
    )
  }
  context.lineCap = 'round'
  for (let i = 0; i < 250; i++) {
    const x = random() * size
    const y = random() * size
    const lean = (random() - 0.5) * 6
    const length = 3 + random() * 6
    const shade = random() < 0.5 ? 255 : 80
    context.strokeStyle = `rgba(${shade},${shade},${shade},${0.08 + random() * 0.1})`
    context.lineWidth = 1 + random() * 0.8
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x + lean, y - length)
    context.stroke()
  }
  grain(context, size, size, random, 3)
  return toTexture(canvas)
}

/** Meters of road one `asphaltTexture` tile covers along the road. */
export const ASPHALT_TILE = 32
/** Meters one `woodTexture` tile covers along the road. */
export const WOOD_TILE = 8
/** Meters one `mudTexture` tile covers along the road. */
export const MUD_TILE = 12
/** Meters of curb one `curbTexture` tile covers (one red and one white block). */
export const CURB_TILE = 4
/** Meters of fence rail one `railTexture` tile covers. */
export const RAIL_TILE = 4

/**
 * Asphalt: grain, soft blotches, repair patches, darker racing lines, worn edge lines, a dashed
 * center line and hairline cracks. U runs across the road (0..1), V along it (one tile per
 * `ASPHALT_TILE` meters).
 */
export function asphaltTexture(baseColor: string, seed: number): THREE.CanvasTexture {
  const width = 512
  const height = 1024
  const random = seededRandom(seed + 7)
  const [canvas, context] = makeCanvas(width, height)
  context.fillStyle = baseColor
  context.fillRect(0, 0, width, height)

  for (let i = 0; i < 110; i++) {
    const light = random() < 0.45
    wrappedBlotch(
      context,
      width,
      height,
      random() * width,
      random() * height,
      30 + random() * 80,
      light ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.12)',
    )
  }
  // Repair patches: crisp rectangles a shade off the base
  for (let i = 0; i < 5; i++) {
    const w = 60 + random() * 150
    const h = 50 + random() * 130
    const x = 30 + random() * (width - w - 60)
    const y = 80 + random() * (height - h - 160)
    context.fillStyle = random() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.06)'
    context.fillRect(x, y, w, h)
    context.strokeStyle = 'rgba(0,0,0,0.22)'
    context.lineWidth = 1.5
    context.strokeRect(x, y, w, h)
  }
  // Racing lines: rubber darkening in the two wheel tracks of the ideal line
  for (const u of [0.3, 0.7]) {
    const cx = u * width
    const gradient = context.createLinearGradient(cx - 55, 0, cx + 55, 0)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(0.5, 'rgba(0,0,0,0.3)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = gradient
    context.fillRect(cx - 55, 0, 110, height)
    for (let i = 0; i < 60; i++) {
      context.strokeStyle = `rgba(0,0,0,${0.05 + random() * 0.1})`
      context.lineWidth = 1 + random() * 2
      const x = cx + (random() - 0.5) * 70
      const y = random() * height
      context.beginPath()
      context.moveTo(x, y)
      context.lineTo(x + (random() - 0.5) * 4, y + 40 + random() * 140)
      context.stroke()
    }
  }
  // Edge lines and dashed center line
  context.fillStyle = 'rgba(240,240,232,0.92)'
  context.fillRect(width * 0.035, 0, 11, height)
  context.fillRect(width * 0.965 - 11, 0, 11, height)
  context.fillStyle = 'rgba(244,220,110,0.9)'
  for (let y = 0; y < height; y += 205) context.fillRect(width * 0.5 - 4, y + 20, 8, 102)
  // Cracks: random walks, kept clear of the tile's top and bottom
  context.lineCap = 'round'
  for (let i = 0; i < 14; i++) {
    let x = 40 + random() * (width - 80)
    let y = 70 + random() * (height - 140)
    context.strokeStyle = `rgba(10,10,12,${0.35 + random() * 0.3})`
    context.lineWidth = 0.8 + random() * 1.1
    context.beginPath()
    context.moveTo(x, y)
    const steps = 6 + Math.floor(random() * 10)
    let angle = random() * Math.PI * 2
    for (let s = 0; s < steps; s++) {
      angle += (random() - 0.5) * 1.2
      x += Math.cos(angle) * (8 + random() * 14)
      y += Math.sin(angle) * (8 + random() * 14)
      context.lineTo(x, y)
    }
    context.stroke()
  }
  for (let i = 0; i < 4; i++) {
    const radius = 14 + random() * 22
    wrappedBlotch(
      context,
      width,
      height,
      random() * width,
      random() * height,
      radius,
      'rgba(0,0,0,0.3)',
    )
  }
  // Wear on the paint: speckles of asphalt over the lines
  for (let i = 0; i < 900; i++) {
    const side = random() < 0.5 ? width * 0.035 : width * 0.965 - 11
    context.fillStyle = `rgba(60,62,68,${0.3 + random() * 0.5})`
    context.fillRect(side + random() * 11, random() * height, 1 + random() * 3, 1 + random() * 4)
  }
  grain(context, width, height, random, 14)
  grain(context, width, height, random, 7, 2)
  return toTexture(canvas)
}

/** Wooden bridge planks laid across the road, with butt joints, grain and nails. */
export function woodTexture(seed: number): THREE.CanvasTexture {
  const size = 512
  const random = seededRandom(seed + 19)
  const [canvas, context] = makeCanvas(size, size)
  context.fillStyle = '#2a1a0e'
  context.fillRect(0, 0, size, size)
  const rows = 16
  const rowHeight = size / rows
  const tones = ['#8d5a2b', '#9b6532', '#7d4e24', '#a06c3a', '#855428']
  for (let r = 0; r < rows; r++) {
    let x = 0
    while (x < size) {
      const length = 140 + random() * 300
      const w = Math.min(length, size - x)
      context.fillStyle = tones[Math.floor(random() * tones.length)] ?? '#8d5a2b'
      context.fillRect(x + 1.5, r * rowHeight + 2, w - 3, rowHeight - 4)
      for (let g = 0; g < 7; g++) {
        context.strokeStyle = `rgba(40,20,5,${0.12 + random() * 0.2})`
        context.lineWidth = 0.8
        const y = r * rowHeight + 4 + random() * (rowHeight - 8)
        context.beginPath()
        context.moveTo(x + 3, y)
        context.lineTo(x + w - 3, y + (random() - 0.5) * 3)
        context.stroke()
      }
      context.fillStyle = 'rgba(30,20,12,0.85)'
      for (const nx of [x + 8, x + w - 8]) {
        context.fillRect(nx, r * rowHeight + 7, 3, 3)
        context.fillRect(nx, r * rowHeight + rowHeight - 10, 3, 3)
      }
      x += w
    }
  }
  grain(context, size, size, random, 12)
  return toTexture(canvas)
}

/** Mud with tire ruts and shiny puddles; the roughness map makes the puddles catch the sun. */
export function mudTexture(seed: number): {
  map: THREE.CanvasTexture
  roughness: THREE.CanvasTexture
} {
  const size = 512
  const random = seededRandom(seed + 31)
  const [canvas, context] = makeCanvas(size, size)
  const [roughCanvas, rough] = makeCanvas(size, size)
  context.fillStyle = '#5b3a22'
  context.fillRect(0, 0, size, size)
  rough.fillStyle = '#e6e6e6'
  rough.fillRect(0, 0, size, size)
  for (let i = 0; i < 90; i++) {
    const wet = random() < 0.5
    wrappedBlotch(
      context,
      size,
      size,
      random() * size,
      random() * size,
      20 + random() * 60,
      wet ? 'rgba(30,18,8,0.4)' : 'rgba(150,100,60,0.3)',
    )
  }
  // Tire ruts along the road
  for (const u of [0.32, 0.68]) {
    const cx = u * size
    const gradient = context.createLinearGradient(cx - 30, 0, cx + 30, 0)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(0.5, 'rgba(25,14,6,0.55)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = gradient
    context.fillRect(cx - 30, 0, 60, size)
    const roughGradient = rough.createLinearGradient(cx - 30, 0, cx + 30, 0)
    roughGradient.addColorStop(0, 'rgba(0,0,0,0)')
    roughGradient.addColorStop(0.5, 'rgba(110,110,110,0.7)')
    roughGradient.addColorStop(1, 'rgba(0,0,0,0)')
    rough.fillStyle = roughGradient
    rough.fillRect(cx - 30, 0, 60, size)
  }
  // Puddles: dark rim, sky-colored water, bright glint
  for (let i = 0; i < 9; i++) {
    const x = 50 + random() * (size - 100)
    const y = 40 + random() * (size - 80)
    const rx = 22 + random() * 38
    const ry = rx * (0.4 + random() * 0.4)
    const angle = random() * Math.PI
    const layers: readonly [CanvasRenderingContext2D, string, number][] = [
      [context, '#2d1b0e', 1.18],
      [context, '#7d9bb0', 1],
      [rough, '#4a4a4a', 1.1],
      [rough, '#101010', 0.95],
    ]
    for (const [ctx, fill, grow] of layers) {
      ctx.fillStyle = fill
      ctx.beginPath()
      ctx.ellipse(x, y, rx * grow, ry * grow, angle, 0, Math.PI * 2)
      ctx.fill()
    }
    context.fillStyle = 'rgba(230,240,250,0.65)'
    context.beginPath()
    context.ellipse(x - rx * 0.25, y - ry * 0.25, rx * 0.35, ry * 0.2, angle, 0, Math.PI * 2)
    context.fill()
  }
  grain(context, size, size, random, 16)
  grain(context, size, size, random, 8, 2)
  return { map: toTexture(canvas), roughness: toTexture(roughCanvas, false) }
}

/** Alternating curb blocks with a lit center, so the rounded profile reads. */
export function curbTexture(colors: readonly [string, string]): THREE.CanvasTexture {
  const width = 32
  const height = 128
  const random = seededRandom(5)
  const [canvas, context] = makeCanvas(width, height)
  colors.forEach((color, index) => {
    context.fillStyle = color
    context.fillRect(0, (index * height) / 2, width, height / 2)
  })
  const shade = context.createLinearGradient(0, 0, width, 0)
  shade.addColorStop(0, 'rgba(0,0,0,0.28)')
  shade.addColorStop(0.5, 'rgba(255,255,255,0.12)')
  shade.addColorStop(1, 'rgba(0,0,0,0.32)')
  context.fillStyle = shade
  context.fillRect(0, 0, width, height)
  grain(context, width, height, random, 12)
  return toTexture(canvas)
}

/** Wood grain for fence rails (V along the rail). */
export function railTexture(seed: number): THREE.CanvasTexture {
  const width = 64
  const height = 256
  const random = seededRandom(seed + 43)
  const [canvas, context] = makeCanvas(width, height)
  context.fillStyle = '#a8794a'
  context.fillRect(0, 0, width, height)
  for (let i = 0; i < 36; i++) {
    const tone = random() < 0.5 ? '60,35,15' : '210,170,120'
    context.strokeStyle = `rgba(${tone},${0.15 + random() * 0.25})`
    context.lineWidth = 0.8 + random() * 1.6
    const x = random() * width
    context.beginPath()
    context.moveTo(x, 0)
    context.bezierCurveTo(
      x + 3,
      height * 0.3,
      x - 3,
      height * 0.7,
      x + (random() - 0.5) * 4,
      height,
    )
    context.stroke()
  }
  grain(context, width, height, random, 10)
  return toTexture(canvas)
}

/** A rectangle of the decoration atlas in pixels (y down). */
export interface AtlasCell {
  x: number
  y: number
  w: number
  h: number
}

export const ATLAS_SIZE = 1024
const BANNER_W = 512
const BANNER_H = 128
export const MAX_BANNERS = 8

export function bannerCell(index: number): AtlasCell {
  const slot = index % MAX_BANNERS
  return { x: (slot % 2) * BANNER_W, y: Math.floor(slot / 2) * BANNER_H, w: BANNER_W, h: BANNER_H }
}

export const ATLAS_CELLS = {
  /** Checkered start banner. */
  finish: { x: 0, y: 512, w: 1024, h: 128 },
  /** Yellow chevron sign. */
  chevron: { x: 0, y: 640, w: 256, h: 256 },
  /** Plain white swatch: geometry painted with vertex colors samples this. */
  white: { x: 512, y: 640, w: 16, h: 16 },
  /** Start-line title board. */
  title: { x: 0, y: 896, w: 1024, h: 128 },
} as const satisfies Record<string, AtlasCell>

interface BannerStyle {
  background: string
  accent: string
  text: string
}

const BANNER_STYLES: readonly BannerStyle[] = [
  { background: '#7a3b1d', accent: '#f4c15d', text: '#fff3d6' },
  { background: '#f2b632', accent: '#c1272d', text: '#3b1c0a' },
  { background: '#1f7a4d', accent: '#f7e26b', text: '#ffffff' },
  { background: '#c1272d', accent: '#ffffff', text: '#ffffff' },
  { background: '#2a6fb0', accent: '#ffd23f', text: '#ffffff' },
  { background: '#6b2d8f', accent: '#ffb3d9', text: '#ffffff' },
  { background: '#f28c28', accent: '#2d1b0e', text: '#2d1b0e' },
  { background: '#18343f', accent: '#4fd1c5', text: '#e6fffb' },
]

const BANNER_FONT = '"Arial Black", Impact, Arial, sans-serif'

function drawBanner(
  context: CanvasRenderingContext2D,
  cell: AtlasCell,
  name: string,
  style: BannerStyle,
  index: number,
): void {
  context.save()
  context.translate(cell.x, cell.y)
  context.fillStyle = style.background
  context.fillRect(0, 0, cell.w, cell.h)
  context.fillStyle = style.accent
  context.fillRect(0, 0, cell.w, 10)
  context.fillRect(0, cell.h - 10, cell.w, 10)
  // Emblem on the left: a simple badge that differs per sponsor
  context.fillStyle = style.accent
  context.beginPath()
  context.arc(70, cell.h / 2, 42, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = style.background
  context.beginPath()
  switch (index % 4) {
    case 0:
      context.ellipse(70, cell.h / 2, 22, 30, 0.6, 0, Math.PI * 2)
      break
    case 1:
      context.arc(70, cell.h / 2, 26, 0, Math.PI * 2)
      break
    case 2:
      context.moveTo(78, 28)
      context.lineTo(52, 70)
      context.lineTo(68, 70)
      context.lineTo(60, 100)
      context.lineTo(90, 56)
      context.lineTo(74, 56)
      break
    default:
      context.moveTo(70, 26)
      context.lineTo(98, 100)
      context.lineTo(42, 100)
      break
  }
  context.fill()
  context.fillStyle = style.text
  let fontSize = 54
  context.font = `bold ${fontSize}px ${BANNER_FONT}`
  context.textBaseline = 'middle'
  context.textAlign = 'left'
  while (context.measureText(name).width > cell.w - 160 && fontSize > 24) {
    fontSize -= 2
    context.font = `bold ${fontSize}px ${BANNER_FONT}`
  }
  context.fillText(name, 135, cell.h / 2 + 3)
  context.restore()
}

/**
 * One atlas for all the decoration: fence banners, the start banner and chevron sign, plus a
 * white swatch for geometry that is colored by its vertices. One texture, one draw call.
 */
export function decorAtlas(sponsors: readonly string[], seed: number): THREE.CanvasTexture {
  const [canvas, context] = makeCanvas(ATLAS_SIZE, ATLAS_SIZE)
  const random = seededRandom(seed + 77)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE)
  for (let i = 0; i < MAX_BANNERS; i++) {
    const name = sponsors[i % Math.max(sponsors.length, 1)] ?? 'Chigüiro Kart'
    const style = BANNER_STYLES[i % BANNER_STYLES.length] as BannerStyle
    drawBanner(context, bannerCell(i), name, style, i)
  }
  // Finish banner: black and white checkers
  const finish = ATLAS_CELLS.finish
  const square = 32
  for (let x = 0; x < finish.w / square; x++) {
    for (let y = 0; y < finish.h / square; y++) {
      context.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#141414'
      context.fillRect(finish.x + x * square, finish.y + y * square, square, square)
    }
  }
  // Chevron: yellow board, black arrow, black border
  const chevron = ATLAS_CELLS.chevron
  context.fillStyle = '#ffcf1f'
  context.fillRect(chevron.x, chevron.y, chevron.w, chevron.h)
  context.strokeStyle = '#111111'
  context.lineWidth = 14
  context.strokeRect(chevron.x + 7, chevron.y + 7, chevron.w - 14, chevron.h - 14)
  context.lineWidth = 34
  context.lineJoin = 'miter'
  context.lineCap = 'butt'
  for (const dy of [-48, 42]) {
    context.beginPath()
    context.moveTo(chevron.x + 70, chevron.y + 128 + dy - 56)
    context.lineTo(chevron.x + 178, chevron.y + 128 + dy)
    context.lineTo(chevron.x + 70, chevron.y + 128 + dy + 56)
    context.stroke()
  }
  // Title board for the start arch
  const title = ATLAS_CELLS.title
  context.fillStyle = '#c1272d'
  context.fillRect(title.x, title.y, title.w, title.h)
  context.fillStyle = '#ffd23f'
  context.fillRect(title.x, title.y + 8, title.w, 6)
  context.fillRect(title.x, title.y + title.h - 14, title.w, 6)
  context.fillStyle = '#ffffff'
  context.font = `bold 84px ${BANNER_FONT}`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText('CHIGÜIRO KART', title.x + title.w / 2, title.y + title.h / 2 + 4)
  grain(context, ATLAS_SIZE, ATLAS_SIZE, random, 3)
  // Keep the white swatch pure after the grain
  const white = ATLAS_CELLS.white
  context.fillStyle = '#ffffff'
  context.fillRect(white.x, white.y, white.w, white.h)
  const texture = toTexture(canvas, true, false)
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
  return texture
}

/** UV rectangle (inset half a texel) of an atlas cell: [u0, v0, u1, v1], v up. */
export function cellUv(cell: AtlasCell, inset = 0.5): [number, number, number, number] {
  const e = inset / ATLAS_SIZE
  return [
    cell.x / ATLAS_SIZE + e,
    1 - (cell.y + cell.h) / ATLAS_SIZE + e,
    (cell.x + cell.w) / ATLAS_SIZE - e,
    1 - cell.y / ATLAS_SIZE - e,
  ]
}
