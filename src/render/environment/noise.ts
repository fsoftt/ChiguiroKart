/** Deterministic value noise: the same seed and coordinates give the same number everywhere. */

function hash(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Smooth value noise in 0..1; one lattice cell per unit. */
export function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = smooth(x - ix)
  const fy = smooth(y - iy)
  const a = hash(ix, iy, seed)
  const b = hash(ix + 1, iy, seed)
  const c = hash(ix, iy + 1, seed)
  const d = hash(ix + 1, iy + 1, seed)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

/** Fractal noise in 0..1: `octaves` layers of value noise, each twice as fine and half as strong. */
export function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0
  let weight = 0.5
  let total = 0
  let frequency = 1
  for (let i = 0; i < octaves; i++) {
    sum += weight * valueNoise(x * frequency, y * frequency, seed + i * 31)
    total += weight
    weight *= 0.5
    frequency *= 2
  }
  return sum / total
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
}
