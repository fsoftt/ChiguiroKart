import * as THREE from 'three'
import { headingOf, type Vec2 } from '../sim/math'
import type { Track } from '../sim/track'
import type { SurfaceType } from '../sim/race/surface'
import { DEFAULT_THEME, type TrackTheme } from '../config/tracks/theme'

const ROAD_COLOR = '#5b5f66'
const WOOD_COLOR = '#8d5524'
const MUD_COLOR = '#5c3a21'
const GRASS_COLOR = '#4a9934'
const CURB_COLORS = ['#e8413c', '#ffffff'] as const
const WALL_COLOR = '#e5b842'
const TREE_TRUNK_COLOR = '#8b5a2b'
const TREE_LEAVES_COLOR = '#2f8f3a'
const PALM_TRUNK_COLOR = '#cfcbbd'
const PALM_FROND_COLOR = '#207833'

const CURB_WIDTH = 1
const WALL_HEIGHT = 0.8
const WALL_THICKNESS = 0.5
const TREE_COUNT = 240
const TREE_MIN_GAP = 6
const TREE_SPREAD = 70
const UP = new THREE.Vector3(0, 1, 0)

/** Builds the 3D scenery for a track: ground, road, curbs, walls and foliage. */
// TODO(stage 9): use the theme for colors and scenery
export function createTrackView(track: Track, theme: TrackTheme = DEFAULT_THEME): THREE.Group {
  const group = new THREE.Group()
  group.name = `track:${track.name}`
  group.userData.theme = theme
  group.add(createGround())
  const main: Path = {
    points: track.centerline,
    closed: true,
    halfWidth: track.halfWidth,
    surfaceAt: (i) => track.surfaceAt(track.point(i).x, track.point(i).z),
    // Leave the road open where a branch joins it
    openAt: (p) => {
      const projection = track.project(p.x, p.z)
      return projection.branch >= 0 && projection.distance <= projection.halfWidth
    },
  }
  group.add(createRoadRibbon(track, main))
  group.add(createCurbs(track, main, main.halfWidth - CURB_WIDTH, main.halfWidth))
  group.add(createCurbs(track, main, -main.halfWidth, -main.halfWidth + CURB_WIDTH))
  group.add(createWall(track, main, main.halfWidth))
  group.add(createWall(track, main, -main.halfWidth - WALL_THICKNESS))
  for (const branch of track.branches) {
    const path: Path = {
      points: branch.points,
      closed: false,
      halfWidth: branch.halfWidth,
      surfaceAt: () => branch.surface,
      // Leave the branch open where it meets the main road
      openAt: (p) => track.mainProjection(p.x, p.z).distance <= track.halfWidth,
    }
    group.add(createRoadRibbon(track, path))
    group.add(createWall(track, path, path.halfWidth))
    group.add(createWall(track, path, -path.halfWidth - WALL_THICKNESS))
  }
  group.add(createStartLine(track))
  group.add(createFoliage(track))
  return group
}

function toon(color: string): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color })
}

function createGround(): THREE.Mesh {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), toon(GRASS_COLOR))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.05
  return ground
}

/** A road piece (main loop or branch) that can be drawn as a ribbon with walls. */
interface Path {
  points: readonly Vec2[]
  closed: boolean
  halfWidth: number
  surfaceAt: (segment: number) => SurfaceType
  /** True where walls and curbs must be left out (junction openings). */
  openAt: (point: Vec2) => boolean
}

function pathPoint(path: Path, i: number): Vec2 {
  const count = path.points.length
  const index = path.closed ? ((i % count) + count) % count : Math.min(Math.max(i, 0), count - 1)
  const point = path.points[index]
  if (!point) throw new Error(`Missing path point ${i}`)
  return point
}

function segmentCount(path: Path): number {
  return path.closed ? path.points.length : path.points.length - 1
}

function sideAt(path: Path, i: number): Vec2 {
  const before = pathPoint(path, i - 1)
  const after = pathPoint(path, i + 1)
  const dx = after.x - before.x
  const dz = after.z - before.z
  const length = Math.hypot(dx, dz) || 1
  return { x: dz / length, z: -dx / length }
}

