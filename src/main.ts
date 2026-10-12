import * as THREE from 'three'
import { createScene, resizeToCanvas } from './render/createScene'
import { FpsOverlay } from './ui/fpsOverlay'

const CUBE_SPIN_SPEED = 0.8 // radians per second

const canvas = document.querySelector<HTMLCanvasElement>('#game')
if (!canvas) throw new Error('Missing #game canvas')

const context = createScene(canvas)
const fpsOverlay = import.meta.env.DEV ? new FpsOverlay() : null
const timer = new THREE.Timer()

context.renderer.setAnimationLoop((time) => {
  timer.update(time)
  const delta = timer.getDelta()

  resizeToCanvas(context)
  context.cube.rotation.x += CUBE_SPIN_SPEED * delta
  context.cube.rotation.y += CUBE_SPIN_SPEED * delta
  context.renderer.render(context.scene, context.camera)
  fpsOverlay?.update(delta)
})
