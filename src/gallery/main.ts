import * as THREE from 'three'
import { characterIds, characters, type CharacterId } from '../config/characters'
import { buildCharacterAsset } from '../render/characters/buildCharacter'
import { clipNames, RACER_MESH_NAME, type ClipName } from '../render/characters/rig'
import { addOutline, vertexColorToon } from '../render/characters/toon'

/** Character gallery: every model with its clips, to review the art. */

interface Shown {
  id: CharacterId
  object: THREE.Group
  mixer: THREE.AnimationMixer
  clips: THREE.AnimationClip[]
}

const clipLabels: Record<ClipName, string> = {
  idle: 'Reposo',
  steerLeft: 'Giro izq.',
  steerRight: 'Giro der.',
  drift: 'Derrape',
  boost: 'Nitro',
  air: 'En el aire',
  hit: 'Golpeado',
  victory: 'Victoria',
  defeat: 'Derrota',
  throwForward: 'Lanzar adelante',
  throwBack: 'Lanzar atrás',
}

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')
const characterButtons = document.querySelector<HTMLDivElement>('#characters')
const clipButtons = document.querySelector<HTMLDivElement>('#clips')
const spinBox = document.querySelector<HTMLInputElement>('#spin')
const allBox = document.querySelector<HTMLInputElement>('#all')
const info = document.querySelector<HTMLParagraphElement>('#info')
if (!canvas || !characterButtons || !clipButtons || !spinBox || !allBox || !info) {
  throw new Error('Gallery markup is missing')
}

const params = new URLSearchParams(window.location.search)
let current: CharacterId = characterIds.find((id) => id === params.get('personaje')) ?? 'chiguiro'
let clip: ClipName = clipNames.find((c) => c === params.get('clip')) ?? 'idle'
spinBox.checked = params.get('girar') !== '0'
allBox.checked = params.get('todos') === '1'
const yaw = Number(params.get('angulo') ?? '0.6')
const distance = Number(params.get('distancia') ?? '5.2')
const height = Number(params.get('altura') ?? '2.3')

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
const scene = new THREE.Scene()
scene.background = new THREE.Color('#87b5d9')
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
scene.add(new THREE.HemisphereLight('#ffffff', '#5a8f3c', 1.2))
const sun = new THREE.DirectionalLight('#ffffff', 1.6)
sun.position.set(4, 8, 6)
scene.add(sun)
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(30, 48),
  new THREE.MeshToonMaterial({ color: '#7cc46a' }),
)
ground.rotation.x = -Math.PI / 2
scene.add(ground)

let shown: Shown[] = []

function show(id: CharacterId, x: number): Shown {
  const asset = buildCharacterAsset(id)
  const object = asset.scene
  object.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh && child.name === RACER_MESH_NAME) {
      child.material = vertexColorToon()
      addOutline(child)
    }
  })
  object.position.x = x
  scene.add(object)
  return { id, object, mixer: new THREE.AnimationMixer(object), clips: asset.animations }
}

function play(entry: Shown): void {
  entry.mixer.stopAllAction()
  const animation = entry.clips.find((c) => c.name === clip)
  if (animation) entry.mixer.clipAction(animation).play()
}

function rebuild(): void {
  for (const entry of shown) scene.remove(entry.object)
  const ids = allBox?.checked ? characterIds : [current]
  shown = ids.map((id, i) => {
    if (ids.length === 1) return show(id, 0)
    const entry = show(id, ((i % 4) - 1.5) * -2.4)
    entry.object.position.z = Math.floor(i / 4) * -3.2 + 1.6
    return entry
  })
  shown.forEach(play)
  const wide = ids.length > 1
  camera.position.set(0, 4.5, 11)
  camera.lookAt(0, 0.4, -0.6)
  if (!wide) {
    camera.position.set(Math.sin(yaw) * distance, height, Math.cos(yaw) * distance)
    camera.lookAt(0, 0.95, 0)
  }
  const character = characters[current]
  if (info) {
    info.textContent = wide
      ? 'Los 8 personajes.'
      : `${character.name} — ${character.perk.name}: ${character.perk.description}`
  }
  refreshButtons()
}

function button(label: string, active: boolean, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button')
  element.type = 'button'
  element.textContent = label
  element.classList.toggle('active', active)
  element.addEventListener('click', onClick)
  return element
}

function refreshButtons(): void {
  characterButtons?.replaceChildren(
    ...characterIds.map((id) =>
      button(characters[id].name, id === current, () => {
        current = id
        if (allBox) allBox.checked = false
        rebuild()
      }),
    ),
  )
  clipButtons?.replaceChildren(
    ...clipNames.map((name) =>
      button(clipLabels[name], name === clip, () => {
        clip = name
        shown.forEach(play)
        refreshButtons()
      }),
    ),
  )
}

allBox.addEventListener('change', rebuild)
if (params.get('panel') === '0') document.querySelector<HTMLElement>('.panel')?.remove()
rebuild()

const clock = new THREE.Clock()
function frame(): void {
  const dt = Math.min(clock.getDelta(), 0.1)
  const width = canvas?.clientWidth ?? 1
  const height = canvas?.clientHeight ?? 1
  if (
    canvas &&
    (canvas.width !== Math.floor(width * renderer.getPixelRatio()) ||
      canvas.height !== Math.floor(height * renderer.getPixelRatio()))
  ) {
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  for (const entry of shown) {
    entry.mixer.update(dt)
    if (spinBox?.checked) entry.object.rotation.y += dt * 0.6
  }
  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}
frame()
