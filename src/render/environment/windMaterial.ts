import * as THREE from 'three'

/** Seconds, advanced by the environment every frame; shared by every wind material. */
export const windClock: THREE.IUniform<number> = { value: 0 }

export interface WindOptions {
  /** Sway at height 1 (m of displacement). */
  strength: number
  /** Sway grows with height to this power: 1 for grass, 2 for tall trunks. */
  power: number
  side?: THREE.Side
}

/**
 * Standard material for instanced plants: vertex colors with a per-vertex `tint` that decides
 * whether the instance color applies, and a gentle wind sway in the vertex shader. The sway is
 * driven by the height of the vertex and the instance position, so neighbors move out of step.
 * Shadows keep the still shape (the depth pass uses the stock material).
 */
export function createWindMaterial(options: WindOptions): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0,
    side: options.side ?? THREE.FrontSide,
  })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windClock
    shader.uniforms.uWindStrength = { value: options.strength }
    shader.uniforms.uWindPower = { value: options.power }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float tint;
        uniform float uWindTime;
        uniform float uWindStrength;
        uniform float uWindPower;`,
      )
      .replace(
        '#include <color_vertex>',
        `#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
          vColor = vec4( 1.0 );
        #endif
        #ifdef USE_COLOR
          vColor.rgb *= color;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vColor.rgb *= mix( vec3( 1.0 ), instanceColor.rgb, tint );
        #endif`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float windHeight = max( position.y, 0.0 );
          vec3 windOrigin = vec3( 0.0 );
          #ifdef USE_INSTANCING
            windOrigin = vec3( instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2] );
          #endif
          float windPhase = windOrigin.x * 0.11 + windOrigin.z * 0.083;
          float windPush = pow( windHeight, uWindPower ) * uWindStrength;
          float gust = sin( uWindTime * 1.5 + windPhase ) * 0.65 + sin( uWindTime * 2.6 + windPhase * 1.7 ) * 0.35;
          transformed.x += gust * windPush;
          transformed.z += cos( uWindTime * 1.2 + windPhase * 1.3 ) * windPush * 0.6;
        }`,
      )
  }
  material.customProgramCacheKey = () => 'wind'
  return material
}
