import { describe, expect, it } from 'vitest'
import { defaultQualityFor } from '../src/config/deviceQuality'
import { budgetViolations, perfBudgets } from '../src/config/perfBudget'
import { qualityProfiles } from '../src/config/quality'

describe('defaultQualityFor', () => {
  it('gives phones and tablets Baja whatever their memory', () => {
    expect(defaultQualityFor({ coarsePointer: true })).toBe('low')
    expect(
      defaultQualityFor({ coarsePointer: true, deviceMemory: 8, hardwareConcurrency: 8 }),
    ).toBe('low')
  })

  it('gives weak desktops Baja and middling ones Media', () => {
    expect(defaultQualityFor({ coarsePointer: false, deviceMemory: 2 })).toBe('low')
    expect(defaultQualityFor({ coarsePointer: false, hardwareConcurrency: 2 })).toBe('low')
    expect(defaultQualityFor({ coarsePointer: false, deviceMemory: 4 })).toBe('medium')
    expect(defaultQualityFor({ coarsePointer: false, hardwareConcurrency: 4 })).toBe('medium')
  })

  it('gives Alta to strong or unknown desktops: no hint is not a weak device', () => {
    expect(defaultQualityFor({ coarsePointer: false })).toBe('high')
    expect(
      defaultQualityFor({ coarsePointer: false, deviceMemory: 8, hardwareConcurrency: 8 }),
    ).toBe('high')
  })
})

describe('performance budgets', () => {
  it('are tighter for lower qualities', () => {
    expect(perfBudgets.low.drawCalls).toBeLessThan(perfBudgets.medium.drawCalls)
    expect(perfBudgets.low.triangles).toBeLessThan(perfBudgets.medium.triangles)
    expect(perfBudgets.medium.triangles).toBeLessThan(perfBudgets.high.triangles)
  })

  it('names what a frame breaks', () => {
    expect(budgetViolations('low', { drawCalls: 150, triangles: 300_000 })).toEqual([])
    expect(budgetViolations('low', { drawCalls: 151, triangles: 100 })).toEqual(['drawCalls'])
    expect(budgetViolations('low', { drawCalls: 10, triangles: 300_001 })).toEqual(['triangles'])
    expect(budgetViolations('medium', { drawCalls: 300, triangles: 800_000 })).toEqual([
      'drawCalls',
      'triangles',
    ])
    expect(budgetViolations('high', { drawCalls: 9999, triangles: 1e9 })).toEqual([])
  })

  it('scale down the plants and outlines with the quality', () => {
    expect(qualityProfiles.low.vegetationDrawScale).toBeLessThan(
      qualityProfiles.medium.vegetationDrawScale,
    )
    expect(qualityProfiles.high.vegetationDrawScale).toBe(Infinity)
    expect(qualityProfiles.low.botOutlines).toBe(false)
    expect(qualityProfiles.high.botOutlines).toBe(true)
  })
})
