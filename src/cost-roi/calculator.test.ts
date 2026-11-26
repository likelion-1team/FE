import { describe, expect, it } from 'vitest'
import { calculateScenario, emptyScenario, sampleScenario } from './calculator'

describe('cost and ROI scenarios', () => {
  it('keeps estimated spending savings and time value separate', () => {
    const result = calculateScenario(sampleScenario)
    if ('error' in result) throw new Error(result.error)
    const expected = {
      beforeCost: 98000,
      afterCost: 63000,
      spendingSaving: 35000,
      hoursSaved: 50,
      timeValue: 1500000,
      investment: 500000,
      netBenefit: 1035000,
      spendingRoi: -93,
      economicRoi: 207,
    }
    for (const [key, value] of Object.entries(expected))
      expect(result[key as keyof typeof result]).toBeCloseTo(value, 6)
  })
  it('keeps additional time and spending as losses rather than clipping to zero', () => {
    const result = calculateScenario({ ...sampleScenario, afterMinutes: '9', afterInput: '20000' })
    expect(result).toMatchObject({ hoursSaved: -50, timeValue: -1500000 })
    if ('error' in result) throw new Error(result.error)
    expect(result.spendingSaving).toBeLessThan(0)
    expect(result.economicRoi).toBeLessThan(-100)
  })
  it('retains cost estimates but does not divide by a zero investment', () => {
    expect(
      calculateScenario({
        ...sampleScenario,
        setup: '0',
        training: '0',
        subscription: '0',
        operations: '0',
      }),
    ).toMatchObject({ investment: 0, spendingRoi: null, economicRoi: null })
  })
  it('does not interpret missing measurements as zero or accept invalid assumptions', () => {
    for (const scenario of [
      emptyScenario,
      { ...sampleScenario, inputRate: '' },
      { ...sampleScenario, comparable: false },
      { ...sampleScenario, source: ' ' },
      { ...sampleScenario, exchangeRate: '0' },
      { ...sampleScenario, jobs: '0.5' },
      { ...sampleScenario, afterMinutes: '-1' },
      { ...sampleScenario, from: '2026-02-30' },
      { ...sampleScenario, to: '2026-10-01' },
      { ...sampleScenario, jobs: 'Infinity' },
      { ...sampleScenario, jobs: '1000000000000', exchangeRate: '1000000000000' },
    ]) {
      expect(calculateScenario(scenario)).toHaveProperty('error')
    }
  })
})
