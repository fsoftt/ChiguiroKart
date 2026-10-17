import * as THREE from 'three'
import type { Track } from '../../sim/track'
import { offsetPath, overGap, pathPoint, segmentCount, sideAt, type Path } from '../trackPath'

/** One vertex of a cross-section: sideways offset from the centerline, height and U texture. */
export interface ProfilePoint {
  offset: number
  /** Height above the sim road height (m). */
  lift: number
  u: number
}

export interface RibbonOptions {
  /** Meters of road per texture repeat along V. */
  tile: number
  /** Leave out a segment (return false), e.g. to split a road by surface. */
  include?: (segment: number) => boolean
  /** Leave out segments where the path is open (junctions): curbs and fences. */
  skipOpenings?: boolean
}

/**
 * Sweeps a cross-section along a path, following the sim road height, as an indexed mesh with
 * UVs (U across, V along by arc length) and smooth normals. Returns null if no segment is left.
 */
export function buildRibbon(
  track: Track,
  path: Path,
  profile: readonly ProfilePoint[],
  options: RibbonOptions,
): THREE.BufferGeometry | null {
  const segments = segmentCount(path)
  const rows = segments + 1
  const width = profile.length
  const positions = new Float32Array(rows * width * 3)
  const uvs = new Float32Array(rows * width * 2)
  const meanOffset = profile.reduce((sum, p) => sum + p.offset, 0) / width

  let travelled = 0
  for (let n = 0; n < rows; n++) {
    const center = pathPoint(path, n)
    const side = sideAt(path, n)
    if (n > 0) {
      const before = pathPoint(path, n - 1)
      travelled += Math.hypot(center.x - before.x, center.z - before.z)
    }
    for (let k = 0; k < width; k++) {
      const p = profile[k] as ProfilePoint
      const x = center.x + side.x * p.offset
      const z = center.z + side.z * p.offset
      const base = (n * width + k) * 3
      positions[base] = x
      positions[base + 1] = track.roadHeight(x, z) + p.lift
      positions[base + 2] = z
      uvs[(n * width + k) * 2] = p.u
      uvs[(n * width + k) * 2 + 1] = travelled / options.tile
    }
  }

  const indices: number[] = []
  const middle = offsetPath(path, meanOffset)
  for (let i = 0; i < segments; i++) {
    if (options.include && !options.include(i)) continue
    if (overGap(track, path, i)) continue
    if (options.skipOpenings) {
      const a = middle[i]
      const b = middle[i + 1]
      if (a && b && path.openAt({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 })) continue
    }
    for (let k = 0; k + 1 < width; k++) {
      const a = i * width + k
      const b = (i + 1) * width + k
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  if (indices.length === 0) return null
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** Flat cross-section from `inner` to `outer` at `lift`, with `steps` quads across. */
export function flatProfile(inner: number, outer: number, lift: number, steps = 1): ProfilePoint[] {
  return Array.from({ length: steps + 1 }, (_, k) => ({
    offset: inner + ((outer - inner) * k) / steps,
    lift,
    u: k / steps,
  }))
}

/** Rounded curb: a half-round bump of `height` across the strip from `inner` to `outer`. */
export function curbProfile(inner: number, outer: number, height: number): ProfilePoint[] {
  const steps = 8
  return Array.from({ length: steps + 1 }, (_, k) => {
    const t = k / steps
    return {
      offset: inner + (outer - inner) * t,
      lift: 0.012 + height * Math.pow(Math.sin(Math.PI * t), 0.55),
      u: t,
    }
  })
}
