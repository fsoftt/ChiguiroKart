import * as THREE from 'three'
import type { ParticleRing } from './particleRing'

/** Pixels of point size per meter of diameter at one meter of depth. */
const POINT_SCALE = 220

/**
 * Draws a `ParticleRing` as a single `THREE.Points` cloud with per-particle size, color and
 * opacity. Soft round sprites with depth writes off keep overlapping puffs from cutting into
 * each other, which matters for dense drift smoke.
 */
export class ParticlePoints {
  readonly object: THREE.Points
  private readonly geometry = new THREE.BufferGeometry()
  private readonly material: THREE.ShaderMaterial
  private readonly size: THREE.BufferAttribute
  private readonly alpha: THREE.BufferAttribute

  constructor(
    private readonly ring: ParticleRing,
    additive: boolean,
  ) {
    const capacity = ring.capacity
    const positions = new THREE.BufferAttribute(ring.offsets, 3)
    const colors = new THREE.BufferAttribute(ring.colors, 3)
    this.size = new THREE.BufferAttribute(new Float32Array(capacity), 1)
    this.alpha = new THREE.BufferAttribute(new Float32Array(capacity), 1)

    this.geometry.setAttribute('position', positions)
    this.geometry.setAttribute('aColor', colors)
    this.geometry.setAttribute('aSize', this.size)
    this.geometry.setAttribute('aAlpha', this.alpha)

    this.material = new THREE.ShaderMaterial({
      defines: { POINT_SCALE: POINT_SCALE.toFixed(1) },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })

    this.object = new THREE.Points(this.geometry, this.material)
    this.object.frustumCulled = false
  }

  /** Copies the live particles into the GPU buffers and uploads what changed. */
  sync(): void {
    for (let slot = 0; slot < this.ring.capacity; slot += 1) {
      const alive = this.ring.isAlive(slot)
      this.size.setX(slot, alive ? (this.ring.params[slot * 2] ?? 0) : 0)
      this.alpha.setX(slot, alive ? (this.ring.params[slot * 2 + 1] ?? 0) : 0)
    }
    const position = this.geometry.getAttribute('position')
    const color = this.geometry.getAttribute('aColor')
    if (position) position.needsUpdate = true
    if (color) color.needsUpdate = true
    this.size.needsUpdate = true
    this.alpha.needsUpdate = true
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}

const VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (POINT_SCALE / max(-mvPosition.z, 0.1));
    gl_Position = projectionMatrix * mvPosition;
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float distanceToCentre = length(gl_PointCoord - vec2(0.5));
    if (distanceToCentre > 0.5) discard;
    float softEdge = 1.0 - smoothstep(0.15, 0.5, distanceToCentre);
    gl_FragColor = vec4(vColor, vAlpha * softEdge);
  }
`