function offsetPath(path: Path, offset: number): Vec2[] {
  return Array.from({ length: segmentCount(path) + 1 }, (_, i) => {
    const point = pathPoint(path, i)
    const side = sideAt(path, i)
    return { x: point.x + side.x * offset, z: point.z + side.z * offset }
  })
}

/** 3D strip between two sideways offsets, conforming to track elevation. */
function stripGeometry(
  track: Track,
  path: Path,
  inner: number,
  outer: number,
  yOffset: number,
  colorAt?: (segment: number) => THREE.Color,
  skipOpenings = false,
): THREE.BufferGeometry {
  const a = offsetPath(path, inner)
  const b = offsetPath(path, outer)
  const positions: number[] = []
  const colors: number[] = []

  for (let i = 0; i < segmentCount(path); i++) {
    const [a0, a1, b0, b1] = [a[i], a[i + 1], b[i], b[i + 1]]
    if (!a0 || !a1 || !b0 || !b1) continue
    if (
      skipOpenings &&
      path.openAt({ x: (a0.x + a1.x + b0.x + b1.x) / 4, z: (a0.z + a1.z + b0.z + b1.z) / 4 })
    )
      continue

    const ya0 = track.groundHeight(a0.x, a0.z) + yOffset
    const ya1 = track.groundHeight(a1.x, a1.z) + yOffset
    const yb0 = track.groundHeight(b0.x, b0.z) + yOffset
    const yb1 = track.groundHeight(b1.x, b1.z) + yOffset

    // Two triangles per segment
    positions.push(
      a0.x,
      ya0,
      a0.z,
      b0.x,
      yb0,
      b0.z,
      a1.x,
      ya1,
      a1.z,

      a1.x,
      ya1,
      a1.z,
      b0.x,
      yb0,
      b0.z,
      b1.x,
      yb1,
      b1.z,
    )

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

function createRoadRibbon(track: Track, path: Path): THREE.Mesh {
  const asphaltCol = new THREE.Color(ROAD_COLOR)
  const woodCol = new THREE.Color(WOOD_COLOR)
  const mudCol = new THREE.Color(MUD_COLOR)

  const geometry = stripGeometry(track, path, -path.halfWidth, path.halfWidth, 0.01, (segment) => {
    const surface = path.surfaceAt(segment)
    if (surface === 'wood') return woodCol
    if (surface === 'mud') return mudCol
    return asphaltCol
  })
  const material = new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide })
  return new THREE.Mesh(geometry, material)
}

function createCurbs(track: Track, path: Path, inner: number, outer: number): THREE.Mesh {
  const palette = CURB_COLORS.map((c) => new THREE.Color(c))
  const geometry = stripGeometry(
    track,
    path,
    inner,
    outer,
    0.02,
    (segment) => palette[segment % palette.length] ?? new THREE.Color(),
    true,
  )
  const material = new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide })
  return new THREE.Mesh(geometry, material)
}

