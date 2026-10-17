import * as THREE from 'three'
import type { TrackTheme } from '../config/tracks/theme'

/** Radius of the sky dome; it is drawn first with no depth, so only needs to fit the far plane. */
const SKY_RADIUS = 40

const UNDERGROUND_DARKNESS = '#04050a'
/** How much of the theme's own color survives underground (0 = black, 1 = unchanged). */
const UNDERGROUND_KEEP = 0.06
const UNDERGROUND_FOG_NEAR = 12
const UNDERGROUND_FOG_FAR = 95
const UNDERGROUND_SUN = 0.25
const UNDERGROUND_AMBIENT = 0.55

/** The theme's sky and light values, with the underground adjustments applied. */
export type SceneLook = Pick<
  TrackTheme,
  'sky' | 'horizon' | 'fog' | 'fogNear' | 'fogFar' | 'ambientIntensity' | 'sunIntensity'
>

/**
 * Underground tracks (Zipaquirá) have no sky: near-black dome and fog (tinted a little by the
 * theme), a short view distance and a dim sun. The ambient tint stays, softer.
 */
export function undergroundLook(theme: TrackTheme): SceneLook {
  const dark = (color: string, keep: number): string =>
    '#' + new THREE.Color(UNDERGROUND_DARKNESS).lerp(new THREE.Color(color), keep).getHexString()
  return {
    sky: dark(theme.sky, UNDERGROUND_KEEP * 0.5),
    horizon: dark(theme.horizon, UNDERGROUND_KEEP),
    fog: dark(theme.fog, UNDERGROUND_KEEP),
    fogNear: Math.min(theme.fogNear, UNDERGROUND_FOG_NEAR),
    fogFar: Math.min(theme.fogFar, UNDERGROUND_FOG_FAR),
    ambientIntensity: theme.ambientIntensity * UNDERGROUND_AMBIENT,
    sunIntensity: theme.sunIntensity * UNDERGROUND_SUN,
  }
}

/**
 * Background dome with a vertical gradient: `bottom` color at the horizon and below, `top`
 * overhead. It ignores fog and follows the camera, so it never gets closer or farther.
 */
export class Sky extends THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  constructor() {
    super(
      new THREE.SphereGeometry(SKY_RADIUS, 24, 12),
      new THREE.ShaderMaterial({
        uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
        vertexShader: `
          varying float vHeight;
          void main() {
            vHeight = normalize(position).y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 top;
          uniform vec3 bottom;
          varying float vHeight;
          void main() {
            gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0, 0.65, vHeight)), 1.0);
            #include <colorspace_fragment>
          }
        `,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
      }),
    )
    this.name = 'sky'
    this.renderOrder = -1000
    this.frustumCulled = false
    this.onBeforeRender = (_renderer, _scene, camera) => this.position.copy(camera.position)
  }

  setColors(top: string, bottom: string): void {
    this.material.uniforms.top?.value.set(top)
    this.material.uniforms.bottom?.value.set(bottom)
  }
}

export function createSky(): Sky {
  return new Sky()
}
