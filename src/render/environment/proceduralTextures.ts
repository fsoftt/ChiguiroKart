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

/** Meters of road one cobble, dirt, ice, sand, water or grass tile covers along the road. */
export const COBBLE_TILE = 18
export const DIRT_TILE = 16
export const ICE_TILE = 20
export const SAND_TILE = 16
export const WATER_TILE = 14
export const GRASS_TILE = 18

type Rgb = readonly [number, number, number]

/** Parses '#rrggbb' (or '#rgb'); anything unreadable falls back to mid gray. */
export function parseHex(hex: string): Rgb {
  const clean = hex.trim().replace('#', '')
  const full =
    clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean.length === 6 ? clean : ''
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [128, 128, 128]
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Blends `a` toward `b` (t 0..1) and returns a CSS color; `alpha` below 1 makes it rgba. */
export function mixColors(a: string, b: string, t: number, alpha = 1): string {
  const ca = parseHex(a)
  const cb = parseHex(b)
  const channel = (i: 0 | 1 | 2): number => Math.round(ca[i] + (cb[i] - ca[i]) * t)
  const rgb = `${channel(0)},${channel(1)},${channel(2)}`
  return alpha >= 1 ? `rgb(${rgb})` : `rgba(${rgb},${alpha})`
}

/** Runs `draw` at the offsets that keep a shape of the given radius seamless across the tile. */
function wrapped(
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number,
  draw: (ox: number, oy: number) => void,
): void {
  for (const ox of [-width, 0, width]) {
    for (const oy of [-height, 0, height]) {
      if (x + ox + radius < 0 || x + ox - radius > width) continue
      if (y + oy + radius < 0 || y + oy - radius > height) continue
      draw(ox, oy)
    }
  }
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2)
  context.beginPath()
  context.moveTo(x + radius, y)
  context.arcTo(x + w, y, x + w, y + h, radius)
  context.arcTo(x + w, y + h, x, y + h, radius)
  context.arcTo(x, y + h, x, y, radius)
  context.arcTo(x, y, x + w, y, radius)
  context.closePath()
}

/** Random walk drawn at every wrap offset, so a crack can cross the tile edge. */
function wrappedWalk(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  random: Random,
  start: readonly [number, number],
  steps: number,
  stride: number,
): void {
  const points: [number, number][] = [[start[0], start[1]]]
  let angle = random() * Math.PI * 2
  for (let s = 0; s < steps; s++) {
    angle += (random() - 0.5) * 1.1
    const last = points[points.length - 1] as [number, number]
    points.push([
      last[0] + Math.cos(angle) * stride * (0.6 + random() * 0.8),
      last[1] + Math.sin(angle) * stride * (0.6 + random() * 0.8),
    ])
  }
  for (const ox of [-width, 0, width]) {
    for (const oy of [-height, 0, height]) {
      context.beginPath()
      points.forEach(([x, y], i) => {
        if (i === 0) context.moveTo(x + ox, y + oy)
        else context.lineTo(x + ox, y + oy)
      })
      context.stroke()
    }
  }
}

/**
 * Colonial cobblestone: rounded stones in staggered courses over dark mortar, each stone a
 * little different in tone, with a lit upper edge and a shaded lower one. Tinted from `baseColor`
 * (the theme's road color). No painted lines.
 */
