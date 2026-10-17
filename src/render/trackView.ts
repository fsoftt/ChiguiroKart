import * as THREE from 'three'
import { headingOf } from '../sim/math'
import type { Track, TrackBranch } from '../sim/track'
import type { SurfaceType } from '../sim/race/surface'
import { DEFAULT_THEME, type TrackTheme } from '../config/tracks/theme'
import { createBoostPads } from './boostPads'
import { createScenery } from './scenery/sceneryView'
import { markShadows } from './shadows'
import { EnvironmentView } from './environment/environmentView'
import { surfaceColor } from './surfaceColor'
import { tideSurface } from './tideLogic'
import {
  createBranchPath,
  createMainPath,
  offsetPath,
  overGap,
  segmentCount,
  type Path,
} from './trackPath'

/** Opacity of a flooded tidal branch and of the water plane. */
const WATER_OPACITY = 0.78

const CURB_WIDTH = 1
const WALL_HEIGHT = 0.8
const WALL_THICKNESS = 0.5
const ROAD_LIFT = 0.01
/** Branches sit a hair above the main road so overlapping junctions do not flicker. */
const BRANCH_LIFT = 0.015
const UP = new THREE.Vector3(0, 1, 0)
const GROUND_DEFAULT_Y = -0.05
/** Height of a jump ramp wedge at its lip edge (m). */
const RAMP_HEIGHT = 0.6
/** Rows the ramp wedge is cut into, so it follows a sloped road. */
const RAMP_ROWS = 4
/** The ground sinks this far below the water level, so the water tints it. */
const SEABED_DEPTH = 1.5

export interface TrackViewOptions {
  /** Share of the environment's plants to grow, 0..1 (see the quality table). */
  vegetationDensity?: number
}

interface TidalBranch {
  branch: TrackBranch
  material: THREE.MeshToonMaterial
}

/**
 * The 3D track: ground, water, road, curbs, walls, boost pads and scenery, all colored by
 * the theme. It is a group, so add it to the scene directly.
 *
 * Call `update()` once per frame: it recolors tidal branches when `track.tideLow` changed
 * (a compare per frame, a color write on a change). Everything else is static.
 */
export class TrackView extends THREE.Group {
  private readonly tidal: TidalBranch[] = []
  private shownLow: boolean | null = null
  /** Terrain, textured road, fence, plants and decoration, for themes that define them. */
  readonly environment: EnvironmentView | null = null

  constructor(
    private readonly track: Track,
    readonly theme: TrackTheme = DEFAULT_THEME,
    options: TrackViewOptions = {},
  ) {
    super()
    this.name = `track:${track.name}`
    const water = theme.water ? createWater(theme.water) : null
    if (water) this.add(water)
    if (theme.environment && !track.hasTide) {
      // Rich environment: it replaces the flat ground, plain road, curbs and walls
      this.environment = new EnvironmentView(
        track,
        theme,
        theme.environment,
        options.vegetationDensity ?? 1,
      )
      this.addFeatures(water)
      this.add(this.environment)
      this.update()
      return
    }
    this.add(createGround(theme))
    const main = createMainPath(track)
    this.add(createRoadRibbon(track, theme, main, ROAD_LIFT))
    this.add(createCurbs(track, theme, main, main.halfWidth - CURB_WIDTH, main.halfWidth))
    this.add(createCurbs(track, theme, main, -main.halfWidth, -main.halfWidth + CURB_WIDTH))
    this.add(createWall(track, theme, main, main.halfWidth))
    this.add(createWall(track, theme, main, -main.halfWidth - WALL_THICKNESS))
    track.branches.forEach((branch, index) => {
      const path = createBranchPath(track, branch, index)
      if (branch.tide) {
        const ribbon = createTidalRibbon(track, path)
        this.tidal.push({ branch, material: ribbon.material })
        this.add(ribbon.mesh)
      } else {
        this.add(createRoadRibbon(track, theme, path, BRANCH_LIFT))
      }
      this.add(createWall(track, theme, path, path.halfWidth))
      this.add(createWall(track, theme, path, -path.halfWidth - WALL_THICKNESS))
    })
    this.addFeatures(water)
    this.add(createScenery(track, theme))
    this.update()
  }

  /** Jump ramps, start line and boost pads; they receive shadows like the road. */
  private addFeatures(water: THREE.Mesh | null): void {
    const { track, theme } = this
    if (track.jumps.length > 0) this.add(createJumpRamps(track, theme))
    this.add(createStartLine(track))
    if (track.boostPads.length > 0) this.add(createBoostPads(track))
    // Ground, road, curbs, walls and ramps receive; scenery (added next) only casts
    markShadows(this, { receive: true })
    if (water) water.receiveShadow = false
  }

  /** Changes the share of plants that grow (quality); a no-op without an environment. */
  setVegetationDensity(density: number): void {
    this.environment?.setDensity(density)
  }

  /** Shows the tide of the moment: recolors tidal branches if `track.tideLow` changed. */
  update(): void {
    this.environment?.update(performance.now() / 1000)
    const low = this.track.tideLow
    if (low === this.shownLow) return
    this.shownLow = low
    for (const { branch, material } of this.tidal) {
      if (!branch.tide) continue
      const surface = tideSurface(branch.tide, low)
      const flooded = surface === 'water'
      material.color.set(surfaceColor(surface, this.theme))
      material.opacity = flooded ? WATER_OPACITY : 1
      material.transparent = flooded
      material.depthWrite = !flooded
    }
  }
}

/**
 * Builds the 3D track for a theme. The result is a group (`TrackView`); call its `update()`
 * every frame so tidal branches follow `track.tideLow`.
 */
