import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

const SKY_COLOR = '#87ceeb'
const FOG_NEAR = 80
const FOG_FAR = 260
/** Only pixels brighter than this (linear) glow: nitro flames, powers and lightning. */
const BLOOM_THRESHOLD = 1.05
const BLOOM_STRENGTH = 0.55
const BLOOM_RADIUS = 0.5
/** Multisampling of the render target the composer draws into (keeps edges smooth). */
const COMPOSER_SAMPLES = 4

export interface SceneContext {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  /** Null when the bloom is off (`?bloom=0`). */
  composer: EffectComposer | null
}

/** Bloom is on unless the URL says `?bloom=0`. */
function bloomEnabled(): boolean {
  return new URLSearchParams(window.location.search).get('bloom') !== '0'
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

  return {
    renderer,
    scene,
    camera,
    composer: bloomEnabled() ? createComposer(renderer, scene, camera) : null,
  }
}

function createComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): EffectComposer {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: COMPOSER_SAMPLES,
  })
  const composer = new EffectComposer(renderer, target)
  composer.setPixelRatio(renderer.getPixelRatio())
  composer.setSize(renderer.domElement.clientWidth || 1, renderer.domElement.clientHeight || 1)
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(
    new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD),
  )
  composer.addPass(new OutputPass())
  return composer
}

/** Draws the frame, through the bloom composer when it is on. */
export function renderScene({ renderer, scene, camera, composer }: SceneContext): void {
  if (composer) composer.render()
  else renderer.render(scene, camera)
}

export function resizeToCanvas({ renderer, camera, composer }: SceneContext): void {
  const canvas = renderer.domElement
  const { clientWidth: width, clientHeight: height } = canvas
  const ratio = renderer.getPixelRatio()
  if (canvas.width === Math.floor(width * ratio) && canvas.height === Math.floor(height * ratio)) {
    return
  }
  renderer.setSize(width, height, false)
  composer?.setPixelRatio(ratio)
  composer?.setSize(width, height)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}
