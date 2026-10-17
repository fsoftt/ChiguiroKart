/** Small deterministic generator (LCG); scenery must look the same on every machine. */
export function seededRandom(seed: number): () => number {
  let state = seed % 4294967296
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

/** Stable 32-bit hash of a string, used to give each scenery kind its own seed. */
export function hashString(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
