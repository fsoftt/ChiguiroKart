import * as THREE from 'three'
import type { ResolvedMountains } from '../config/tracks/lighting'

const SEGMENTS = 96
/** Share of a layer's height that sinks below its base, hidden in the fog. */
const SKIRT = 0.7
/** How far below the camera the ring's base sits, so the peaks rise from beyond the ground. */
const BASE_DROP = 15

interface Layer {
  /** Ring radius as a share of the draw distance. */
  radius: number
  height: number
  /** How much of the fog color the silhouette keeps (1 = vanishes into the fog). */
  haze: number
  seed: number
}

const LAYERS: readonly Layer[] = [
  { radius: 0.97, height: 1, haze: 0.4, seed: 1.7 },
  { radius: 0.88, height: 0.55, haze: 0.15, seed: 4.3 },
]

/** Deterministic skyline: a few sines, folded into sharp ridges by `jagged`. */
function skyline(angle: number, seed: number, jagged: number): number {
  let sum = 0
  let total = 0
  for (let octave = 0; octave < 4; octave++) {
    const frequency = 2 + octave * 3 + (octave % 2) * 1
    const weight = 1 / (1 + octave * 0.9)
    const wave = Math.sin(angle * frequency + seed * (octave + 1.3) + octave * 2.1)
    const ridge = 1 - Math.abs(wave)
    sum += weight * (wave * 0.5 + 0.5) * (1 - jagged) + weight * ridge * jagged
    total += weight
  }
  return sum / total
}

/**
 * Low-poly ring of hills or mountains around the horizon: two layers with vertex colors that
 * fade into the fog color at the base. It follows the camera (like the sky), so it never gets
 * closer and the horizon is never an empty plane.
 */
export class MountainRing extends THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> {
  constructor() {
    super(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        fog: false,
      }),
    )
    this.name = 'mountains'
    this.frustumCulled = false
    this.visible = false
    this.onBeforeRender = (_renderer, _scene, camera) => {
      this.position.set(camera.position.x, camera.position.y - BASE_DROP, camera.position.z)
    }
  }

  /** Rebuilds the silhouettes; `null` hides the ring. `radius` is the draw distance in meters. */
  setLook(look: ResolvedMountains | null, fogColor: string, radius: number): void {
    this.visible = look !== null
    if (!look) return
    const fog = new THREE.Color(fogColor)
    const positions: number[] = []
    const colors: number[] = []
    const indices: number[] = []
    const top = new THREE.Color()
    for (const layer of LAYERS) {
      const first = positions.length / 3
      top.set(look.color).lerp(fog, layer.haze)
      const ringRadius = radius * layer.radius
      const height = look.height * layer.height
      for (let i = 0; i <= SEGMENTS; i++) {
        const angle = (i / SEGMENTS) * Math.PI * 2
        const peak = height * (0.3 + 0.7 * skyline(angle, layer.seed, look.jagged))
        const x = Math.cos(angle) * ringRadius
        const z = Math.sin(angle) * ringRadius
        positions.push(x, peak, z, x, -height * SKIRT, z)
        colors.push(top.r, top.g, top.b, fog.r, fog.g, fog.b)
      }
      for (let i = 0; i < SEGMENTS; i++) {
        const a = first + i * 2
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setIndex(indices)
    this.geometry.dispose()
    this.geometry = geometry
  }
}
