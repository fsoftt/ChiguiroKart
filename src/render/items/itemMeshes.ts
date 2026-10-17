import * as THREE from 'three'
import type { EntityKind } from '../../sim/items/itemTypes'

/** A pooled mesh of one thrown or dropped power, with the parts the view animates. */
export interface EntityVisual {
  readonly kind: EntityKind
  readonly group: THREE.Group
  /** Child that spins or rolls. */
  readonly spinner: THREE.Object3D
  /** Wings that flap (avispa, colibri). */
  readonly wings: THREE.Object3D[]
}

const toonCache = new Map<string, THREE.MeshToonMaterial>()

/** Shared toon material per color. */
export function toon(color: string): THREE.MeshToonMaterial {
  let material = toonCache.get(color)
  if (!material) {
    material = new THREE.MeshToonMaterial({ color })
    toonCache.set(color, material)
  }
  return material
}

const sphere = new THREE.SphereGeometry(0.5, 14, 10)
const box = new THREE.BoxGeometry(1, 1, 1)
const cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 16)
const cone = new THREE.ConeGeometry(0.5, 1, 8)
const plane = new THREE.PlaneGeometry(1, 1)
const torus = new THREE.TorusGeometry(0.5, 0.08, 6, 16)
const wingMaterial = new THREE.MeshBasicMaterial({
  color: '#e6f4ff',
  transparent: true,
  opacity: 0.6,
  side: THREE.DoubleSide,
})

function part(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  scale: readonly [number, number, number],
  position: readonly [number, number, number] = [0, 0, 0],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.scale.set(...scale)
  mesh.position.set(...position)
  return mesh
}

