import * as THREE from 'three'

const OUTLINE_COLOR = '#1a1420'
const OUTLINE_THICKNESS = 0.025

let gradient: THREE.DataTexture | null = null

/** Three-step light ramp shared by every toon material. */
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient
  const steps = new Uint8Array([150, 215, 255])
  gradient = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat)
  gradient.minFilter = THREE.NearestFilter
  gradient.magFilter = THREE.NearestFilter
  gradient.needsUpdate = true
  return gradient
}

/** Toon material painted by the model's vertex colors. */
export function vertexColorToon(): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() })
}

/** Inverted hull: back faces pushed out along the normals, drawn in a flat dark color. */
export function outlineMaterial(thickness = OUTLINE_THICKNESS): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `vec3 transformed = vec3(position) + normal * ${thickness.toFixed(4)};`,
    )
  }
  material.customProgramCacheKey = () => `outline-${thickness}`
  return material
}

/** Adds an outline mesh that shares the geometry (and skeleton) of `mesh`. */
export function addOutline(mesh: THREE.Mesh, thickness?: number): THREE.Mesh {
  const material = outlineMaterial(thickness)
  let outline: THREE.Mesh
  if (mesh instanceof THREE.SkinnedMesh) {
    const skinned = new THREE.SkinnedMesh(mesh.geometry, material)
    skinned.bind(mesh.skeleton, mesh.bindMatrix)
    outline = skinned
  } else {
    outline = new THREE.Mesh(mesh.geometry, material)
  }
  outline.name = `${mesh.name}-outline`
  outline.position.copy(mesh.position)
  outline.quaternion.copy(mesh.quaternion)
  outline.scale.copy(mesh.scale)
  mesh.parent?.add(outline)
  return outline
}