export function cobbleTexture(baseColor: string, seed: number): THREE.CanvasTexture {
  const size = 512
  const random = seededRandom(seed + 53)
  const [canvas, context] = makeCanvas(size, size)
  context.fillStyle = mixColors(baseColor, '#000000', 0.62)
  context.fillRect(0, 0, size, size)
  const rows = 11
  const rowHeight = size / rows
  const tints = ['#ffffff', '#c9a27a', '#8d96a0', '#6d5a4a', '#d8c9b0']
  for (let r = 0; r < rows; r++) {
    const count = 7 + Math.floor(random() * 3)
    const weights = Array.from({ length: count }, () => 0.7 + random() * 0.6)
    const total = weights.reduce((a, b) => a + b, 0)
    const shift = random() * size
    let cursor = 0
    for (const weight of weights) {
      const w = (weight / total) * size
      const x = shift + cursor
      cursor += w
      const gap = 3 + random() * 2
      const sx = x + gap / 2
      const sy = r * rowHeight + gap / 2 + (random() - 0.5) * 3
      const sw = w - gap
      const sh = rowHeight - gap + (random() - 0.5) * 2
      const tone = mixColors(
        baseColor,
        tints[Math.floor(random() * tints.length)] as string,
        0.12 + random() * 0.3,
      )
      const lit = mixColors(tone, '#ffffff', 0.22)
      const dark = mixColors(tone, '#000000', 0.38)
      const corner = 12 + random() * 6
      const chips = [0, 1, 2].map(() => [0.2 + random() * 0.6, 0.2 + random() * 0.6, random()])
      wrapped(size, size, sx + sw / 2, sy + sh / 2, sw, (ox, oy) => {
        const gradient = context.createLinearGradient(
          sx + ox,
          sy + oy,
          sx + ox + sw * 0.4,
          sy + oy + sh,
        )
        gradient.addColorStop(0, lit)
        gradient.addColorStop(0.45, tone)
        gradient.addColorStop(1, dark)
        context.fillStyle = gradient
        roundedRect(context, sx + ox, sy + oy, sw, sh, corner)
        context.fill()
        context.strokeStyle = 'rgba(0,0,0,0.28)'
        context.lineWidth = 1.5
        context.stroke()
        // Chips and pits on the face of the stone
        for (const [cx, cy, k] of chips) {
          context.fillStyle = (k as number) < 0.5 ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.1)'
          context.beginPath()
          context.arc(
            sx + ox + sw * (cx as number),
            sy + oy + sh * (cy as number),
            1.5 + (k as number) * 3,
            0,
            Math.PI * 2,
          )
          context.fill()
        }
      })
    }
  }
  // Moss and dirt packed in the mortar, and a few worn patches
  for (let i = 0; i < 40; i++) {
    wrappedBlotch(
      context,
      size,
      size,
      random() * size,
      random() * size,
      20 + random() * 50,
      random() < 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,240,210,0.06)',
    )
  }
  grain(context, size, size, random, 12)
  grain(context, size, size, random, 6, 2)
  return toTexture(canvas)
}

/**
 * Packed earth trail: dusty blotches, two tire ruts with raised ridges, pebbles and a few
 * hairline cracks. Tinted from `baseColor`. No painted lines.
 */
export function dirtTexture(baseColor: string, seed: number): THREE.CanvasTexture {
  const size = 512
  const random = seededRandom(seed + 67)
  const [canvas, context] = makeCanvas(size, size)
  context.fillStyle = baseColor
  context.fillRect(0, 0, size, size)
  for (let i = 0; i < 110; i++) {
    wrappedBlotch(
      context,
      size,
      size,
      random() * size,
      random() * size,
      18 + random() * 70,
      random() < 0.5
        ? mixColors(baseColor, '#ffffff', 0.3, 0.2)
        : mixColors(baseColor, '#000000', 0.4, 0.2),
    )
  }
  // Tire ruts: wobbling dark furrows (two cycles per tile, so they tile) with lit ridges
  for (const u of [0.3, 0.7]) {
    const cx = u * size
    const wobble = (y: number): number => Math.sin((y / size) * Math.PI * 4 + u * 9) * 7
    const bands: readonly [number, number, string][] = [
      [0, 26, mixColors(baseColor, '#000000', 0.45, 0.35)],
      [0, 12, mixColors(baseColor, '#000000', 0.55, 0.4)],
      [-34, 6, mixColors(baseColor, '#ffffff', 0.35, 0.28)],
      [34, 6, mixColors(baseColor, '#ffffff', 0.35, 0.28)],
    ]
    for (const [dx, half, color] of bands) {
      context.fillStyle = color
      context.beginPath()
      for (let y = 0; y <= size; y += 8) context.lineTo(cx + dx + wobble(y) - half, y)
      for (let y = size; y >= 0; y -= 8) context.lineTo(cx + dx + wobble(y) + half, y)
      context.closePath()
      context.fill()
    }
    // Tread marks inside the rut
    context.lineWidth = 1
    for (let y = 0; y < size; y += 14) {
      context.strokeStyle = mixColors(baseColor, '#000000', 0.6, 0.28)
      context.beginPath()
      context.moveTo(cx + wobble(y) - 14, y)
      context.lineTo(cx + wobble(y) + 14, y + 6)
      context.stroke()
    }
  }
  // Pebbles with a small shadow
  for (let i = 0; i < 160; i++) {
    const x = random() * size
    const y = random() * size
    const r = 1.5 + random() * random() * 6
    const tone = mixColors(baseColor, random() < 0.5 ? '#ffffff' : '#3a2a1c', 0.3 + random() * 0.4)
    wrapped(size, size, x, y, r + 2, (ox, oy) => {
      context.fillStyle = 'rgba(0,0,0,0.3)'
      context.beginPath()
      context.ellipse(x + ox + 1.2, y + oy + 1.2, r, r * 0.75, 0, 0, Math.PI * 2)
      context.fill()
      context.fillStyle = tone
      context.beginPath()
      context.ellipse(x + ox, y + oy, r, r * 0.75, 0.4, 0, Math.PI * 2)
      context.fill()
    })
  }
  context.lineCap = 'round'
  context.lineWidth = 1
  for (let i = 0; i < 10; i++) {
    context.strokeStyle = mixColors(baseColor, '#000000', 0.65, 0.4)
    wrappedWalk(context, size, size, random, [random() * size, random() * size], 7, 12)
  }
  grain(context, size, size, random, 14)
  grain(context, size, size, random, 7, 2)
  return toTexture(canvas)
}

