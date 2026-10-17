import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Placement } from '../characters/modelKit'

/**
 * How a scenery part is drawn:
 * - `solid`: toon shaded.
 * - `glass`: toon shaded and see-through (steam, ice).
 * - `glow`: toon shaded plus a soft emissive tint (pastel crystals).
 * - `bright`: unlit and brighter than white, so the bloom picks it up (lava, lamps).
 */
export type SceneryLayer = 'solid' | 'glass' | 'glow' | 'bright'

/** One draw call worth of scenery: all the pieces of a layer merged into a geometry. */
export interface SceneryPart {
  layer: SceneryLayer
  geometry: THREE.BufferGeometry
}

/**
 * Builds a low-poly prop from primitives painted with flat vertex colors. Pieces are merged
 * per layer, so a prop costs one draw call per layer once instanced. Boxes, cylinders and
 * cones sit on y = 0 (their base), balls are centered on their position.
 */
export class SceneryKit {
  private readonly layers = new Map<SceneryLayer, THREE.BufferGeometry[]>()

  /** Adds any geometry (already in prop space). `boost` scales the color past 1. */
  add(
    layer: SceneryLayer,
    geometry: THREE.BufferGeometry,
    color: string,
    at: Placement = {},
    boost = 1,
  ): this {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    g.deleteAttribute('uv')
    g.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(...(at.position ?? [0, 0, 0])),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...(at.rotation ?? [0, 0, 0]))),
        typeof at.scale === 'number'
          ? new THREE.Vector3(at.scale, at.scale, at.scale)
          : new THREE.Vector3(...(at.scale ?? [1, 1, 1])),
      ),
    )
    const count = g.getAttribute('position').count
    const rgb = new THREE.Color(color)
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) colors.set([rgb.r * boost, rgb.g * boost, rgb.b * boost], i * 3)
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const list = this.layers.get(layer) ?? []
    list.push(g)
    this.layers.set(layer, list)
    return this
  }

  box(
    color: string,
    width: number,
    height: number,
    depth: number,
    at: Placement = {},
    layer: SceneryLayer = 'solid',
  ): this {
    const g = new THREE.BoxGeometry(width, height, depth)
    g.translate(0, height / 2, 0)
    return this.add(layer, g, color, at)
  }

  cylinder(
    color: string,
    radiusTop: number,
    radiusBottom: number,
    height: number,
    at: Placement = {},
    segments = 6,
    layer: SceneryLayer = 'solid',
  ): this {
    const g = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments)
    g.translate(0, height / 2, 0)
    return this.add(layer, g, color, at)
  }

  cone(
    color: string,
    radius: number,
    height: number,
    at: Placement = {},
    segments = 7,
    layer: SceneryLayer = 'solid',
  ): this {
    const g = new THREE.ConeGeometry(radius, height, segments)
    g.translate(0, height / 2, 0)
    return this.add(layer, g, color, at)
  }

  /** Low-poly ball (icosahedron); `detail` 0 is a faceted gem, 1 a rounded lump. */
  ball(
    color: string,
    radius: number,
    at: Placement = {},
    layer: SceneryLayer = 'solid',
    detail = 1,
  ): this {
    return this.add(layer, new THREE.IcosahedronGeometry(radius, detail), color, at)
  }

  /** The merged geometry of each layer that has pieces. */
  build(): SceneryPart[] {
    const parts: SceneryPart[] = []
    for (const [layer, list] of this.layers) {
      const geometry = mergeGeometries(list, false)
      for (const g of list) g.dispose()
      parts.push({ layer, geometry })
    }
    return parts
  }
}

const materials = new Map<SceneryLayer, THREE.Material>()

/** Shared material of a layer. */
export function sceneryMaterial(layer: SceneryLayer): THREE.Material {
  let material = materials.get(layer)
  if (material) return material
  switch (layer) {
    case 'solid':
      material = new THREE.MeshToonMaterial({ vertexColors: true })
      break
    case 'glass':
      material = new THREE.MeshToonMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      })
      break
    case 'glow':
      material = new THREE.MeshToonMaterial({
        vertexColors: true,
        emissive: '#ffffff',
        emissiveIntensity: 0.45,
      })
      break
    case 'bright':
      material = new THREE.MeshBasicMaterial({ vertexColors: true })
      break
  }
  materials.set(layer, material)
  return material
}
