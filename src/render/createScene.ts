import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { resolveQuality, type Quality, type ResolvedQuality } from '../config/quality'
import { resolveLighting } from '../config/tracks/lighting'
import { DEFAULT_THEME, type TrackTheme } from '../config/tracks/theme'
import { MountainRing } from './mountains'
import { BlobShadows, ShadowRig } from './shadows'
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
  /** Horizon silhouette ring of the theme. */
  mountains: MountainRing
  /** Sun shadow map that follows the player (see `updateSceneFocus`). */
  shadows: ShadowRig
  /** Blob shadows under the karts, used in low quality. */
  blobs: BlobShadows
  /** Theme in use and the quality's fog scale, kept so a quality change can redo the fog. */
  theme: TrackTheme
  fogScale: number
}

/** `?stats=1` exposes the renderer's counters as `window.__renderInfo` (draw calls, triangles). */
function statsEnabled(): boolean {
  return new URLSearchParams(window.location.search).get('stats') === '1'
}

/** The URL says `?bloom=0`: no bloom at any quality. */
function bloomForcedOff(): boolean {
  return new URLSearchParams(window.location.search).get('bloom') === '0'
}

export function createScene(canvas: HTMLCanvasElement, quality: Quality = 'high'): SceneContext {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  const resolved = resolveQuality(quality, window.devicePixelRatio, bloomForcedOff())
  renderer.setPixelRatio(resolved.pixelRatio)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace
  // In three r186 the PCF map is already filtered softly (PCFSoftShadowMap was removed)
  renderer.shadowMap.type = THREE.PCFShadowMap
  // Counters add up over the shadow, scene and bloom passes; `renderScene` resets them per frame
  renderer.info.autoReset = false
  if (statsEnabled()) Object.assign(window, { __renderInfo: renderer.info })

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, DEFAULT_THEME.fogFar + 20)

  const hemisphere = new THREE.HemisphereLight()
  const sun = new THREE.DirectionalLight()
  const sky = createSky()
  const mountains = new MountainRing()
  const blobs = new BlobShadows()
  const shadows = new ShadowRig(sun, scene)
  scene.add(sky, mountains, hemisphere, sun, blobs.object)

  const context: SceneContext = {
    renderer,
    scene,
    camera,
    composer: resolved.bloom ? createComposer(renderer, scene, camera) : null,
    hemisphere,
    sun,
    sky,
    mountains,
    shadows,
    blobs,
    theme: DEFAULT_THEME,
    fogScale: resolved.fogScale,
  }
  applySceneTheme(context, DEFAULT_THEME)
  applyShadowQuality(context, resolved)
  return context
}

/** Shadow map size, blob shadows and the renderer's shadow switch for a resolved quality. */
function applyShadowQuality(context: SceneContext, resolved: ResolvedQuality): void {
  context.renderer.shadowMap.enabled = resolved.shadowMapSize > 0
  context.shadows.setMapSize(resolved.shadowMapSize)
  context.blobs.setEnabled(resolved.blobShadows)
}

/**
 * Changes the graphics quality of a running scene: pixel ratio, bloom, shadows and draw
 * distance. The canvas size is refreshed by the next `resizeToCanvas`. Returns the resolved
 * values (particles, speed lines).
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
  applyShadowQuality(context, resolved)
  if (context.fogScale !== resolved.fogScale) {
    context.fogScale = resolved.fogScale
    applySceneTheme(context, context.theme)
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
 * Sky, fog, lights and horizon of a track's theme. Call it whenever a new track is loaded; it
 * can be called any number of times. The sky is a gradient from `horizon` (at eye level and
 * below) to `sky` (overhead) with clouds and a sun halo, and ignores fog. Fog distances are
 * scaled by the quality (`fogScale`), which also shortens the camera far plane. An
 * `underground` theme turns the sky near-black, pulls the fog in and dims the sun, so the
 * colored glow of the decorations (and the ambient tint) carry the scene.
 */
export function applySceneTheme(context: SceneContext, theme: TrackTheme): void {
  const { scene, camera, hemisphere, sun, sky, mountains, shadows, renderer } = context
  const look = theme.underground ? undergroundLook(theme) : theme
  const lighting = resolveLighting(theme)
  context.theme = theme

  const fogNear = look.fogNear * context.fogScale
  const fogFar = look.fogFar * context.fogScale
  scene.background = new THREE.Color(look.horizon)
  scene.fog = new THREE.Fog(look.fog, fogNear, fogFar)
  camera.far = fogFar + 20
  camera.updateProjectionMatrix()

  hemisphere.color.set(theme.ambientSky)
  hemisphere.groundColor.set(theme.ambientGround)
  hemisphere.intensity = look.ambientIntensity
  sun.color.set(theme.sun)
  sun.intensity = look.sunIntensity
  shadows.setDirection(lighting.sunDirection)
  shadows.update(camera.position)
  renderer.toneMappingExposure = lighting.exposure

  sky.setColors(look.sky, look.horizon)
  sky.setSun(lighting.sunDirection, theme.underground ? '#000000' : theme.sun, lighting.clouds)
  mountains.setLook(lighting.mountains, look.fog, fogFar)
}

/**
 * Per-frame follow of the shadow map and the blob shadows: call it with the player's kart
 * position, the `groundHeight` of the track and the karts that get a blob.
 */
export function updateSceneFocus(
  context: SceneContext,
  focus: THREE.Vector3,
  groundHeight: (x: number, z: number) => number,
): void {
  if (context.shadows.enabled) context.shadows.update(focus)
  context.blobs.update(groundHeight)
}

/** Draws the frame, through the bloom composer when it is on. */
export function renderScene({ renderer, scene, camera, composer }: SceneContext): void {
  renderer.info.reset()
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
