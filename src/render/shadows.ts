import * as THREE from 'three'
import type { Vec3 } from '../config/tracks/lighting'
import { snapFocusToTexelGrid } from './shadowMath'

/** Half side (meters) of the square the sun's shadow map covers around the player. */
export const SHADOW_HALF_EXTENT = 50
/** How far from the focus point the sun's shadow camera sits. */
const SHADOW_DISTANCE = 140
const SHADOW_DEPTH = 320

/**
 * The sun's shadow map. One orthographic frustum follows the player's kart; `update` snaps it
 * to the texel grid so the shadow edges do not crawl while the kart moves.
 */
export class ShadowRig {
  private toSun: Vec3 = [0.5, 0.75, 0.4]
  private mapSize = 0

  constructor(
    readonly sun: THREE.DirectionalLight,
    scene: THREE.Scene,
  ) {
    scene.add(sun.target)
    const camera = sun.shadow.camera
    camera.left = -SHADOW_HALF_EXTENT
    camera.right = SHADOW_HALF_EXTENT
    camera.top = SHADOW_HALF_EXTENT
    camera.bottom = -SHADOW_HALF_EXTENT
    camera.near = 1
    camera.far = SHADOW_DEPTH
    camera.updateProjectionMatrix()
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.05
  }

  get enabled(): boolean {
    return this.mapSize > 0
  }

  /** Turns the shadows on at a map size in texels, or off with 0. Applies live. */
  setMapSize(size: number): void {
    if (size === this.mapSize) return
    this.mapSize = size
    this.sun.castShadow = size > 0
    if (size > 0) {
      this.sun.shadow.mapSize.set(size, size)
      // Wider PCF filter on the bigger map keeps shadow edges soft
      this.sun.shadow.radius = size >= 2048 ? 3 : 2
      // A new size needs a new map; three allocates it on the next render
      this.sun.shadow.map?.dispose()
      this.sun.shadow.map = null
    }
  }

  setDirection(toSun: Vec3): void {
    this.toSun = toSun
  }

  /** Centers the shadow frustum on `focus` (the player's kart), snapped to the texel grid. */
  update(focus: THREE.Vector3): void {
    const texel = this.mapSize > 0 ? (2 * SHADOW_HALF_EXTENT) / this.mapSize : 0
    const [x, y, z] = snapFocusToTexelGrid([focus.x, focus.y, focus.z], this.toSun, texel)
    const [dx, dy, dz] = this.toSun
    this.sun.target.position.set(x, y, z)
    this.sun.position.set(
      x + dx * SHADOW_DISTANCE,
      y + dy * SHADOW_DISTANCE,
      z + dz * SHADOW_DISTANCE,
    )
    this.sun.target.updateMatrixWorld()
    this.sun.updateMatrixWorld()
  }
}

/** Outline hulls are drawn with back faces; they must neither cast nor receive shadows. */
function isOutline(mesh: THREE.Mesh): boolean {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  return material?.side === THREE.BackSide || mesh.name.endsWith('-outline')
}

/**
 * Flags every mesh under `root` as a shadow caster and/or receiver (only the flags given are
 * written), skipping outline hulls (inverted-hull meshes). Sprites, points and lines are not
 * meshes, so they are untouched.
 */
export function markShadows(
  root: THREE.Object3D,
  flags: { cast?: boolean; receive?: boolean },
): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || isOutline(object)) return
    if (flags.cast !== undefined) object.castShadow = flags.cast
    if (flags.receive !== undefined) object.receiveShadow = flags.receive
  })
}

const BLOB_POOL = 8
const BLOB_SIZE = 2.6
const BLOB_LIFT = 0.06
const BLOB_OPACITY = 0.45

function blobTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const g = canvas.getContext('2d')
  if (g) {
    const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(0,0,0,1)')
    gradient.addColorStop(0.55, 'rgba(0,0,0,0.7)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gradient
    g.fillRect(0, 0, 64, 64)
  }
  return new THREE.CanvasTexture(canvas)
}

/**
 * Cheap fake shadows for low quality: a dark soft circle on the ground under each kart.
 * One shared material and geometry; at most `BLOB_POOL` karts.
 */
export class BlobShadows {
  readonly object = new THREE.Group()
  private readonly meshes: THREE.Mesh[] = []
  private targets: readonly THREE.Object3D[] = []
  private on = false

  constructor() {
    this.object.name = 'blobShadows'
    const geometry = new THREE.PlaneGeometry(BLOB_SIZE, BLOB_SIZE)
    geometry.rotateX(-Math.PI / 2)
    const material = new THREE.MeshBasicMaterial({
      map: blobTexture(),
      transparent: true,
      opacity: BLOB_OPACITY,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      fog: false,
    })
    for (let i = 0; i < BLOB_POOL; i++) {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.visible = false
      mesh.renderOrder = 1
      this.meshes.push(mesh)
      this.object.add(mesh)
    }
  }

  setEnabled(on: boolean): void {
    this.on = on
    if (!on) for (const mesh of this.meshes) mesh.visible = false
  }

  /** The karts that get a blob (player first, then the bots). */
  setTargets(targets: readonly THREE.Object3D[]): void {
    this.targets = targets
  }

  /** Places each blob on the ground under its kart (`groundHeight` gives the road height). */
  update(groundHeight: (x: number, z: number) => number): void {
    if (!this.on) return
    this.meshes.forEach((mesh, i) => {
      const target = this.targets[i]
      mesh.visible = target !== undefined && target.visible
      if (!target || !target.visible) return
      const { x, y, z } = target.position
      mesh.position.set(x, Math.min(groundHeight(x, z), y) + BLOB_LIFT, z)
      mesh.rotation.y = target.rotation.y
    })
  }
}
