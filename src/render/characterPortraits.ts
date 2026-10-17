import * as THREE from 'three'
import { characterIds, type CharacterId } from '../config/characters'
import { createCharacterInstance } from './characters/characterAssets'
import { PORTRAIT, portraitFraming } from './portraitFraming'

const cache = new Map<CharacterId, string>()
let pending: Promise<void> | null = null

/** Cached portrait (PNG data URL) of a character, or null until `generatePortraits` made it. */
export function getPortrait(id: CharacterId): string | null {
  return cache.get(id) ?? null
}

/** Renders one character with `renderer`, from the model itself, and returns a PNG data URL. */
function renderPortrait(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  id: CharacterId,
): string {
  const model = createCharacterInstance(id)
  scene.add(model.object)
  model.object.updateMatrixWorld(true)
  const head = model.mesh.skeleton.getBoneByName('head')
  const position = new THREE.Vector3(0, 1.4, 0)
  head?.getWorldPosition(position)
  const framing = portraitFraming(position)
  camera.fov = framing.fov
  camera.position.set(framing.position.x, framing.position.y, framing.position.z)
  camera.lookAt(framing.target.x, framing.target.y, framing.target.z)
  camera.updateProjectionMatrix()
  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/png')
  scene.remove(model.object)
  // Geometries and the toon gradient are shared with the loaded asset: only free what is ours
  for (const mesh of [model.mesh, model.outline]) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) material.dispose()
  }
  model.mesh.skeleton.dispose()
  return url
}

function generate(): void {
  const canvas = document.createElement('canvas')
  canvas.width = PORTRAIT.size
  canvas.height = PORTRAIT.size
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  })
  try {
    renderer.setPixelRatio(1)
    renderer.setSize(PORTRAIT.size, PORTRAIT.size, false)
    renderer.setClearColor(0x000000, 0)
    const scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7aa8, 1.6))
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.4)
    sun.position.set(2, 3, 3)
    scene.add(sun)
    const camera = new THREE.PerspectiveCamera(PORTRAIT.fov, 1, 0.1, 20)
    for (const id of characterIds) {
      if (!cache.has(id)) cache.set(id, renderPortrait(renderer, scene, camera, id))
    }
  } finally {
    renderer.dispose()
    renderer.forceContextLoss()
  }
}

/**
 * Renders a portrait of every character once (lazily, on the first call) with a temporary
 * renderer that is disposed afterwards. Resolves when `getPortrait` has them all, or never
 * rejects if WebGL is unavailable (the menu keeps its letters).
 */
export function generatePortraits(): Promise<void> {
  if (cache.size === characterIds.length) return Promise.resolve()
  pending ??= new Promise<void>((resolve) => {
    // Let the menu paint first: rendering 8 skinned models takes a moment
    requestAnimationFrame(() => {
      try {
        generate()
      } catch (error) {
        console.warn('Could not render the character portraits', error)
      }
      resolve()
    })
  }).finally(() => {
    pending = null
  })
  return pending
}