/**
 * Glossy ice: pale facets, deep blue veins, cracks and frost along the edges. The roughness map
 * keeps the surface shiny except at the cracks and frost.
 */
export function iceTexture(
  baseColor: string,
  seed: number,
): {
  map: THREE.CanvasTexture
  roughness: THREE.CanvasTexture
} {
  const size = 512
  const random = seededRandom(seed + 83)
  const [canvas, context] = makeCanvas(size, size)
  const [roughCanvas, rough] = makeCanvas(size, size)
  context.fillStyle = baseColor
  context.fillRect(0, 0, size, size)
  rough.fillStyle = '#1c1c1c'
  rough.fillRect(0, 0, size, size)
  for (let i = 0; i < 70; i++) {
    wrappedBlotch(
      context,
      size,
      size,
      random() * size,
      random() * size,
      30 + random() * 90,
      random() < 0.5
        ? mixColors(baseColor, '#ffffff', 0.7, 0.35)
        : mixColors(baseColor, '#1c63b8', 0.5, 0.3),
    )
  }
  // Slabs of ice: faint polygons a shade off
  for (let i = 0; i < 14; i++) {
    const cx = random() * size
    const cy = random() * size
    const sides = 5 + Math.floor(random() * 3)
    const radius = 50 + random() * 70
    const offsets = Array.from({ length: sides }, () => 0.7 + random() * 0.5)
    const fill = random() < 0.5 ? 'rgba(255,255,255,0.1)' : 'rgba(40,110,190,0.1)'
    wrapped(size, size, cx, cy, radius * 1.2, (ox, oy) => {
      context.beginPath()
      offsets.forEach((k, s) => {
        const a = (s / sides) * Math.PI * 2
        const px = cx + ox + Math.cos(a) * radius * k
        const py = cy + oy + Math.sin(a) * radius * k
        if (s === 0) context.moveTo(px, py)
        else context.lineTo(px, py)
      })
      context.closePath()
      context.fillStyle = fill
      context.fill()
      context.strokeStyle = 'rgba(255,255,255,0.22)'
      context.lineWidth = 1.5
      context.stroke()
    })
  }
  // Cracks: a white core over a blue halo, rough in the roughness map
  context.lineCap = 'round'
  context.lineJoin = 'round'
  rough.lineCap = 'round'
  for (let i = 0; i < 12; i++) {
    const start: [number, number] = [random() * size, random() * size]
    const steps = 6 + Math.floor(random() * 8)
    const state = Math.floor(random() * 1e9)
    const passes: readonly [CanvasRenderingContext2D, string, number][] = [
      [context, 'rgba(20,80,160,0.35)', 4],
      [context, 'rgba(255,255,255,0.8)', 1.2],
      [rough, 'rgba(255,255,255,0.8)', 5],
    ]
    for (const [ctx, color, lw] of passes) {
      ctx.strokeStyle = color
      ctx.lineWidth = lw
      wrappedWalk(ctx, size, size, seededRandom(state), start, steps, 22)
    }
  }
  // Frost: soft white drifts toward both road edges plus sparkling flakes
  for (const edge of [0, size]) {
    for (let i = 0; i < 22; i++) {
      const y = random() * size
      const x = edge + (random() - 0.5) * 70
      const radius = 24 + random() * 36
      for (const [ctx, rgb, alpha] of [
        [context, '255,255,255', 0.4],
        [rough, '200,200,200', 0.7],
      ] as const) {
        wrapped(size, size, x, y, radius, (ox, oy) => {
          // Fade to the same color at zero alpha, so no dark fringe appears
          const gradient = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, radius)
          gradient.addColorStop(0, `rgba(${rgb},${alpha})`)
          gradient.addColorStop(1, `rgba(${rgb},0)`)
          ctx.fillStyle = gradient
          ctx.fillRect(x + ox - radius, y + oy - radius, radius * 2, radius * 2)
        })
      }
    }
  }
  for (let i = 0; i < 220; i++) {
    const x = random() * size
    const y = random() * size
    context.fillStyle = `rgba(255,255,255,${0.4 + random() * 0.5})`
    context.fillRect(x, y, 1 + random() * 2, 1 + random() * 2)
  }
  grain(context, size, size, random, 6)
  return { map: toTexture(canvas), roughness: toTexture(roughCanvas, false) }
}

