import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { resolveQuality, type Quality, type ResolvedQuality } from '../config/quality'
import { DEFAULT_THEME, type TrackTheme } from '../config/tracks/theme'
import { createSky, undergroundLook, type Sky } from './sky'

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
  /** Null when the bloom is off (`?bloom=0` or low quality). */
  composer: EffectComposer | null
  /** Lights and sky that `applySceneTheme` recolors when the track changes. */
  hemisphere: THREE.HemisphereLight
  sun: THREE.DirectionalLight
  sky: Sky
}

/** The URL says `?bloom=0`: no bloom at any quality. */
function bloomForcedOff(): boolean {
  return new URLSearchParams(window.location.search).get('bloom') === '0'
}

export function createScene(canvas: HTMLCanvasElement, quality: Quality = 'high'): SceneContext {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  const resolved = resolveQuality(quality, window.devicePixelRatio, bloomForcedOff())
  renderer.setPixelRatio(resolved.pixelRatio)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, DEFAULT_THEME.fogFar + 20)

  const hemisphere = new THREE.HemisphereLight()
  const sun = new THREE.DirectionalLight()
  sun.position.set(30, 50, 20)
  const sky = createSky()
  scene.add(sky, hemisphere, sun)

  const context: SceneContext = {
    renderer,
    scene,
    camera,
    composer: resolved.bloom ? createComposer(renderer, scene, camera) : null,
    hemisphere,
    sun,
    sky,
  }
  applySceneTheme(context, DEFAULT_THEME)
  return context
}

/**
 * Changes the graphics quality of a running scene: pixel ratio and bloom. The canvas size is
 * refreshed by the next `resizeToCanvas`. Returns the resolved values (particles, speed lines).
 */
export function applyQuality(context: SceneContext, quality: Quality): ResolvedQuality {
  const resolved = resolveQuality(quality, window.devicePixelRatio, bloomForcedOff())
  const { renderer, scene, camera } = context
  renderer.setPixelRatio(resolved.pixelRatio)
  if (resolved.bloom && !context.composer) {
    context.composer = createComposer(renderer, scene, camera)
  } else if (!resolved.bloom && context.composer) {
    context.composer.dispose()
    context.composer = null
  }
  return resolved
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

/**
 * Sky, fog and lights of a track's theme. Call it whenever a new track is loaded; it can be
 * called any number of times. The sky is a gradient from `horizon` (at eye level and below) to
 * `sky` (overhead) that ignores fog. An `underground` theme turns the sky near-black, pulls the
 * fog in and dims the sun, so the colored glow of the decorations (and the ambient tint) carry
 * the scene.
 */
export function applySceneTheme(context: SceneContext, theme: TrackTheme): void {
  const { scene, camera, hemisphere, sun, sky } = context
  const look = theme.underground ? undergroundLook(theme) : theme

  scene.background = new THREE.Color(look.horizon)
  scene.fog = new THREE.Fog(look.fog, look.fogNear, look.fogFar)
  camera.far = look.fogFar + 20
  camera.updateProjectionMatrix()

  hemisphere.color.set(theme.ambientSky)
  hemisphere.groundColor.set(theme.ambientGround)
  hemisphere.intensity = look.ambientIntensity
  sun.color.set(theme.sun)
  sun.intensity = look.sunIntensity

  sky.setColors(look.sky, look.horizon)
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
