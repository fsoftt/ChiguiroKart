import type { ChaseCameraConfig } from '../config/camera'
import type { KartPhysicsConfig } from '../config/kartPhysics'

export interface DebugReadout {
  speedKmh: number
  onGround: boolean
}

export interface DebugPanelOptions {
  physics: KartPhysicsConfig
  camera: ChaseCameraConfig
  readout: DebugReadout
  onReset: () => void
}

/** Shown in development builds, or in production with `?debug` in the URL. */
export function isDebugEnabled(): boolean {
  return import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug')
}

/**
 * Live tuning panel. lil-gui is loaded on demand so it never ships in the main bundle.
 * Editing a value changes the shared config object, which the simulation reads every step.
 */
export async function createDebugPanel(options: DebugPanelOptions): Promise<void> {
  const { default: GUI } = await import('lil-gui')
  const gui = new GUI({ title: 'Depuración' })

  const status = gui.addFolder('Estado')
  status.add(options.readout, 'speedKmh').name('Velocidad (km/h)').decimals(0).listen().disable()
  status.add(options.readout, 'onGround').name('En el suelo').listen().disable()
  status.add({ reset: options.onReset }, 'reset').name('Reiniciar kart (R)')

  const physics = gui.addFolder('Física del kart')
  const p = options.physics
  physics.add(p, 'maxSpeed', 5, 60, 0.5).name('Velocidad máx. (m/s)')
  physics.add(p, 'maxReverseSpeed', 1, 20, 0.5).name('Reversa máx. (m/s)')
  physics.add(p, 'acceleration', 1, 60, 0.5).name('Aceleración')
  physics.add(p, 'brakeDeceleration', 1, 100, 1).name('Freno')
  physics.add(p, 'reverseAcceleration', 1, 40, 0.5).name('Aceleración reversa')
  physics.add(p, 'coastDeceleration', 0, 30, 0.5).name('Desaceleración libre')
  physics.add(p, 'turnRate', 0.5, 6, 0.05).name('Giro (rad/s)')
  physics.add(p, 'turnSpeedReference', 0.5, 20, 0.5).name('Vel. giro completo')
  physics.add(p, 'highSpeedTurnFactor', 0.1, 1, 0.05).name('Giro a vel. máx.')
  physics.add(p, 'lateralGrip', 0.5, 30, 0.5).name('Agarre lateral')
  physics.add(p, 'gravity', 5, 80, 1).name('Gravedad')
  physics.add(p, 'wallBounce', 0, 1, 0.05).name('Rebote en pared')
  physics.add(p, 'wallFriction', 0, 2, 0.05).name('Fricción en pared')
  physics.add(p, 'wallAlignRate', 0, 30, 0.5).name('Alinear con pared')

  const camera = gui.addFolder('Cámara')
  const c = options.camera
  camera.add(c, 'distance', 2, 15, 0.1).name('Distancia')
  camera.add(c, 'height', 0.5, 8, 0.1).name('Altura')
  camera.add(c, 'lookHeight', 0, 4, 0.1).name('Altura de mira')
  camera.add(c, 'lookAhead', 0, 15, 0.5).name('Mira adelante')
  camera.add(c, 'followSmoothing', 1, 30, 0.5).name('Suavizado')
  camera.add(c, 'baseFov', 40, 90, 1).name('FOV base')
  camera.add(c, 'speedFovBoost', 0, 40, 1).name('FOV extra por velocidad')
  camera.close()
}
