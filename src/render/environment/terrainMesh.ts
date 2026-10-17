import * as THREE from 'three'
import type { TerrainSettings } from '../../config/tracks/environment'
import { fbm, smoothstep } from './noise'
import { grassDetailTexture } from './proceduralTextures'
import type { TerrainField } from './terrainField'

/** Meters one repeat of the grass detail texture covers. */
const DETAIL_TILE = 14

/**
 * Per-vertex colors of the land: light and dark grass in broad patches, sun-dried grass, dirt
 * patches, rock on steep slopes and a darker, greener rim along the road.
 */
export function terrainColors(
  field: TerrainField,
  settings: TerrainSettings,
  seed: number,
): Float32Array {
  const { nx, nz, cell, heights, edges, minX, minZ } = field
  const palette = settings.palette
  const light = new THREE.Color(palette.grassLight)
  const dark = new THREE.Color(palette.grassDark)
  const dry = new THREE.Color(palette.grassDry)
  const dirt = new THREE.Color(palette.dirt)
  const rock = new THREE.Color(palette.rock)
  const rim = new THREE.Color(palette.grassDark).multiplyScalar(0.82)
  const colors = new Float32Array(nx * nz * 3)
  const color = new THREE.Color()
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      const x = minX + i * cell
      const z = minZ + j * cell
      const hx =
        ((heights[j * nx + Math.min(i + 1, nx - 1)] as number) -
          (heights[j * nx + Math.max(i - 1, 0)] as number)) /
        (2 * cell)
      const hz =
        ((heights[Math.min(j + 1, nz - 1) * nx + i] as number) -
          (heights[Math.max(j - 1, 0) * nx + i] as number)) /
        (2 * cell)
      const slope = Math.hypot(hx, hz)
      const broad = fbm(x / 55, z / 55, seed + 3, 2)
      const fine = fbm(x / 24, z / 24, seed + 4, 2)
      color.copy(dark).lerp(light, smoothstep(0.35, 0.65, broad * 0.8 + fine * 0.3))
      // Dry grass on high, sunny patches
      color.lerp(dry, smoothstep(0.58, 0.82, fbm(x / 55 + 40, z / 55, seed + 6, 3)) * 0.75)
      // Dirt patches, never right at the fence
      const dirtPatch = smoothstep(0.64, 0.74, fbm(x / 21 - 9, z / 21 + 3, seed + 8, 3))
      color.lerp(dirt, dirtPatch * smoothstep(8, 16, edges[k] as number) * 0.9)
      // Rock on steep ground
      color.lerp(rock, smoothstep(0.55, 0.95, slope + (fine - 0.5) * 0.25) * 0.95)
      // Road rim: greener and darker where the verge meets the fence
      color.lerp(rim, (1 - smoothstep(0, 10, edges[k] as number)) * 0.5)
      colors[k * 3] = color.r
      colors[k * 3 + 1] = color.g
      colors[k * 3 + 2] = color.b
    }
  }
  return colors
}

/** The land as one indexed mesh with vertex colors and a grass detail texture. */
export function createTerrainMesh(
  field: TerrainField,
  settings: TerrainSettings,
  seed: number,
): THREE.Mesh {
  const { nx, nz, cell, heights, minX, minZ } = field
  const positions = new Float32Array(nx * nz * 3)
  const uvs = new Float32Array(nx * nz * 2)
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      const x = minX + i * cell
      const z = minZ + j * cell
      positions[k * 3] = x
      positions[k * 3 + 1] = heights[k] as number
      positions[k * 3 + 2] = z
      uvs[k * 2] = x / DETAIL_TILE
      uvs[k * 2 + 1] = z / DETAIL_TILE
    }
  }
  const indices = new Uint32Array((nx - 1) * (nz - 1) * 6)
  let t = 0
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i
      const b = a + 1
      const c = a + nx
      const d = c + 1
      // Triangles (a, c, b) and (b, c, d): the same split `TerrainField.heightAt` samples
      indices.set([a, c, b, b, c, d], t)
      t += 6
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.BufferAttribute(terrainColors(field, settings, seed), 3))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  geometry.computeVertexNormals()
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: grassDetailTexture(seed),
    roughness: 0.95,
    metalness: 0,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'terrain'
  mesh.receiveShadow = true
  return mesh
}
