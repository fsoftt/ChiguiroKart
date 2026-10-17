import * as THREE from 'three'
import type { CharacterId } from '../../config/characters'
import { buildCharacterClips } from './characterClips'
import { buildCharacterParts, characterModels } from './characterModels'
import { ModelKit } from './modelKit'
import { RACER_MESH_NAME, type DriverBone } from './rig'

export interface CharacterAsset {
  /** Group holding the skinned mesh (kart and driver). */
  scene: THREE.Group
  animations: THREE.AnimationClip[]
}

/**
 * Builds a character's kart and driver from primitives, with every bone and clip of the rig
 * contract. This is the source of `public/models/<id>.glb` (see `scripts/buildModels.ts`).
 */
export function buildCharacterAsset(id: CharacterId): CharacterAsset {
  const kit = new ModelKit()
  buildCharacterParts(kit, id)
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })
  material.name = `${id}-toon`
  const mesh = kit.build(RACER_MESH_NAME, material)
  const scene = new THREE.Group()
  scene.name = id
  scene.add(mesh)
  const bindPosition = (bone: DriverBone): THREE.Vector3 =>
    mesh.skeleton.getBoneByName(bone)?.position.clone() ?? new THREE.Vector3()
  return { scene, animations: buildCharacterClips(characterModels[id], bindPosition) }
}
