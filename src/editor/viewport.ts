import type { Vec2 } from '../sim/math'

/** Top-down camera over the track plane: world meters (x, z) to canvas pixels. */
export interface Viewport {
  /** World point at the canvas center. */
  centerX: number
  centerZ: number
  /** Pixels per meter. */
  scale: number
}

export const MIN_SCALE = 0.3
export const MAX_SCALE = 40
const ZOOM_STEP = 1.15
const FIT_MARGIN = 0.85

export function worldToScreen(view: Viewport, width: number, height: number, p: Vec2): Vec2 {
  return {
    x: (p.x - view.centerX) * view.scale + width / 2,
    z: (p.z - view.centerZ) * view.scale + height / 2,
  }
}

export function screenToWorld(view: Viewport, width: number, height: number, p: Vec2): Vec2 {
  return {
    x: (p.x - width / 2) / view.scale + view.centerX,
    z: (p.z - height / 2) / view.scale + view.centerZ,
  }
}

/** Pans so the world point under the pixel delta follows the pointer. */
export function panBy(view: Viewport, dxPixels: number, dzPixels: number): Viewport {
  return {
    ...view,
    centerX: view.centerX - dxPixels / view.scale,
    centerZ: view.centerZ - dzPixels / view.scale,
  }
}

/** Zooms with the wheel (`deltaY` < 0 zooms in), keeping the world point under the cursor fixed. */
export function zoomAt(
  view: Viewport,
  width: number,
  height: number,
  cursor: Vec2,
  deltaY: number,
): Viewport {
  const factor = deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
  const scale = Math.min(Math.max(view.scale * factor, MIN_SCALE), MAX_SCALE)
  const before = screenToWorld(view, width, height, cursor)
  const next = { ...view, scale }
  const after = screenToWorld(next, width, height, cursor)
  return {
    ...next,
    centerX: view.centerX + before.x - after.x,
    centerZ: view.centerZ + before.z - after.z,
  }
}

/** View that frames all `points` inside a canvas of the given size. */
export function fitView(points: readonly Vec2[], width: number, height: number): Viewport {
  if (points.length === 0) return { centerX: 0, centerZ: 0, scale: 2 }
  const xs = points.map((p) => p.x)
  const zs = points.map((p) => p.z)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const spanX = Math.max(maxX - minX, 1)
  const spanZ = Math.max(maxZ - minZ, 1)
  const scale = Math.min(
    Math.max(Math.min((width * FIT_MARGIN) / spanX, (height * FIT_MARGIN) / spanZ), MIN_SCALE),
    MAX_SCALE,
  )
  return { centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2, scale }
}

/** Grid spacing in meters, the smallest "nice" step that is at least `minPixels` wide. */
export function gridStep(scale: number, minPixels = 36): number {
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
  return steps.find((s) => s * scale >= minPixels) ?? 1000
}
