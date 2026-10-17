import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { TrackEnvironment } from '../../config/tracks/environment'
import type { TrackTheme } from '../../config/tracks/theme'
import type { SurfaceType } from '../../sim/race/surface'
import type { Track } from '../../sim/track'
import { createBranchPath, createMainPath, resamplePolyline, type Path } from '../trackPath'
import { surfaceColor } from '../surfaceColor'
import { DecorBuilder } from './decorBuilder'
import { addChevrons, addPennants, addProps, addStartArch } from './decorView'
import { layoutProps } from './decorLayout'
import { buildFence, postGeometry } from './fence'
import {
  asphaltTexture,
  ASPHALT_TILE,
  CURB_TILE,
  curbTexture,
  decorAtlas,
  MUD_TILE,
  mudTexture,
  railTexture,
  WOOD_TILE,
  woodTexture,
} from './proceduralTextures'
import { buildRibbon, curbProfile, flatProfile } from './ribbon'
import { buildTerrainField, levelPads, type TerrainField } from './terrainField'
import { createTerrainMesh } from './terrainMesh'
import { layoutVegetation, type KeepClear } from './vegetationLayout'
import { createVegetation } from './vegetationView'
import { windClock } from './windMaterial'

const ROAD_LIFT = 0.01
const BRANCH_LIFT = 0.015
const CURB_WIDTH = 1
const CURB_HEIGHT = 0.09
/** Branch samples are this far apart (m), so fence posts and banners fit them. */
const BRANCH_SPACING = 3

interface RoadMaterial {
  material: THREE.MeshStandardMaterial
  tile: number
}

/**
 * The rich environment of a track (see `TrackEnvironment`): sculpted terrain, textured road with
 * rounded curbs, a themed fence, instanced vegetation with wind, and decoration. Visual only.
 * Call `update(seconds)` every frame to move the wind and `setDensity` when the quality changes.
 */
export class EnvironmentView extends THREE.Group {
  /** The land, so tests and tools can sample it exactly as drawn. */
  readonly field: TerrainField
  private vegetation: THREE.Group | null = null
  private readonly keepClear: KeepClear[]
  private readonly roads = new Map<string, RoadMaterial>()
  private readonly environment: TrackEnvironment
  private density = -1

  constructor(
    private readonly track: Track,
    theme: TrackTheme,
    environment: TrackEnvironment,
    density: number,
  ) {
    super()
    this.name = 'environment'
    this.environment = environment
    const seed = environment.seed

    // Land first: props level platforms into it, and everything else stands on it
    this.field = buildTerrainField(track, environment.terrain, seed)
    const props = layoutProps(
      track,
      this.field,
      environment.decor.props,
      environment.terrain.shoulder,
    )
    levelPads(this.field, props.pads)
    this.keepClear = props.spots.map((spot, i) => ({
      x: spot.x,
      z: spot.z,
      radius: (props.pads[i]?.radius ?? 3) + 1.5,
    }))
    this.add(createTerrainMesh(this.field, environment.terrain, seed))

    // Road pieces
    const main = createMainPath(track)
    const branches = track.branches.map((branch, index) =>
      createBranchPath(track, branch, index, resamplePolyline(branch.points, BRANCH_SPACING)),
    )
    const decor = new DecorBuilder()
    const railGeometries: THREE.BufferGeometry[] = []
    const posts: THREE.Matrix4[] = []
    ;[main, ...branches].forEach((path, index) => {
      const isMain = index === 0
      this.addRoad(path, theme, isMain ? ROAD_LIFT : BRANCH_LIFT)
      if (isMain) this.addCurbs(path, theme)
      const fence = buildFence(track, path, index, decor, environment.decor.bannerDensity)
      if (fence.rails) railGeometries.push(fence.rails)
      posts.push(...fence.posts)
    })
    this.addFence(railGeometries, posts)

    // Decoration, all in one mesh
    addStartArch(decor, track)
    addPennants(decor, track, environment.decor.pennantStrings)
    addChevrons(decor, track, this.field)
    addProps(decor, props.spots)
    const decorGeometry = decor.build()
    if (decorGeometry) {
      const material = new THREE.MeshStandardMaterial({
        map: decorAtlas(environment.decor.sponsors, seed),
        vertexColors: true,
        roughness: 0.8,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(decorGeometry, material)
      mesh.name = 'decor'
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.add(mesh)
    }

    this.setDensity(density)
  }

  /** Replants the vegetation at a share (0..1) of its full count. Does nothing if unchanged. */
  setDensity(density: number): void {
    if (density === this.density) return
    this.density = density
    if (this.vegetation) {
      this.disposeVegetation(this.vegetation)
      this.vegetation = null
    }
    if (density <= 0) return
    const { vegetation, seed } = this.environment
    const layout = layoutVegetation(
      this.track,
      this.field,
      vegetation,
      seed,
      density,
      this.keepClear,
    )
    this.vegetation = createVegetation(layout, vegetation)
    this.add(this.vegetation)
  }

  /** Advances the wind. */
  update(seconds: number): void {
    windClock.value = seconds
  }

  private disposeVegetation(group: THREE.Group): void {
    group.removeFromParent()
    group.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return
      node.geometry.dispose()
      const material: THREE.Material | THREE.Material[] = node.material
      for (const m of Array.isArray(material) ? material : [material]) m.dispose()
    })
  }