function wing(x: number, y: number, z: number, size: number): THREE.Mesh {
  const mesh = part(plane, wingMaterial, [size, size * 1.4, 1], [x, y, z])
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

function buildBody(kind: EntityKind, spinner: THREE.Group, wings: THREE.Object3D[]): void {
  switch (kind) {
    case 'coco':
      spinner.add(part(sphere, toon('#6b4226'), [0.9, 0.9, 0.9]))
      spinner.add(part(sphere, toon('#2b1a0e'), [0.14, 0.14, 0.14], [0.18, 0.3, 0.36]))
      spinner.add(part(sphere, toon('#2b1a0e'), [0.14, 0.14, 0.14], [-0.18, 0.3, 0.36]))
      break
    case 'tejo':
      spinner.add(part(cylinder, toon('#8a8f98'), [1, 0.14, 1]))
      spinner.add(part(sphere, toon('#e02020'), [0.18, 0.18, 0.18], [0.3, 0.12, 0]))
      break
    case 'mango':
      spinner.add(part(sphere, toon('#f2c230'), [0.8, 0.7, 1]))
      spinner.add(part(sphere, toon('#e8602c'), [0.45, 0.4, 0.5], [0.12, 0.08, 0.2]))
      break
    case 'armadillo':
      spinner.add(part(sphere, toon('#8d8f96'), [1, 0.75, 1.2]))
      for (const z of [-0.15, 0.15]) {
        const band = part(torus, toon('#5b5d63'), [1.5, 1.5, 1.5], [0, 0, z])
        spinner.add(band)
      }
      break
    case 'avispa': {
      spinner.add(part(sphere, toon('#f5d020'), [0.5, 0.45, 0.8]))
      const stripe = part(torus, toon('#1a1a1a'), [0.9, 0.9, 0.9], [0, 0, -0.05])
      stripe.rotation.x = 0
      spinner.add(stripe)
      spinner.add(part(sphere, toon('#1a1a1a'), [0.3, 0.3, 0.3], [0, 0.02, 0.45]))
      for (const side of [-1, 1]) {
        const w = wing(side * 0.3, 0.25, -0.05, 0.4)
        wings.push(w)
        spinner.add(w)
      }
      break
    }
    case 'colibri': {
      spinner.add(part(sphere, toon('#2faa4a'), [0.45, 0.4, 0.8]))
      spinner.add(part(sphere, toon('#1f7a35'), [0.3, 0.3, 0.3], [0, 0.12, 0.4]))
      const beak = part(cone, toon('#222222'), [0.08, 0.5, 0.08], [0, 0.1, 0.7])
      beak.rotation.x = Math.PI / 2
      spinner.add(beak)
      for (const side of [-1, 1]) {
        const w = wing(side * 0.45, 0.2, -0.05, 0.55)
        wings.push(w)
        spinner.add(w)
      }
      break
    }
    case 'sombrero':
      spinner.add(part(cylinder, toon('#e8d8a8'), [1.6, 0.08, 1.6]))
      spinner.add(part(cylinder, toon('#1a1a1a'), [0.7, 0.4, 0.7], [0, 0.22, 0]))
      spinner.add(part(cylinder, toon('#e8d8a8'), [0.74, 0.08, 0.74], [0, 0.1, 0]))
      break
    case 'hormigas':
      for (let i = 0; i < 8; i++) {
        const angle = i * 2.4
        const r = 0.15 + (i % 4) * 0.12
        spinner.add(
          part(
            sphere,
            toon(i % 2 === 0 ? '#8a2e1a' : '#5a1c10'),
            [0.2, 0.16, 0.26],
            [Math.cos(angle) * r, 0.05, Math.sin(angle) * r],
          ),
        )
      }
      break
  }
}

/** Lift above the entity position, so ground-hugging shapes do not sink into the road. */
const LIFT: Record<EntityKind, number> = {
  coco: 0.5,
  tejo: 0.12,
  mango: 0.45,
  armadillo: 0.45,
  avispa: 1.2,
  colibri: 1.5,
  sombrero: 0.9,
  hormigas: 0.1,
}

const CHARGED_SCALE = 1.3

export function createEntityVisual(kind: EntityKind): EntityVisual {
  const group = new THREE.Group()
  const spinner = new THREE.Group()
  const wings: THREE.Object3D[] = []
  spinner.position.y = LIFT[kind]
  buildBody(kind, spinner, wings)
  group.add(spinner)
  return { kind, group, spinner, wings }
}

export function entityScale(charged: boolean): number {
  return charged ? CHARGED_SCALE : 1
}

/** Canvas texture with a big "?" for the power boxes. */
function questionTexture(): THREE.Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.font = 'bold 56px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 6
    ctx.strokeStyle = '#1b1033'
    ctx.strokeText('?', size / 2, size / 2 + 3)
    ctx.fillStyle = '#ffffff'
    ctx.fillText('?', size / 2, size / 2 + 3)
  }
  return new THREE.CanvasTexture(canvas)
}

export interface BoxVisual {
  readonly group: THREE.Group
  readonly cube: THREE.Mesh
}

/** Translucent cube (its color is cycled by the view through the shared material). */
export function createBoxVisual(material: THREE.Material, label: THREE.SpriteMaterial): BoxVisual {
  const group = new THREE.Group()
  const cube = part(box, material, [1.3, 1.3, 1.3])
  const sprite = new THREE.Sprite(label)
  sprite.scale.set(1, 1, 1)
  group.add(cube, sprite)
  return { group, cube }
}

export function createBoxMaterials(): {
  cube: THREE.MeshBasicMaterial
  label: THREE.SpriteMaterial
} {
  return {
    cube: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }),
    label: new THREE.SpriteMaterial({
      map: questionTexture(),
      depthWrite: false,
      depthTest: false,
    }),
  }
}

export interface UchuvaVisual {
  readonly group: THREE.Group
}

const huskMaterial = new THREE.MeshToonMaterial({
  color: '#e8d8a0',
  transparent: true,
  opacity: 0.4,
})
const huskGeometry = new THREE.IcosahedronGeometry(0.5, 0)

/** Orange-golden berry inside a papery husk. */
export function createUchuvaVisual(): UchuvaVisual {
  const group = new THREE.Group()
  group.add(part(sphere, toon('#ff9d1c'), [0.55, 0.55, 0.55]))
  group.add(part(huskGeometry, huskMaterial, [0.95, 1.1, 0.95]))
  return { group }
}
