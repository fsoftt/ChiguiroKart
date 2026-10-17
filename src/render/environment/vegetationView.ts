import * as THREE from 'three'
import type { PlantModel, VegetationSettings } from '../../config/tracks/environment'
import { PLANT_GEOMETRIES } from './plantModels'
import type { Plant, VegetationLayer, VegetationLayout } from './vegetationLayout'
import { createWindMaterial, type WindOptions } from './windMaterial'

interface ModelStyle {
  wind: WindOptions
  cast: boolean
  /** Color of the instance at shade 0 and at shade 1 (multiplies the vertex colors). */
  dark: readonly [number, number, number]
  bright: readonly [number, number, number]
}

type Tone = readonly [number, number, number]

const GREEN_DARK: Tone = [0.72, 0.9, 0.8]
const GREEN_BRIGHT: Tone = [1.25, 1.12, 0.72]
const NEUTRAL_DARK: Tone = [0.85, 0.85, 0.85]
const NEUTRAL_BRIGHT: Tone = [1.12, 1.1, 1.05]

const still: WindOptions = { strength: 0, power: 1 }

/** How each model sways, casts shadow and varies in color. Rigid things get no wind. */
const STYLES: Record<PlantModel, ModelStyle> = {
  grass: {
    wind: { strength: 0.22, power: 1, side: THREE.DoubleSide },
    cast: false,
    dark: [0.7, 0.92, 0.8],
    bright: [1.3, 1.18, 0.7],
  },
  dryGrass: {
    wind: { strength: 0.25, power: 1, side: THREE.DoubleSide },
    cast: false,
    dark: [0.8, 0.82, 0.8],
    bright: [1.2, 1.12, 0.95],
  },
  snowGrass: {
    wind: { strength: 0.18, power: 1, side: THREE.DoubleSide },
    cast: false,
    dark: [0.85, 0.9, 0.95],
    bright: [1.1, 1.1, 1.1],
  },
  flowers: {
    wind: { strength: 0.2, power: 1, side: THREE.DoubleSide },
    cast: false,
    dark: [1, 1, 1],
    bright: [1, 1, 1],
  },
  bush: {
    wind: { strength: 0.04, power: 1.3 },
    cast: true,
    dark: [0.75, 0.92, 0.85],
    bright: [1.2, 1.12, 0.78],
  },
  dryBush: {
    wind: { strength: 0.03, power: 1.3 },
    cast: true,
    dark: [0.8, 0.82, 0.8],
    bright: [1.2, 1.12, 0.9],
  },
  frailejon: {
    wind: { strength: 0.03, power: 1, side: THREE.DoubleSide },
    cast: true,
    dark: [0.85, 0.9, 0.9],
    bright: [1.15, 1.12, 1.05],
  },
  fern: {
    wind: { strength: 0.12, power: 1.2, side: THREE.DoubleSide },
    cast: false,
    dark: [0.75, 0.95, 0.85],
    bright: [1.15, 1.15, 0.8],
  },
  macarenia: {
    wind: { strength: 0.22, power: 1, side: THREE.DoubleSide },
    cast: false,
    dark: [0.85, 0.85, 0.9],
    bright: [1.15, 1.1, 1.05],
  },
  agave: {
    wind: { strength: 0.02, power: 1, side: THREE.DoubleSide },
    cast: true,
    dark: [0.85, 0.9, 0.9],
    bright: [1.1, 1.1, 1.05],
  },
  waxPalm: {
    wind: { strength: 0.0007, power: 2, side: THREE.DoubleSide },
    cast: true,
    dark: [0.85, 0.95, 0.9],
    bright: [1.15, 1.1, 0.85],
  },
  coconutPalm: {
    wind: { strength: 0.0009, power: 2, side: THREE.DoubleSide },
    cast: true,
    dark: [0.85, 0.95, 0.9],
    bright: [1.15, 1.1, 0.88],
  },
  moriche: {
    wind: { strength: 0.0007, power: 2, side: THREE.DoubleSide },
    cast: true,
    dark: [0.85, 0.95, 0.9],
    bright: [1.15, 1.1, 0.88],
  },
  cardon: { wind: still, cast: true, dark: [0.88, 0.92, 0.9], bright: [1.1, 1.08, 1.0] },
  ceiba: {
    wind: { strength: 0.0012, power: 1.5 },
    cast: true,
    dark: GREEN_DARK,
    bright: [1.15, 1.08, 0.8],
  },
  broadleaf: {
    wind: { strength: 0.006, power: 1.5 },
    cast: true,
    dark: GREEN_DARK,
    bright: GREEN_BRIGHT,
  },
  jungle: {
    wind: { strength: 0.005, power: 1.5, side: THREE.DoubleSide },
    cast: true,
    dark: [0.7, 0.88, 0.8],
    bright: [1.15, 1.1, 0.8],
  },
  saman: {
    wind: { strength: 0.005, power: 1.5 },
    cast: true,
    dark: GREEN_DARK,
    bright: GREEN_BRIGHT,
  },
  dryTree: {
    wind: { strength: 0.003, power: 1.5 },
    cast: true,
    dark: NEUTRAL_DARK,
    bright: NEUTRAL_BRIGHT,
  },
  eucalyptus: {
    wind: { strength: 0.004, power: 1.6, side: THREE.DoubleSide },
    cast: true,
    dark: [0.8, 0.9, 0.85],
    bright: [1.1, 1.1, 1.0],
  },
  cypress: {
    wind: { strength: 0.004, power: 1.6 },
    cast: true,
    dark: [0.8, 0.95, 0.9],
    bright: [1.05, 1.1, 0.95],
  },
  snowPine: {
    wind: { strength: 0.004, power: 1.6 },
    cast: true,
    dark: [0.85, 0.95, 0.95],
    bright: [1.05, 1.08, 1.0],
  },
  saltCrystal: { wind: still, cast: true, dark: [0.92, 0.92, 0.95], bright: [1.08, 1.06, 1.05] },
  rockSpire: { wind: still, cast: true, dark: [0.85, 0.85, 0.85], bright: [1.12, 1.08, 1.02] },
  distantTree: {
    wind: still,
    cast: false,
    dark: [0.8, 0.95, 0.95],
    bright: [1.1, 1.1, 0.95],
  },
  distantPalm: { wind: still, cast: false, dark: [0.8, 0.95, 0.95], bright: [1.1, 1.1, 0.95] },
  distantRock: { wind: still, cast: false, dark: [0.85, 0.85, 0.85], bright: [1.1, 1.08, 1.0] },
}

