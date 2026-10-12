import * as THREE from 'three'
import { headingOf, type Vec2 } from '../sim/math'
import type { Track } from '../sim/track'

const ROAD_COLOR = '#5b5f66'
const GRASS_COLOR = '#6cbf4a'
const CURB_COLORS = ['#e8413c', '#ffffff'] as const
const WALL_COLOR = '#f2c14e'
const TREE_TRUNK_COLOR = '#8b5a2b'
const TREE_LEAVES_COLOR = '#2f8f3a'

const CURB_WIDTH = 1
const WALL_HEIGHT = 0.8
const WALL_THICKNESS = 0.5
const TREE_COUNT = 260
const TREE_MIN_GAP = 6
const TREE_SPREAD = 60
const UP = new THREE.Vector3(0, 1, 0)

/** Builds the 3D scenery for a track: ground, road, curbs, walls and trees. */
export function createTrackView(track: Track): THREE.Group {
  const group = new THREE.Group()
  group.name = `track:${track.name}`
  group.add(createGround())
  group.add(createRibbon(track, -track.halfWidth, track.halfWidth, 0.01, ROAD_COLOR))
  group.add(createCurbs(track, track.halfWidth - CURB_WIDTH, track.halfWidth))
  group.add(createCurbs(track, -track.halfWidth, -track.halfWidth + CURB_WIDTH))
  group.add(createWall(track, track.halfWidth))
  group.add(createWall(track, -track.halfWidth - WALL_THICKNESS))
  group.add(createStartLine(track))
  group.add(createTrees(track))
  return group
}

function toon(color: string): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color })
}

function createGround(): THREE.Mesh {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), toon(GRASS_COLOR))
  ground.rotation.x = -Math.PI / 2
  return ground
}

/** Unit vector perpendicular to the road at point `i`, pointing to the driver's left. */
function sideAt(track: Track, i: number): Vec2 {
  const before = track.point(i - 1)
  const after = track.point(i + 1)
  const dx = after.x - before.x
  const dz = after.z - before.z
  const length = Math.hypot(dx, dz) || 1
  return { x: dz / length, z: -dx / length }
}

/** Points offset sideways from the centerline, one per centerline point plus a closing one. */
function offsetLoop(track: Track, offset: number): Vec2[] {
  return Array.from({ length: track.centerline.length + 1 }, (_, i) => {
    const point = track.point(i)
    const side = sideAt(track, i)
    return { x: point.x + side.x * offset, z: point.z + side.z * offset }
  })
}

/** Flat strip between two sideways offsets, optionally split into colored segments. */
function stripGeometry(
  track: Track,
  inner: number,
  outer: number,
  y: number,
  colorAt?: (segment: number) => THREE.Color,
): THREE.BufferGeometry {
  const a = offsetLoop(track, inner)
  const b = offsetLoop(track, outer)
  const positions: number[] = []
  const colors: number[] = []
  for (let i = 0; i < track.centerline.length; i++) {
    const [a0, a1, b0, b1] = [a[i], a[i + 1], b[i], b[i + 1]]
    if (!a0 || !a1 || !b0 || !b1) continue
    // Two triangles per segment, wound to face up
    for (const p of [a0, b0, a1, a1, b0, b1]) positions.push(p.x, y, p.z)
    if (colorAt) {
      const color = colorAt(i)
      for (let v = 0; v < 6; v++) colors.push(color.r, color.g, color.b)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  if (colorAt) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

function createRibbon(
  track: Track,
  inner: number,
  outer: number,
  y: number,
  color: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(stripGeometry(track, inner, outer, y), toon(color))
  mesh.material.side = THREE.DoubleSide
  return mesh
}

function createCurbs(track: Track, inner: number, outer: number): THREE.Mesh {
  const palette = CURB_COLORS.map((c) => new THREE.Color(c))
  const geometry = stripGeometry(
    track,
    inner,
    outer,
    0.02,
    (segment) => palette[segment % palette.length] ?? new THREE.Color(),
  )
  const material = new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide })
  return new THREE.Mesh(geometry, material)
}

function createWall(track: Track, offset: number): THREE.Mesh {
  const near = offsetLoop(track, offset)
  const far = offsetLoop(track, offset + WALL_THICKNESS)
  const positions: number[] = []
  for (let i = 0; i < track.centerline.length; i++) {
    const [n0, n1, f0, f1] = [near[i], near[i + 1], far[i], far[i + 1]]
    if (!n0 || !n1 || !f0 || !f1) continue
    for (const [p, q] of [
      [n0, n1],
      [f1, f0],
    ] as const) {
      // Vertical face from p to q
      positions.push(p.x, 0, p.z, q.x, 0, q.z, p.x, WALL_HEIGHT, p.z)
      positions.push(p.x, WALL_HEIGHT, p.z, q.x, 0, q.z, q.x, WALL_HEIGHT, q.z)
    }
    // Top face
    positions.push(n0.x, WALL_HEIGHT, n0.z, f0.x, WALL_HEIGHT, f0.z, n1.x, WALL_HEIGHT, n1.z)
    positions.push(n1.x, WALL_HEIGHT, n1.z, f0.x, WALL_HEIGHT, f0.z, f1.x, WALL_HEIGHT, f1.z)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return new THREE.Mesh(
    geometry,
    new THREE.MeshToonMaterial({ color: WALL_COLOR, side: THREE.DoubleSide }),
  )
}

function createStartLine(track: Track): THREE.Mesh {
  const start = track.point(0)
  const next = track.point(1)
  const squares = 8
  const canvas = document.createElement('canvas')
  canvas.width = squares * 8
  canvas.height = 16
  const context = canvas.getContext('2d')
  if (context) {
    for (let x = 0; x < squares * 2; x++) {
      for (let y = 0; y < 2; y++) {
        context.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#111111'
        context.fillRect(x * 4, y * 8, 4, 8)
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(track.halfWidth * 2, 2),
    new THREE.MeshBasicMaterial({ map: texture }),
  )
  line.rotation.x = -Math.PI / 2
  // Lay the stripe across the road: its width follows the driver's left/right
  line.rotateOnWorldAxis(UP, headingOf(next.x - start.x, next.z - start.z))
  line.position.set(start.x, 0.03, start.z)
  return line
}

/** Small deterministic random generator so the scenery is the same on every load. */
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function createTrees(track: Track): THREE.Group {
  const random = seededRandom(42)
  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.3, 0.4, 2, 6),
    toon(TREE_TRUNK_COLOR),
    TREE_COUNT,
  )
  const leaves = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.8, 4, 7),
    toon(TREE_LEAVES_COLOR),
    TREE_COUNT,
  )
  const matrix = new THREE.Matrix4()
  const minDistance = track.halfWidth + TREE_MIN_GAP

  let placed = 0
  for (let attempt = 0; placed < TREE_COUNT && attempt < TREE_COUNT * 10; attempt++) {
    const anchor = track.point(Math.floor(random() * track.centerline.length))
    const x = anchor.x + (random() - 0.5) * TREE_SPREAD * 2
    const z = anchor.z + (random() - 0.5) * TREE_SPREAD * 2
    if (track.project(x, z).distance < minDistance) continue
    const scale = 0.8 + random() * 0.8
    matrix.makeScale(scale, scale, scale).setPosition(x, scale, z)
    trunk.setMatrixAt(placed, matrix)
    matrix.makeScale(scale, scale, scale).setPosition(x, scale * 4, z)
    leaves.setMatrixAt(placed, matrix)
    placed++
  }
  trunk.count = placed
  leaves.count = placed

  const group = new THREE.Group()
  group.add(trunk, leaves)
  return group
}
