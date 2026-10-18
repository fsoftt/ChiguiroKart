import { staggerIndex } from './motionModel'

/** True when the system asks for less motion. Never throws. */
export function systemPrefersReducedMotion(): boolean {
  try {
    return (
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  } catch {
    return false
  }
}

/** Switches the whole UI between full and fade-only animations (CSS reads `data-motion`). */
export function applyReducedMotion(reduced: boolean): void {
  document.documentElement.dataset.motion = reduced ? 'reduced' : 'full'
}

/** Gives `node` its place in an entrance stagger (CSS multiplies `--i` by a short delay). */
export function setStagger(node: HTMLElement, index: number): void {
  node.style.setProperty('--i', String(staggerIndex(index)))
}

let veil: HTMLElement | null = null

/**
 * Fades a dark veil out over the screen. Call it right after the screen underneath changed
 * (menu to race, race to menu): the swap is hidden and the new screen fades in. The veil never
 * takes pointer events, so input is not blocked.
 */
export function playScreenFade(): void {
  if (!veil) {
    veil = document.createElement('div')
    veil.className = 'motion-veil'
    veil.setAttribute('aria-hidden', 'true')
    document.body.append(veil)
  }
  veil.classList.remove('is-playing')
  void veil.offsetWidth
  veil.classList.add('is-playing')
}
