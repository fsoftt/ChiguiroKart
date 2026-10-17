import * as THREE from 'three'
import type { RacerStatus } from '../../sim/items/itemTypes'
import { cycleHue, orbitOffset } from './itemViewLogic'
import { toon } from './itemMeshes'

const SWARM_DOTS = 8
const SWARM_RADIUS = 1.5
const CLOUD_HEIGHT = 3.2
const BUBBLE_RADIUS = 1.7

const sphere = new THREE.SphereGeometry(1, 16, 12)
const dot = new THREE.SphereGeometry(0.09, 6, 5)
const bubbleMaterial = new THREE.MeshBasicMaterial({
  color: '#8fd8ff',
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
})
const dotMaterial = new THREE.MeshBasicMaterial({ color: '#111111' })

/** Visuals attached to one kart: shield bubble, rain cloud, mosquito swarm and mask aura. */
export class RacerStatusView {
  readonly object = new THREE.Group()
  private readonly bubble = new THREE.Mesh(sphere, bubbleMaterial)
  private readonly cloud = new THREE.Group()
  private readonly swarm = new THREE.Group()
  private readonly swarmDots: THREE.Mesh[] = []
  private readonly aura: THREE.Mesh
  private readonly auraMaterial = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  })
  private readonly offset = { x: 0, y: 0, z: 0 }

  constructor() {
    this.bubble.scale.setScalar(BUBBLE_RADIUS)
    this.bubble.position.y = 0.8

    this.aura = new THREE.Mesh(sphere, this.auraMaterial)
    this.aura.scale.setScalar(BUBBLE_RADIUS * 1.05)
    this.aura.position.y = 0.8

    for (const [x, y, z, size] of [
      [0, 0, 0, 0.9],
      [0.8, -0.15, 0.2, 0.65],
      [-0.8, -0.1, -0.1, 0.7],
      [0.2, 0.3, -0.5, 0.6],
    ] as const) {
      const puff = new THREE.Mesh(sphere, toon('#7b8590'))
      puff.position.set(x, y, z)
      puff.scale.setScalar(size)
      this.cloud.add(puff)
    }
    this.cloud.position.y = CLOUD_HEIGHT

    this.swarm.position.y = 1
    for (let i = 0; i < SWARM_DOTS; i++) {
      const mesh = new THREE.Mesh(dot, dotMaterial)
      this.swarmDots.push(mesh)
      this.swarm.add(mesh)
    }

    this.bubble.visible = false
    this.aura.visible = false
    this.cloud.visible = false
    this.swarm.visible = false
    this.object.add(this.bubble, this.aura, this.cloud, this.swarm)
  }

  update(status: RacerStatus, time: number): void {
    const shield = status.shieldHits > 0
    this.bubble.visible = shield
    if (shield) this.bubble.scale.setScalar(BUBBLE_RADIUS * (1 + Math.sin(time * 6) * 0.03))

    const masked = status.maskTime > 0
    this.aura.visible = masked
    if (masked) this.auraMaterial.color.setHSL(cycleHue(time, 0.9), 0.95, 0.6)

    const raining = status.rainTime > 0
    this.cloud.visible = raining
    if (raining) this.cloud.rotation.y = time * 0.8

    const blinded = status.blindTime > 0
    this.swarm.visible = blinded
    if (blinded) {
      for (let i = 0; i < this.swarmDots.length; i++) {
        orbitOffset(i, this.swarmDots.length, time, SWARM_RADIUS, this.offset)
        this.swarmDots[i]?.position.set(this.offset.x, this.offset.y, this.offset.z)
      }
    }
  }
}