function createWall(track: Track, path: Path, offset: number): THREE.Mesh {
  const near = offsetPath(path, offset)
  const far = offsetPath(path, offset + WALL_THICKNESS)
  const positions: number[] = []

  for (let i = 0; i < segmentCount(path); i++) {
    const [n0, n1, f0, f1] = [near[i], near[i + 1], far[i], far[i + 1]]
    if (!n0 || !n1 || !f0 || !f1) continue
    if (path.openAt({ x: (n0.x + n1.x) / 2, z: (n0.z + n1.z) / 2 })) continue

    const yn0 = track.groundHeight(n0.x, n0.z)
    const yn1 = track.groundHeight(n1.x, n1.z)
    const yf0 = track.groundHeight(f0.x, f0.z)
    const yf1 = track.groundHeight(f1.x, f1.z)

    // Near face
    positions.push(
      n0.x,
      yn0,
      n0.z,
      n1.x,
      yn1,
      n1.z,
      n0.x,
      yn0 + WALL_HEIGHT,
      n0.z,

      n0.x,
      yn0 + WALL_HEIGHT,
      n0.z,
      n1.x,
      yn1,
      n1.z,
      n1.x,
      yn1 + WALL_HEIGHT,
      n1.z,
    )

    // Far face
    positions.push(
      f1.x,
      yf1,
      f1.z,
      f0.x,
      yf0,
      f0.z,
      f1.x,
      yf1 + WALL_HEIGHT,
      f1.z,

      f1.x,
      yf1 + WALL_HEIGHT,
      f1.z,
      f0.x,
      yf0,
      f0.z,
      f0.x,
      yf0 + WALL_HEIGHT,
      f0.z,
    )

    // Top face
    positions.push(
      n0.x,
      yn0 + WALL_HEIGHT,
      n0.z,
      f0.x,
      yf0 + WALL_HEIGHT,
      f0.z,
      n1.x,
      yn1 + WALL_HEIGHT,
      n1.z,

      n1.x,
      yn1 + WALL_HEIGHT,
      n1.z,
      f0.x,
      yf0 + WALL_HEIGHT,
      f0.z,
      f1.x,
      yf1 + WALL_HEIGHT,
      f1.z,
    )
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
    new THREE.PlaneGeometry(track.halfWidth * 2, 2.5),
    new THREE.MeshBasicMaterial({ map: texture }),
  )
  line.rotation.x = -Math.PI / 2
  line.rotateOnWorldAxis(UP, headingOf(next.x - start.x, next.z - start.z))
  line.position.set(start.x, track.groundHeight(start.x, start.z) + 0.03, start.z)
  return line
}

function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

/** Generates signature wax palms for Cocora, or pine trees for other tracks. */
function createFoliage(track: Track): THREE.Group {
  const isCocora = track.name.toLowerCase().includes('cocora')
  const random = seededRandom(42)

  const trunkGeo = isCocora
    ? new THREE.CylinderGeometry(0.2, 0.35, 14, 6)
    : new THREE.CylinderGeometry(0.3, 0.4, 2, 6)

  const leavesGeo = isCocora
    ? new THREE.ConeGeometry(2.8, 2.0, 7) // tuft crown of palm leaves
    : new THREE.ConeGeometry(1.8, 4, 7)

  const trunk = new THREE.InstancedMesh(
    trunkGeo,
    toon(isCocora ? PALM_TRUNK_COLOR : TREE_TRUNK_COLOR),
    TREE_COUNT,
  )
  const leaves = new THREE.InstancedMesh(
    leavesGeo,
    toon(isCocora ? PALM_FROND_COLOR : TREE_LEAVES_COLOR),
    TREE_COUNT,
  )

  const matrix = new THREE.Matrix4()

  let placed = 0
  for (let attempt = 0; placed < TREE_COUNT && attempt < TREE_COUNT * 12; attempt++) {
    const anchor = track.point(Math.floor(random() * track.centerline.length))
    const x = anchor.x + (random() - 0.5) * TREE_SPREAD * 2
    const z = anchor.z + (random() - 0.5) * TREE_SPREAD * 2
    const nearest = track.project(x, z)
    if (nearest.distance - nearest.halfWidth < TREE_MIN_GAP) continue

    const groundY = track.groundHeight(x, z)
    const scale = isCocora ? 0.9 + random() * 0.7 : 0.8 + random() * 0.8
    const height = isCocora ? 14 * scale : 2 * scale

    // Trunk centered at groundY + height / 2
    matrix.makeScale(scale, scale, scale).setPosition(x, groundY + height / 2, z)
    trunk.setMatrixAt(placed, matrix)

    // Crown placed on top of trunk
    const crownY = isCocora ? groundY + height : groundY + scale * 4
    matrix.makeScale(scale, scale, scale).setPosition(x, crownY, z)
    leaves.setMatrixAt(placed, matrix)

    placed++
  }

  trunk.count = placed
  leaves.count = placed

  const group = new THREE.Group()
  group.add(trunk, leaves)
  return group
}
