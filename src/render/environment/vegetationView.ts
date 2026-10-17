import * as THREE from 'three'
import type { Plant, VegetationLayer, VegetationLayout } from './vegetationLayout'
import {
  broadleafTreeGeometry,
  bushGeometry,
  cypressGeometry,
  distantTreeGeometry,
  fernGeometry,
  flowerGeometry,
  grassTuftGeometry,
  waxPalmGeometry,
} from './vegetationModels'
import { createWindMaterial, type WindOptions } from './windMaterial'

interface LayerStyle {
  geometry: () => THREE.BufferGeometry
  wind: WindOptions
  cast: boolean
  /** Color of the instance at shade 0 and at shade 1 (multiplies the vertex colors). */
  dark: readonly [number, number, number]
  bright: readonly [number, number, number]
}

const STYLES: Record<VegetationLayer, LayerStyle> = {
  grass: {
    geometry: grassTuftGeometry,
    wind: { strength: 0.22, power: 1, side: THREE.DoubleSide },
    cast: false,
    dark: [0.7, 0.92, 0.8],
    bright: [1.3, 1.18, 0.7],
  },
  flowers: {
    geometry: flowerGeometry,
    wind: { strength: 0.2, power: 1, side: THREE.DoubleSide },
    cast: false,
    dark: [1, 1, 1],
    bright: [1, 1, 1],
  },
  bushes: {
    geometry: bushGeometry,
    wind: { strength: 0.04, power: 1.3 },
    cast: true,
    dark: [0.75, 0.92, 0.85],
    bright: [1.2, 1.12, 0.78],
  },
  ferns: {
    geometry: fernGeometry,
    wind: { strength: 0.12, power: 1.2, side: THREE.DoubleSide },
    cast: false,
    dark: [0.75, 0.95, 0.85],
    bright: [1.15, 1.15, 0.8],
  },
  palms: {
    geometry: waxPalmGeometry,
    wind: { strength: 0.0007, power: 2, side: THREE.DoubleSide },
    cast: true,
    dark: [0.85, 0.95, 0.9],
    bright: [1.15, 1.1, 0.85],
  },
  trees: {
    geometry: broadleafTreeGeometry,
    wind: { strength: 0.006, power: 1.5 },
    cast: true,
    dark: [0.72, 0.9, 0.8],
    bright: [1.25, 1.12, 0.72],
  },
  cypress: {
    geometry: cypressGeometry,
    wind: { strength: 0.004, power: 1.6 },
    cast: true,
    dark: [0.8, 0.95, 0.9],
    bright: [1.05, 1.1, 0.95],
  },
  distant: {
    geometry: distantTreeGeometry,
    wind: { strength: 0, power: 1 },
    cast: false,
    dark: [0.8, 0.95, 0.95],
    bright: [1.1, 1.1, 0.95],
  },
}

/**
 * Every plant layer as one instanced mesh with wind: a handful of draw calls for thousands of
 * plants. Flowers take their petal color from `flowerColors` by the plant's shade.
 */
export function createVegetation(
  layout: VegetationLayout,
  flowerColors: readonly string[],
): THREE.Group {
  const group = new THREE.Group()
  group.name = 'vegetation'
  const matrix = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const scale = new THREE.Vector3()
  const rotation = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const color = new THREE.Color()
  const petals = flowerColors.map((c) => new THREE.Color(c))

  for (const layer of Object.keys(STYLES) as VegetationLayer[]) {
    const plants: readonly Plant[] = layout[layer]
    if (plants.length === 0) continue
    const style = STYLES[layer]
    const mesh = new THREE.InstancedMesh(
      style.geometry(),
      createWindMaterial(style.wind),
      plants.length,
    )
    mesh.name = `plants:${layer}`
    mesh.castShadow = style.cast
    mesh.receiveShadow = true
    plants.forEach((plant, i) => {
      position.set(plant.x, plant.y, plant.z)
      rotation.setFromAxisAngle(up, plant.yaw)
      scale.setScalar(plant.scale)
      mesh.setMatrixAt(i, matrix.compose(position, rotation, scale))
      if (layer === 'flowers' && petals.length > 0) {
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
