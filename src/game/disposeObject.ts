import * as THREE from 'three'

/** Frees the GPU resources of one material, including the textures it uses. */
function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) value.dispose()
  }
  material.dispose()
}

/**
 * Removes `root` from its parent and frees the geometries, materials and textures of every
 * mesh, line and point set below it. Use it on scenery that is replaced, e.g. when a new track
 * loads, so the GPU memory does not pile up.
 */
export function disposeObject(root: THREE.Object3D): void {
  root.removeFromParent()
  root.traverse((node) => {
    if (!(
      node instanceof THREE.Mesh ||
      node instanceof THREE.Line ||
      node instanceof THREE.Points
    )) {
      return
    }
    node.geometry.dispose()
    const material: THREE.Material | THREE.Material[] = node.material
    if (Array.isArray(material)) material.forEach(disposeMaterial)
    else disposeMaterial(material)
  })
}