/** Beach sand: soft dunes, wind ripples, damp patches, pebbles and tiny shells. */
export function sandTexture(baseColor: string, seed: number): THREE.CanvasTexture {
  const size = 512
  const random = seededRandom(seed + 97)
  const [canvas, context] = makeCanvas(size, size)
  context.fillStyle = baseColor
  context.fillRect(0, 0, size, size)
  for (let i = 0; i < 90; i++) {
    wrappedBlotch(
      context,
      size,
      size,
      random() * size,
      random() * size,
      25 + random() * 80,
      random() < 0.5
        ? mixColors(baseColor, '#ffffff', 0.5, 0.2)
        : mixColors(baseColor, '#8a6a3a', 0.5, 0.18),
    )
  }
  // Damp darker patches
  for (let i = 0; i < 8; i++) {
    wrappedBlotch(
      context,
      size,
      size,
      random() * size,
      random() * size,
      40 + random() * 60,
      mixColors(baseColor, '#6b4f2a', 0.6, 0.22),
    )
  }
  // Ripples: whole sine cycles across the tile so it tiles; dark trough and lit crest
  const ripples = 16
  const spacing = size / ripples
  for (let i = 0; i < ripples; i++) {
    const phase = random() * Math.PI * 2
    const cycles = 2 + Math.floor(random() * 2)
    const amplitude = 6 + random() * 8
    const y0 = i * spacing
    const strokes: readonly [number, string, number][] = [
      [0, mixColors(baseColor, '#000000', 0.3, 0.3), 2.4],
      [-3, mixColors(baseColor, '#ffffff', 0.6, 0.45), 2],
    ]
    for (const [dy, color, lw] of strokes) {
      context.strokeStyle = color
      context.lineWidth = lw
      context.beginPath()
      for (let x = 0; x <= size; x += 8) {
        const y = y0 + dy + Math.sin((x / size) * Math.PI * 2 * cycles + phase) * amplitude
        if (x === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      }
      context.stroke()
    }
  }
  // Pebbles and shells
  for (let i = 0; i < 55; i++) {
    const x = random() * size
    const y = random() * size
    const r = 1.5 + random() * 3
    const shell = random() < 0.55
    const fill = shell
      ? mixColors('#fff4e6', '#f2b6a8', random() * 0.6)
      : mixColors(baseColor, '#5a4a3a', 0.4 + random() * 0.3)
    const angle = random() * Math.PI
    wrapped(size, size, x, y, r * 2 + 3, (ox, oy) => {
      context.fillStyle = 'rgba(60,40,10,0.3)'
      context.beginPath()
      context.ellipse(x + ox + 1.2, y + oy + 1.2, r * 1.4, r, angle, 0, Math.PI * 2)
      context.fill()
      context.fillStyle = fill
      context.beginPath()
      context.ellipse(x + ox, y + oy, r * 1.4, r, angle, 0, Math.PI * 2)
      context.fill()
      if (shell) {
        context.strokeStyle = 'rgba(150,90,70,0.55)'
        context.lineWidth = 0.8
        for (let k = -1; k <= 1; k++) {
          context.beginPath()
          context.moveTo(x + ox, y + oy + r * 0.9)
          context.lineTo(x + ox + k * r * 0.9, y + oy - r * 0.6)
          context.stroke()
        }
      }
    })
  }
  grain(context, size, size, random, 16)
  grain(context, size, size, random, 8, 2)
  return toTexture(canvas)
}

/**
 * Shallow ford: blue water with stones showing through, long light streaks along the flow (V)
 * and ring ripples. It tiles, so `EnvironmentView.update` can scroll V to make the water run.
 */
export function waterTexture(baseColor: string, seed: number): THREE.CanvasTexture {
  const size = 512
  const random = seededRandom(seed + 113)
  const [canvas, context] = makeCanvas(size, size)
  context.fillStyle = baseColor
  context.fillRect(0, 0, size, size)
  for (let i = 0; i < 80; i++) {
    wrappedBlotch(
      context,
      size,
      size,
      random() * size,
      random() * size,
      30 + random() * 80,
      random() < 0.5
        ? mixColors(baseColor, '#bfeaff', 0.5, 0.22)
        : mixColors(baseColor, '#0b3a66', 0.5, 0.25),
    )
  }
  // Stones on the bed, softened by the water above them
  for (let i = 0; i < 38; i++) {
    const x = random() * size
    const y = random() * size
    const rx = 14 + random() * 26
    const ry = rx * (0.6 + random() * 0.3)
    const angle = random() * Math.PI
    const tone = mixColors(
      baseColor,
      random() < 0.5 ? '#6f7f78' : '#2a3d4a',
      0.55 + random() * 0.2,
      0.6,
    )
    wrapped(size, size, x, y, rx, (ox, oy) => {
      context.fillStyle = tone
      context.beginPath()
      context.ellipse(x + ox, y + oy, rx, ry, angle, 0, Math.PI * 2)
      context.fill()
      context.strokeStyle = 'rgba(190,235,255,0.25)'
      context.lineWidth = 2
      context.stroke()
    })
  }
  // Flow streaks along V
  context.lineCap = 'round'
  for (let i = 0; i < 46; i++) {
    const x = random() * size
    const y = random() * size
    const length = 60 + random() * 150
    const sway = (random() - 0.5) * 16
    context.strokeStyle =
      random() < 0.7
        ? `rgba(235,250,255,${0.18 + random() * 0.3})`
        : `rgba(10,50,90,${0.12 + random() * 0.18})`
    context.lineWidth = 1 + random() * 2.4
    wrapped(size, size, x, y + length / 2, length / 2 + 10, (ox, oy) => {
      context.beginPath()
      context.moveTo(x + ox, y + oy)
      context.bezierCurveTo(
        x + ox + sway,
        y + oy + length * 0.3,
        x + ox - sway,
        y + oy + length * 0.7,
        x + ox,
        y + oy + length,
      )
      context.stroke()
    })
  }
  // Ripple rings
  for (let i = 0; i < 12; i++) {
    const x = random() * size
    const y = random() * size
    const r = 10 + random() * 16
    wrapped(size, size, x, y, r * 2.2, (ox, oy) => {
      for (let k = 1; k <= 2; k++) {
        context.strokeStyle = `rgba(240,252,255,${0.4 / k})`
        context.lineWidth = 1.3
        context.beginPath()
        context.ellipse(x + ox, y + oy, r * k, r * k * 0.6, 0, 0, Math.PI * 2)
        context.stroke()
      }
    })
  }
  grain(context, size, size, random, 7)
  return toTexture(canvas)
}

/** Mowed grass track: alternating light and dark bands across the road, blades and clover. */
export function grassRoadTexture(baseColor: string, seed: number): THREE.CanvasTexture {
  const size = 512
  const random = seededRandom(seed + 131)
  const [canvas, context] = makeCanvas(size, size)
  context.fillStyle = baseColor
  context.fillRect(0, 0, size, size)
  const bands = 8
  const band = size / bands
  for (let i = 0; i < bands; i += 2) {
    context.fillStyle = mixColors(baseColor, '#000000', 0.16, 0.5)
    context.fillRect(0, i * band, size, band)
  }
  for (let i = 0; i < 100; i++) {
    wrappedBlotch(
      context,
      size,
      size,
      random() * size,
      random() * size,
      16 + random() * 50,
      random() < 0.5
        ? mixColors(baseColor, '#e8f5a0', 0.5, 0.2)
        : mixColors(baseColor, '#0c3a14', 0.5, 0.22),
    )
  }
  context.lineCap = 'round'
  context.lineWidth = 1
  for (let i = 0; i < 2600; i++) {
    const x = random() * size
    const y = random() * size
    const lean = (random() - 0.5) * 5
    const length = 3 + random() * 6
    context.strokeStyle = mixColors(
      baseColor,
      random() < 0.5 ? '#f2ffb0' : '#0a2a10',
      0.35 + random() * 0.35,
      0.5,
    )
    wrapped(size, size, x, y, 10, (ox, oy) => {
      context.beginPath()
      context.moveTo(x + ox, y + oy)
      context.lineTo(x + ox + lean, y + oy - length)
      context.stroke()
    })
  }
  for (let i = 0; i < 30; i++) {
    context.fillStyle = random() < 0.6 ? 'rgba(255,255,255,0.8)' : 'rgba(255,225,80,0.8)'
    context.beginPath()
    context.arc(random() * size, random() * size, 1 + random() * 1.4, 0, Math.PI * 2)
    context.fill()
  }
  grain(context, size, size, random, 10)
  return toTexture(canvas)
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
