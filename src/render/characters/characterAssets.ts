import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { characterIds, type CharacterId } from '../../config/characters'
import { buildCharacterAsset, type CharacterAsset } from './buildCharacter'
import { clipNames, requiredBoneNames, RACER_MESH_NAME } from './rig'
import { addOutline, vertexColorToon } from './toon'

/** Rig contract parts (bones and clips) absent from a model; empty when it is valid. */
export function missingRigParts(
  boneList: readonly string[],
  clipList: readonly string[],
): string[] {
  const bones = new Set(boneList)
  const clips = new Set(clipList)
  return [
    ...requiredBoneNames.filter((name) => !bones.has(name)).map((name) => `bone ${name}`),
    ...clipNames.filter((name) => !clips.has(name)).map((name) => `clip ${name}`),
  ]
}

/** A fresh, independent copy of a character: its scene root, skinned mesh and clips. */
export interface CharacterInstance {
  object: THREE.Group
  mesh: THREE.SkinnedMesh
  /** Inverted-hull outline mesh, drawn with the same skeleton. */
  outline: THREE.Mesh
  animations: THREE.AnimationClip[]
}

const assets = new Map<CharacterId, CharacterAsset>()

function findRacerMesh(root: THREE.Object3D): THREE.SkinnedMesh | null {
  let found: THREE.SkinnedMesh | null = null
  root.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh && child.name === RACER_MESH_NAME) found = child
  })
  return found
}

/** Why a loaded asset breaks the rig contract, or null when it is fine. */
function invalidReason(asset: CharacterAsset): string | null {
  const mesh = findRacerMesh(asset.scene)
  if (!mesh) return `no skinned mesh named ${RACER_MESH_NAME}`
  const missing = missingRigParts(
    mesh.skeleton.bones.map((bone) => bone.name),
    asset.animations.map((animation) => animation.name),
  )
  return missing.length > 0 ? `missing ${missing.join(', ')}` : null
}

async function loadOne(loader: GLTFLoader, id: CharacterId): Promise<CharacterAsset> {
  const url = `${import.meta.env.BASE_URL}models/${id}.glb`
  try {
    const gltf = await loader.loadAsync(url)
    const asset = { scene: gltf.scene, animations: gltf.animations }
    const reason = invalidReason(asset)
    if (!reason) return asset
    console.warn(`Model ${url} breaks the rig contract (${reason}); using the built-in one`)
  } catch (error) {
    console.warn(`Could not load ${url}; using the built-in model`, error)
  }
  return buildCharacterAsset(id)
}

/** Loads the 8 character models; call once before creating any instance. */
export async function loadCharacterAssets(): Promise<void> {
  const loader = new GLTFLoader()
  const loaded = await Promise.all(characterIds.map((id) => loadOne(loader, id)))
  characterIds.forEach((id, i) => {
    const asset = loaded[i]
    if (asset) assets.set(id, asset)
  })
}

/** Toon-shaded, outlined copy of a character with its own skeleton (clips are shared). */
export function createCharacterInstance(id: CharacterId): CharacterInstance {
  const asset = assets.get(id) ?? buildCharacterAsset(id)
  const object = clone(asset.scene) as THREE.Group
  const mesh = findRacerMesh(object)
  if (!mesh) throw new Error(`Character ${id} has no ${RACER_MESH_NAME} mesh`)
  mesh.material = vertexColorToon()
  const outline = addOutline(mesh)
  return { object, mesh, outline, animations: asset.animations }
}
