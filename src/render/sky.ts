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
 * Background dome: a vertical gradient (`bottom` color at the horizon and below, `top` overhead),
 * a soft glow around the sun and a stylized layer of puffy clouds. It ignores fog and follows
 * the camera, so it never gets closer or farther. The shader applies tone mapping itself, so
 * it matches the fogged scene whether or not the bloom composer is on.
 */
export class Sky extends THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  constructor() {
    super(
      new THREE.SphereGeometry(SKY_RADIUS, 24, 12),
      new THREE.ShaderMaterial({
        uniforms: {
          top: { value: new THREE.Color() },
          bottom: { value: new THREE.Color() },
          sunDirection: { value: new THREE.Vector3(0, 1, 0) },
          sunColor: { value: new THREE.Color() },
          clouds: { value: 0.5 },
          time: { value: 0 },
        },
        vertexShader: `
          varying vec3 vDirection;
          void main() {
            vDirection = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 top;
          uniform vec3 bottom;
          uniform vec3 sunDirection;
          uniform vec3 sunColor;
          uniform float clouds;
          uniform float time;
          varying vec3 vDirection;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
              f.y
            );
          }
          float density(vec2 p) {
            return noise(p) * 0.55 + noise(p * 2.1 + 7.3) * 0.3 + noise(p * 4.3 + 1.9) * 0.15;
          }

          void main() {
            vec3 dir = normalize(vDirection);
            float height = dir.y;
            vec3 color = mix(bottom, top, smoothstep(0.0, 0.65, height));

            // Warm halo around the sun
            float toSun = max(dot(dir, normalize(sunDirection)), 0.0);
            color += sunColor * (pow(toSun, 24.0) * 0.28 + pow(toSun, 220.0) * 0.6);

            // Cloud layer: the sky projected on a plane, thresholded into soft cartoon puffs
            if (height > 0.0 && clouds > 0.0) {
              vec2 p = dir.xz / (height + 0.14) * 1.5 + vec2(time * 0.012, 0.0);
              float d = density(p);
              float threshold = mix(0.74, 0.42, clouds);
              float puff = smoothstep(threshold, threshold + 0.1, d);
              // Lit on the sun's side, bluish underneath
              float lit = clamp(0.55 + (d - density(p + sunDirection.xz * 0.12)) * 5.0, 0.0, 1.0);
              vec3 cloudColor = mix(mix(bottom, vec3(0.55, 0.62, 0.78), 0.55), vec3(1.0), lit);
              float fade = smoothstep(0.02, 0.22, height);
              color = mix(color, cloudColor, puff * fade * 0.92);
            }

            gl_FragColor = vec4(color, 1.0);
            #include <tonemapping_fragment>
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
    this.onBeforeRender = (_renderer, _scene, camera) => {
      this.position.copy(camera.position)
      const time = this.material.uniforms.time
      if (time) time.value = performance.now() / 1000
    }
  }

  setColors(top: string, bottom: string): void {
    this.material.uniforms.top?.value.set(top)
    this.material.uniforms.bottom?.value.set(bottom)
  }

  /** Sun halo (direction toward the sun, color) and cloud cover 0..1. */
  setSun(direction: readonly [number, number, number], color: string, clouds: number): void {
    this.material.uniforms.sunDirection?.value.set(...direction)
    this.material.uniforms.sunColor?.value.set(color)
    if (this.material.uniforms.clouds) this.material.uniforms.clouds.value = clouds
  }
}

export function createSky(): Sky {
  return new Sky()
}
