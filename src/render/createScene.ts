import * as THREE from 'three'

const SKY_COLOR = '#87ceeb'
const FOG_NEAR = 80
const FOG_FAR = 260

export interface SceneContext {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
}

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(SKY_COLOR)
  scene.fog = new THREE.Fog(SKY_COLOR, FOG_NEAR, FOG_FAR)

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, FOG_FAR + 20)

  scene.add(new THREE.HemisphereLight('#ffffff', '#5a8f3c', 1.2))
  const sun = new THREE.DirectionalLight('#ffffff', 1.5)
  sun.position.set(30, 50, 20)
  scene.add(sun)

  return { renderer, scene, camera }
}

export function resizeToCanvas({ renderer, camera }: SceneContext): void {
  const canvas = renderer.domElement
  const { clientWidth: width, clientHeight: height } = canvas
  const ratio = renderer.getPixelRatio()
  if (canvas.width === Math.floor(width * ratio) && canvas.height === Math.floor(height * ratio)) {
    return
  }
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}