/** Cocora's models: what a layer draws unless the theme's `models` says otherwise. */
export const DEFAULT_MODELS: Record<VegetationLayer, PlantModel> = {
  grass: 'grass',
  flowers: 'flowers',
  bushes: 'bush',
  ferns: 'fern',
  palms: 'waxPalm',
  trees: 'broadleaf',
  cypress: 'cypress',
  distant: 'distantTree',
}

/**
 * Every plant layer as one instanced mesh with wind: a handful of draw calls for thousands of
 * plants. Each layer draws `settings.models[layer]` (Cocora's model by default). Flowers take their
 * petal color from `flowerColors` by the plant's shade.
 */
export function createVegetation(
  layout: VegetationLayout,
  settings: VegetationSettings,
): THREE.Group {
  const group = new THREE.Group()
  group.name = 'vegetation'
  const matrix = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const scale = new THREE.Vector3()
  const rotation = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const color = new THREE.Color()
  const petals = settings.flowerColors.map((c) => new THREE.Color(c))

  // One geometry per model, shared if two layers draw the same one
  const geometries = new Map<PlantModel, THREE.BufferGeometry>()

  for (const layer of Object.keys(DEFAULT_MODELS) as VegetationLayer[]) {
    const plants: readonly Plant[] = layout[layer]
    if (plants.length === 0) continue
    const model = settings.models?.[layer] ?? DEFAULT_MODELS[layer]
    const style = STYLES[model]
    let geometry = geometries.get(model)
    if (!geometry) {
      geometry = PLANT_GEOMETRIES[model]()
      geometries.set(model, geometry)
    }
    const mesh = new THREE.InstancedMesh(geometry, createWindMaterial(style.wind), plants.length)
    mesh.name = `plants:${layer}`
    mesh.castShadow = style.cast
    mesh.receiveShadow = true
    plants.forEach((plant, i) => {
      position.set(plant.x, plant.y, plant.z)
      rotation.setFromAxisAngle(up, plant.yaw)
      scale.setScalar(plant.scale)
      mesh.setMatrixAt(i, matrix.compose(position, rotation, scale))
      if (model === 'flowers' && petals.length > 0) {
        color.copy(
          petals[
            Math.min(petals.length - 1, Math.floor(plant.shade * petals.length))
          ] as THREE.Color,
        )
      } else {
        const t = plant.shade
        color.setRGB(
          style.dark[0] + (style.bright[0] - style.dark[0]) * t,
          style.dark[1] + (style.bright[1] - style.dark[1]) * t,
          style.dark[2] + (style.bright[2] - style.dark[2]) * t,
        )
      }
      mesh.setColorAt(i, color)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    group.add(mesh)
  }
  return group
}
