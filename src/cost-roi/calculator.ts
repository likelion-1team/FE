export const numericFields = [
  'jobs',
  'beforeInput',
  'beforeOutput',
  'afterInput',
  'afterOutput',
  'inputRate',
  'outputRate',
  'exchangeRate',
  'beforeMinutes',
  'afterMinutes',
  'hourlyWage',
  'setup',
  'training',
  'subscription',
  'operations',
] as const
export type NumericField = (typeof numericFields)[number]
export type Scenario = Record<NumericField, string> & {
  from: string
  to: string
  source: string
  comparable: boolean
}
export const emptyScenario: Scenario = {
  ...Object.fromEntries(numericFields.map((key) => [key, ''])),
  from: '',
  to: '',
  source: '',
  comparable: false,
} as Scenario
// Fixed presentation assumptions, not current model prices or measured savings.
export const sampleScenario: Scenario = {
  from: '2026-11-01',
  to: '2026-11-30',
  source: '발표용 합성 가정 · 실제 청구액 아님',
  comparable: true,
  jobs: '1000',
  beforeInput: '12000',
  beforeOutput: '4000',
  afterInput: '8000',
  afterOutput: '2500',
  inputRate: '2.5',
  outputRate: '10',
  exchangeRate: '1400',
  beforeMinutes: '6',
  afterMinutes: '3',
  hourlyWage: '30000',
  setup: '200000',
  training: '100000',
  subscription: '150000',
  operations: '50000',
}
const tokenFields: string[] = ['jobs', 'beforeInput', 'beforeOutput', 'afterInput', 'afterOutput']
export function calculateScenario(s: Scenario) {
  const validDate = (date: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
  if (!validDate(s.from) || !validDate(s.to) || s.from > s.to)
    return { error: '시작일과 종료일을 올바르게 입력해주세요.' } as const
  if (!s.source.trim() || !s.comparable)
    return { error: '가정·단가 출처를 입력하고 동일 업무량·품질 가정을 확인해주세요.' } as const
  const values = {} as Record<NumericField, number>
  for (const key of numericFields) {
    const value = Number(s[key])
    if (
      !s[key].trim() ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1e12 ||
      (tokenFields.includes(key) && !Number.isSafeInteger(value))
    )
      return {
        error: '모든 수치를 0 이상의 유효한 값으로 입력해주세요. 업무 수와 토큰은 정수입니다.',
      } as const
    values[key] = value
  }
  const v = values
  if (v.jobs <= 0 || v.exchangeRate <= 0)
    return { error: '업무 수와 환율은 0보다 커야 합니다.' } as const
  const cost = (input: number, output: number) =>
    ((input * v.inputRate + output * v.outputRate) / 1_000_000) * v.exchangeRate * v.jobs
  const beforeCost = cost(v.beforeInput, v.beforeOutput)
  const afterCost = cost(v.afterInput, v.afterOutput)
  const spendingSaving = beforeCost - afterCost
  const hoursSaved = ((v.beforeMinutes - v.afterMinutes) * v.jobs) / 60
  const timeValue = hoursSaved * v.hourlyWage
  const investment = v.setup + v.training + v.subscription + v.operations
  const netBenefit = spendingSaving + timeValue - investment
  const spendingRoi = investment > 0 ? ((spendingSaving - investment) / investment) * 100 : null
  const economicRoi = investment > 0 ? (netBenefit / investment) * 100 : null
  if (
    [
      beforeCost,
      afterCost,
      spendingSaving,
      timeValue,
      investment,
      netBenefit,
      ...(spendingRoi == null ? [] : [spendingRoi, economicRoi!]),
    ].some((value) => !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
  )
    return { error: '계산 가능한 범위를 넘었습니다. 입력 수치를 줄여주세요.' } as const
  return {
    beforeCost,
    afterCost,
    spendingSaving,
    hoursSaved,
    timeValue,
    investment,
    netBenefit,
    spendingRoi,
    economicRoi,
  } as const
}