export function createTrackView(
  track: Track,
  theme: TrackTheme = DEFAULT_THEME,
  options: TrackViewOptions = {},
): TrackView {
  return new TrackView(track, theme, options)
}

function toon(color: string): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color })
}

function createGround(theme: TrackTheme): THREE.Mesh {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), toon(theme.ground))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = theme.water ? theme.water.level - SEABED_DEPTH : GROUND_DEFAULT_Y
  return ground
}

/** The sea, lake or river: a see-through plane over the whole map. */
function createWater(water: { level: number; color: string }): THREE.Mesh {
  const material = new THREE.MeshToonMaterial({
    color: water.color,
    transparent: true,
    opacity: WATER_OPACITY,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = water.level
  return mesh
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

    // No road over a jump gap; the edges keep the height of the whole road (no sheet falls)
    if (overGap(track, path, i)) continue

    const ya0 = track.roadHeight(a0.x, a0.z) + yOffset
    const ya1 = track.roadHeight(a1.x, a1.z) + yOffset
    const yb0 = track.roadHeight(b0.x, b0.z) + yOffset
    const yb1 = track.roadHeight(b1.x, b1.z) + yOffset

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

function createRoadRibbon(track: Track, theme: TrackTheme, path: Path, lift: number): THREE.Mesh {
  const colors = new Map<SurfaceType, THREE.Color>()
  const colorOf = (surface: SurfaceType): THREE.Color => {
    let color = colors.get(surface)
    if (!color) {
      color = new THREE.Color(surfaceColor(surface, theme))
      colors.set(surface, color)
    }
    return color
  }
  const geometry = stripGeometry(track, path, -path.halfWidth, path.halfWidth, lift, (segment) =>
    colorOf(path.surfaceAt(segment)),
  )
  const material = new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide })
  return new THREE.Mesh(geometry, material)
}

/** Road of a tidal branch: one material whose color `TrackView.update` changes with the tide. */
function createTidalRibbon(
  track: Track,
  path: Path,
): { mesh: THREE.Mesh; material: THREE.MeshToonMaterial } {
  const geometry = stripGeometry(track, path, -path.halfWidth, path.halfWidth, BRANCH_LIFT)
  const material = new THREE.MeshToonMaterial({ side: THREE.DoubleSide })
  return { mesh: new THREE.Mesh(geometry, material), material }
}

function createCurbs(
  track: Track,
  theme: TrackTheme,
  path: Path,
  inner: number,
  outer: number,
): THREE.Mesh {
  const palette = theme.curb.map((c) => new THREE.Color(c))
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

function createWall(track: Track, theme: TrackTheme, path: Path, offset: number): THREE.Mesh {
  const near = offsetPath(path, offset)
  const far = offsetPath(path, offset + WALL_THICKNESS)
  const positions: number[] = []

  for (let i = 0; i < segmentCount(path); i++) {
    const [n0, n1, f0, f1] = [near[i], near[i + 1], far[i], far[i + 1]]
    if (!n0 || !n1 || !f0 || !f1) continue
    if (path.openAt({ x: (n0.x + n1.x) / 2, z: (n0.z + n1.z) / 2 })) continue

    const yn0 = track.roadHeight(n0.x, n0.z)
    const yn1 = track.roadHeight(n1.x, n1.z)
    const yf0 = track.roadHeight(f0.x, f0.z)
    const yf1 = track.roadHeight(f1.x, f1.z)

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
  const wall = new THREE.Mesh(
    geometry,
    new THREE.MeshToonMaterial({ color: theme.wall, side: THREE.DoubleSide }),
  )
  wall.castShadow = true
  return wall
}

/**
 * A wedge at each jump lip: it rises from the road to `RAMP_HEIGHT` at the edge, across the
 * whole road. It is only a visual cue; the launch itself comes from the simulation.
 */
function createJumpRamps(track: Track, theme: TrackTheme): THREE.Mesh {
  const positions: number[] = []
  for (const jump of track.jumps) {
    const forward = { x: Math.sin(jump.heading), z: Math.cos(jump.heading) }
    const right = { x: forward.z, z: -forward.x }
    const point = (u: number, v: number, rise: number): [number, number, number] => {
      const x = jump.position.x + right.x * u + forward.x * v
      const z = jump.position.z + right.z * u + forward.z * v
      return [x, track.roadHeight(x, z) + ROAD_LIFT + rise, z]
    }
    const rise = (row: number): number => (RAMP_HEIGHT * row) / RAMP_ROWS
    const quad = (a: number[], b: number[], c: number[], d: number[]): void => {
      positions.push(...a, ...b, ...c, ...a, ...c, ...d)
    }
    const hw = jump.halfWidth
    for (let row = 0; row < RAMP_ROWS; row++) {
      const v0 = -jump.length + (jump.length * row) / RAMP_ROWS
      const v1 = -jump.length + (jump.length * (row + 1)) / RAMP_ROWS
      // Top, then the two sides
      quad(
        point(-hw, v0, rise(row)),
        point(hw, v0, rise(row)),
        point(hw, v1, rise(row + 1)),
        point(-hw, v1, rise(row + 1)),
      )
      for (const u of [-hw, hw]) {
        quad(point(u, v0, 0), point(u, v1, 0), point(u, v1, rise(row + 1)), point(u, v0, rise(row)))
      }
    }
    // Front face at the edge
    quad(point(-hw, 0, 0), point(hw, 0, 0), point(hw, 0, RAMP_HEIGHT), point(-hw, 0, RAMP_HEIGHT))
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  const material = new THREE.MeshToonMaterial({
    color: theme.curb[0] ?? theme.wall,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'jumpRamps'
  mesh.castShadow = true
  return mesh
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
