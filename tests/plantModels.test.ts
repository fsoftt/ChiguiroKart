import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { PlantModel, VegetationLayerName } from '../src/config/tracks/environment'
import { PLANT_GEOMETRIES, PLANT_LAYER } from '../src/render/environment/plantModels'

/** Most triangles a model of each layer may use (grass is instanced by thousands). */
const BUDGET: Record<VegetationLayerName, number> = {
  grass: 90,
  flowers: 120,
  bushes: 260,
  ferns: 200,
  palms: 450,
  trees: 450,
  cypress: 450,
  distant: 40,
}

const models = Object.keys(PLANT_GEOMETRIES) as PlantModel[]

describe('plant models', () => {
  it('has a geometry and a home layer for every model', () => {
    expect(models.length).toBe(27)
    for (const model of models) expect(PLANT_LAYER[model]).toBeDefined()
  })

  for (const model of models) {
    it(`${model} builds a sane low-poly mesh standing on the ground`, () => {
      const geometry = PLANT_GEOMETRIES[model]()
      const position = geometry.getAttribute('position')
      expect(position.count).toBeGreaterThan(0)
      expect(position.count % 3).toBe(0)
      expect(geometry.getAttribute('color').count).toBe(position.count)
      expect(geometry.getAttribute('tint').count).toBe(position.count)
      expect(position.count / 3).toBeLessThanOrEqual(BUDGET[PLANT_LAYER[model]])

      geometry.computeBoundingBox()
      const box = geometry.boundingBox as THREE.Box3
      for (const v of [box.min, box.max]) {
        expect(Number.isFinite(v.x + v.y + v.z)).toBe(true)
      }
      expect(box.min.y).toBeGreaterThanOrEqual(-0.5)
      expect(box.min.y).toBeLessThanOrEqual(0.5)
      expect(box.max.y).toBeGreaterThan(0.2)
    })
  }
})
