import * as THREE from 'three'
import type { TrackTheme } from '../../config/tracks/theme'
import type { Track } from '../../sim/track'
import { scatterDecorations, type ScatterOptions } from './scatter'
import { sceneryMaterial } from './sceneryKit'
import { sceneryModel } from './sceneryModels'

/**
 * Scatters the theme's decorations around the track. Each set becomes one instanced mesh per
 * material layer of its prop, so a track's scenery costs a handful of draw calls.
 */
export function createScenery(
  track: Track,
  theme: TrackTheme,
  extra: Pick<ScatterOptions, 'heightAt' | 'keepClear'> = {},
): THREE.Group {
  const group = new THREE.Group()
  group.name = 'scenery'
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
    for (const part of model.parts) {
      const mesh = new THREE.InstancedMesh(part.geometry, sceneryMaterial(part.layer), items.length)
      mesh.name = `${set.kind}:${part.layer}`
      // Confetti is a thin decoration; everything else is solid enough to cast
      mesh.castShadow = set.kind !== 'confetti'
      items.forEach((item, i) => {
        position.set(item.x, item.y, item.z)
        rotation.setFromAxisAngle(up, item.yaw)
        scale.setScalar(item.scale)
        mesh.setMatrixAt(i, matrix.compose(position, rotation, scale))
        if (model.tints)
          mesh.setColorAt(i, color.set(model.tints[i % model.tints.length] ?? '#fff'))
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
      group.add(mesh)
    }
  })
  return group
}
