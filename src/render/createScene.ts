import * as THREE from 'three'

export interface SceneContext {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  /** Placeholder object until the kart exists (stage 1). */
  cube: THREE.Mesh
}

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#87ceeb')

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
  camera.position.set(0, 1.5, 4)
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.HemisphereLight('#ffffff', '#5a8f3c', 1.2))
  const sun = new THREE.DirectionalLight('#ffffff', 1.5)
  sun.position.set(3, 5, 2)
  scene.add(sun)

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshToonMaterial({ color: '#c8873a' }),
  )
  scene.add(cube)

  return { renderer, scene, camera, cube }
}

export function resizeToCanvas({ renderer, camera }: SceneContext): void {
  const canvas = renderer.domElement
  const { clientWidth: width, clientHeight: height } = canvas
  if (canvas.width === width && canvas.height === height) return
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}
