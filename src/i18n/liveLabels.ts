import { onLanguageChange } from './index'

/**
 * Keeps static UI texts in the current language: `text` sets a node's text now and again on
 * every language change. One instance per UI component.
 */
export class LiveLabels {
  private readonly updaters: (() => void)[] = []

  constructor() {
    onLanguageChange(() => this.refresh())
  }

  /** Runs `apply` now and after every language change. */
  run(apply: () => void): void {
    apply()
    this.updaters.push(apply)
  }

  text(node: HTMLElement, text: () => string): void {
    this.run(() => {
      node.textContent = text()
    })
  }

  attr(node: HTMLElement, name: string, text: () => string): void {
    this.run(() => node.setAttribute(name, text()))
  }

  refresh(): void {
    for (const apply of this.updaters) apply()
  }
}
