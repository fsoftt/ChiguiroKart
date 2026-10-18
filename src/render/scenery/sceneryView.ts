import * as THREE from 'three'
import type { TrackTheme } from '../../config/tracks/theme'
import type { Track } from '../../sim/track'
import { DrawDistanceSet, groupByCell } from '../environment/chunking'
import { scatterDecorations, type ScatterOptions } from './scatter'
import { sceneryMaterial } from './sceneryKit'
import { sceneryModel } from './sceneryModels'

/** Side (m) of the cells each decoration set is split into, so the ones off screen are culled. */
const SCENERY_CHUNK = 128

/** How far (m) a decoration draws at a quality draw scale of 1; thin ones vanish sooner. */
export function sceneryDrawDistance(kind: string): number {
  return kind === 'confetti' ? 90 : 260
}

/** The decorations of a track: instanced cells, hidden beyond the quality's draw distance. */
export class Scenery extends THREE.Group {
  private readonly distances = new DrawDistanceSet()

  constructor() {
    super()
    this.name = 'scenery'
  }

  addCell(mesh: THREE.InstancedMesh, kind: string): void {
    this.distances.add(mesh, sceneryDrawDistance(kind))
    this.add(mesh)
  }

  setFocus(focus: { x: number; z: number }, drawScale: number): void {
    this.distances.setFocus(focus, drawScale)
  }
}

/**
 * Scatters the theme's decorations around the track. Each set becomes one instanced mesh per
 * material layer of its prop, so a track's scenery costs a handful of draw calls.
 */
export function createScenery(
  track: Track,
  theme: TrackTheme,
  extra: Pick<ScatterOptions, 'heightAt' | 'keepClear'> = {},
): Scenery {
  const group = new Scenery()
  const matrix = new THREE.Matrix4()
  const color = new THREE.Color()
  const position = new THREE.Vector3()
  const scale = new THREE.Vector3()
  const rotation = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)

  theme.decorations.forEach((set, setIndex) => {
    const options: ScatterOptions = {
      ...extra,
      setIndex,
      ...(theme.water ? { waterLevel: theme.water.level } : {}),
    }
    const items = scatterDecorations(track, set.kind, set.count, options)
    if (items.length === 0) return
    const model = sceneryModel(set.kind)
    const cells = groupByCell(items, SCENERY_CHUNK, (item) => item)
    // Tints follow the item's place in the whole set, not in its cell
    const order = new Map(items.map((item, i) => [item, i]))
    for (const part of model.parts) {
      for (const cell of cells.values()) {
        const mesh = new THREE.InstancedMesh(
          part.geometry,
          sceneryMaterial(part.layer),
          cell.length,
        )
        mesh.name = `${set.kind}:${part.layer}`
        // Confetti is a thin decoration; everything else is solid enough to cast
        mesh.castShadow = set.kind !== 'confetti'
        cell.forEach((item, i) => {
          position.set(item.x, item.y, item.z)
          rotation.setFromAxisAngle(up, item.yaw)
          scale.setScalar(item.scale)
          mesh.setMatrixAt(i, matrix.compose(position, rotation, scale))
          if (model.tints)
            mesh.setColorAt(
              i,
              color.set(model.tints[(order.get(item) ?? i) % model.tints.length] ?? '#fff'),
            )
        })
        mesh.instanceMatrix.needsUpdate = true
        mesh.computeBoundingSphere()
        group.addCell(mesh, set.kind)
      }
    }
  })
  return group
}
