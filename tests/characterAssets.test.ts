import { describe, expect, it } from 'vitest'
import { missingRigParts } from '../src/render/characters/characterAssets'
import { boneNames, clipNames } from '../src/render/characters/rig'

describe('missingRigParts', () => {
  it('accepts a model with the whole rig', () => {
    expect(missingRigParts(boneNames, clipNames)).toEqual([])
  })

  it('lists missing bones and clips', () => {
    const missing = missingRigParts(
      boneNames.filter((name) => name !== 'chassis'),
      clipNames.filter((name) => name !== 'drift'),
    )
    expect(missing).toEqual(['bone chassis', 'clip drift'])
  })

  it('rejects an empty model', () => {
    expect(missingRigParts([], []).length).toBe(boneNames.length + clipNames.length)
  })
})