  private roadMaterial(surface: SurfaceType, theme: TrackTheme): RoadMaterial {
    const cached = this.roads.get(surface)
    if (cached) return cached
    const seed = this.environment.seed
    let entry: RoadMaterial
    switch (surface) {
      case 'asphalt':
        entry = {
          material: new THREE.MeshStandardMaterial({
            map: asphaltTexture(theme.road, seed),
            roughness: 0.88,
          }),
          tile: ASPHALT_TILE,
        }
        break
      case 'wood':
        entry = {
          material: new THREE.MeshStandardMaterial({ map: woodTexture(seed), roughness: 0.82 }),
          tile: WOOD_TILE,
        }
        break
      case 'mud': {
        const mud = mudTexture(seed)
        entry = {
          material: new THREE.MeshStandardMaterial({
            map: mud.map,
            roughnessMap: mud.roughness,
            roughness: 1,
            metalness: 0.05,
          }),
          tile: MUD_TILE,
        }
        break
      }
      default:
        entry = {
          material: new THREE.MeshStandardMaterial({
            color: surfaceColor(surface, theme),
            roughness: 0.9,
          }),
          tile: ASPHALT_TILE,
        }
    }
    this.roads.set(surface, entry)
    return entry
  }

  /** The road surface of a path: one mesh per surface type it crosses. */
  private addRoad(path: Path, theme: TrackTheme, lift: number): void {
    const surfaces = new Set<SurfaceType>()
    for (let i = 0; i < path.points.length; i++) surfaces.add(path.surfaceAt(i))
    for (const surface of surfaces) {
      const { material, tile } = this.roadMaterial(surface, theme)
      const geometry = buildRibbon(
        this.track,
        path,
        flatProfile(-path.halfWidth, path.halfWidth, lift, 6),
        { tile, include: (i) => path.surfaceAt(i) === surface },
      )
      if (!geometry) continue
      const mesh = new THREE.Mesh(geometry, material)
      mesh.name = `road:${surface}`
      mesh.receiveShadow = true
      this.add(mesh)
    }
  }

  /** Rounded red and white curbs on both edges, merged into one mesh. */
  private addCurbs(path: Path, theme: TrackTheme): void {
    const hw = path.halfWidth
    const geometries = [
      buildRibbon(this.track, path, curbProfile(hw - CURB_WIDTH, hw, CURB_HEIGHT), {
        tile: CURB_TILE,
        skipOpenings: true,
      }),
      buildRibbon(this.track, path, curbProfile(-hw, -hw + CURB_WIDTH, CURB_HEIGHT), {
        tile: CURB_TILE,
        skipOpenings: true,
      }),
    ].filter((g): g is THREE.BufferGeometry => g !== null)
    if (geometries.length === 0) return
    const merged = geometries.length === 1 ? geometries[0] : mergeTwo(geometries)
    if (!merged) return
    const mesh = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({ map: curbTexture(theme.curb), roughness: 0.7 }),
    )
    mesh.name = 'curbs'
    mesh.receiveShadow = true
    this.add(mesh)
  }

  private addFence(rails: THREE.BufferGeometry[], posts: THREE.Matrix4[]): void {
    const material = new THREE.MeshStandardMaterial({
      map: railTexture(this.environment.seed),
      roughness: 0.85,
      side: THREE.DoubleSide,
    })
    const merged = rails.length === 0 ? null : mergeTwo(rails)
    if (merged) {
      const mesh = new THREE.Mesh(merged, material)
      mesh.name = 'fence:rails'
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.add(mesh)
    }
    if (posts.length > 0) {
      const instanced = new THREE.InstancedMesh(postGeometry(), material, posts.length)
      posts.forEach((matrix, i) => instanced.setMatrixAt(i, matrix))
      instanced.instanceMatrix.needsUpdate = true
      instanced.computeBoundingSphere()
      instanced.name = 'fence:posts'
      instanced.castShadow = true
      instanced.receiveShadow = true
      this.add(instanced)
    }
  }
}

function mergeTwo(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (geometries.length === 0) return null
  const merged = mergeGeometries(geometries, false)
  for (const g of geometries) g.dispose()
  return merged
}
