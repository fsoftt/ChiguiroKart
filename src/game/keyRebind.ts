import { defaultKeyBindings, type KeyBindings, type KeyboardAction } from '../config/controls'

/** Actions in the order the options list them, with their Spanish labels. */
export const REBIND_ACTIONS: readonly { action: KeyboardAction; label: string }[] = [
  { action: 'throttle', label: 'Acelerar' },
  { action: 'brake', label: 'Frenar' },
  { action: 'left', label: 'Izquierda' },
  { action: 'right', label: 'Derecha' },
  { action: 'jump', label: 'Saltar/derrapar' },
  { action: 'boost', label: 'Nitro' },
  { action: 'useItem', label: 'Usar poder' },
  { action: 'lookBack', label: 'Mirar atrás' },
]

/** Most keys one action can have: a primary and a secondary. */
export const MAX_KEYS_PER_ACTION = 2

/** Codes with a fixed meaning (pause, reset, menus) that cannot be bound to an action. */
const RESERVED_CODES: ReadonlySet<string> = new Set([
  'Escape',
  'KeyP',
  'KeyR',
  'Enter',
  'NumpadEnter',
  'Backspace',
  'Tab',
])

export function isBindableCode(code: string): boolean {
  return code.length > 0 && !RESERVED_CODES.has(code)
}

export function cloneBindings(bindings: KeyBindings): KeyBindings {
  return {
    throttle: [...bindings.throttle],
    brake: [...bindings.brake],
    left: [...bindings.left],
    right: [...bindings.right],
    jump: [...bindings.jump],
    boost: [...bindings.boost],
    useItem: [...bindings.useItem],
    lookBack: [...bindings.lookBack],
  }
}

export function defaultBindings(): KeyBindings {
  return cloneBindings(defaultKeyBindings)
}

/**
 * Binds `code` to slot `slot` (0 primary, 1 secondary) of `action`. A code used elsewhere is
 * moved: it leaves the other action (or the other slot of this one). If that would leave
 * another action without any key, that action takes the key this slot had (a swap). Returns a
 * new object; an unbindable code returns the bindings unchanged.
 */
export function rebindKey(
  bindings: KeyBindings,
  action: KeyboardAction,
  slot: number,
  code: string,
): KeyBindings {
  if (!isBindableCode(code)) return bindings
  const index = Math.min(Math.max(slot, 0), MAX_KEYS_PER_ACTION - 1)
  const previous = bindings[action][index]
  const next = cloneBindings(bindings)

  for (const other of Object.keys(next) as KeyboardAction[]) {
    if (other === action) continue
    const had = next[other].includes(code)
    next[other] = next[other].filter((key) => key !== code)
    if (had && next[other].length === 0 && previous && previous !== code) next[other] = [previous]
  }

  const keys = [...bindings[action]]
  const written = Math.min(index, keys.length)
  keys[written] = code
  // The new key may already have been this action's other key: keep only the written one
  next[action] = keys.filter((key, i) => key !== code || i === written)
  return next
}

/** A tidy label for a `KeyboardEvent.code`, e.g. "KeyW" -> "W", "ArrowUp" -> "↑". */
export function keyLabel(code: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit\d$/.test(code)) return code.slice(5)
  if (/^Numpad\d$/.test(code)) return `Num ${code.slice(6)}`
  const named: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Space: 'Espacio',
    ShiftLeft: 'Shift izq.',
    ShiftRight: 'Shift der.',
    ControlLeft: 'Ctrl izq.',
    ControlRight: 'Ctrl der.',
    AltLeft: 'Alt izq.',
    AltRight: 'Alt der.',
  }
  return named[code] ?? code
}

const ACTIONS = Object.keys(defaultKeyBindings) as KeyboardAction[]

/**
 * Validates stored bindings: every action needs 1..2 distinct bindable codes and no code may
 * serve two actions. Anything else falls back to the defaults for the whole set, so a damaged
 * save can never leave the kart without controls.
 */
export function parseKeyBindings(value: unknown): KeyBindings {
  if (typeof value !== 'object' || value === null) return defaultBindings()
  const source = value as Record<string, unknown>
  const result = defaultBindings()
  const used = new Set<string>()
  for (const action of ACTIONS) {
    const keys = source[action]
    if (!Array.isArray(keys) || keys.length < 1 || keys.length > MAX_KEYS_PER_ACTION) {
      return defaultBindings()
    }
    for (const key of keys) {
      if (typeof key !== 'string' || !isBindableCode(key) || used.has(key)) {
        return defaultBindings()
      }
      used.add(key)
    }
    result[action] = keys as string[]
  }
  return result
}
