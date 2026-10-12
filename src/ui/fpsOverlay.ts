import { FpsMeter } from './fpsMeter'

/** Small on-screen FPS readout, meant for development builds. */
export class FpsOverlay {
  private readonly meter = new FpsMeter()
  private readonly element = document.createElement('div')

  constructor(parent: HTMLElement = document.body) {
    this.element.className = 'fps-overlay'
    parent.append(this.element)
  }

  update(deltaSeconds: number): void {
    this.meter.addFrame(deltaSeconds)
    this.element.textContent = `${Math.round(this.meter.fps)} FPS`
  }
}
