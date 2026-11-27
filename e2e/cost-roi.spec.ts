import { test, expect } from '@playwright/test'
import { mockApi, reply } from './fixtures'

test('demo costs and ROI recalculate and zero or missing values remain explicit', async ({
  page,
}) => {
  const requests: string[] = []
  page.on('request', (req) => {
    if (new URL(req.url()).pathname.startsWith('/api/')) requests.push(req.url())
  })
  await page.goto('/demo')
  await page.getByRole('button', { name: '6. 비용 · ROI', exact: true }).click()
  await expect(page.getByText('98,000원', { exact: true })).toBeVisible()
  await expect(page.getByText('63,000원', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '2. ROI 계산', exact: true }).click()
  await expect(page.getByText('207%', { exact: true })).toBeVisible()
  await expect(page.getByText('-93%', { exact: true })).toBeVisible()
  await page.getByLabel('개선 후 검토·재작업 분 / 건', { exact: true }).fill('4')
  await expect(page.getByText('107%', { exact: true })).toBeVisible()
  for (const label of [
    '초기 설정비 KRW',
    '교육비 KRW',
    '서비스 이용료 KRW',
    '업로드·확인·오판 대응비 KRW',
  ])
    await page.getByLabel(label, { exact: true }).fill('0')
  await expect(page.getByText('계산 불가', { exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: '입력 초기화', exact: true }).click()
  await expect(page.getByText(/계산 대기/)).toBeVisible()
  await expect(page.getByText('207%', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '합성 예시 복원' }).click()
  await expect(page.getByText('207%', { exact: true })).toBeVisible()
  expect(requests).toEqual([])
})

test('authenticated workspace calculator starts without fabricated production figures', async ({
  page,
}) => {
  await mockApi(page, { cookieSession: true })
  await page.goto('/teams/1/member/cost-roi')
  await expect(page.getByRole('heading', { name: '비용과 ROI 시나리오' })).toBeVisible()
  await expect(page.getByLabel('기간 내 업무 수', { exact: true })).toBeEmpty()
  await expect(page.getByText(/계산 대기/)).toBeVisible()
  await expect(page.getByText('98,000원', { exact: true })).toHaveCount(0)
})

test('cost and ROI inputs fit a mobile screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/demo')
  await page.getByRole('button', { name: '6. 비용 · ROI', exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('compares provider usage for a submitted pair and withholds a delta when one run fails', async ({
  page,
}) => {
  await mockApi(page, { cookieSession: true })
  const model = 'gpt-4.1-mini-2025-04-14'
  const baseline = {
    status: 'COMPLETED',
    model,
    output: '기존 응답',
    message: null,
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, cachedInputTokens: 30 },
    providerIds: { requestId: 'req_baseline_fixture', responseId: 'resp_baseline_fixture' },
  }
  let attempts = 0
  await page.route('**/api/v1/teams/1/prompt-comparison', async (route) => {
    if (route.request().method() === 'GET') return reply(route, { configured: true, model })
    attempts++
    expect(route.request().postDataJSON()).toEqual({
      task: '같은 업무 내용',
      baselinePrompt: '기존 지시',
      improvedPrompt: '개선 지시',
    })
    return reply(route, {
      baseline,
      improved:
        attempts === 1
          ? {
              status: 'COMPLETED',
              model,
              output: '개선 응답',
              message: null,
              usage: { inputTokens: 80, outputTokens: 20, totalTokens: 100, cachedInputTokens: 0 },
              providerIds: {
                requestId: 'req_improved_fixture',
                responseId: 'resp_improved_fixture',
              },
            }
          : {
              status: 'FAILED',
              model: null,
              output: null,
              usage: null,
              message: 'OpenAI 요청 실패',
            },
    })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/teams/1/member/cost-roi')
  await page.getByRole('button', { name: '실제 토큰 비교', exact: true }).click()
  const submit = page.getByRole('button', { name: '두 프롬프트 실행', exact: true })
  await expect(submit).toBeDisabled()
  await page.getByLabel('공통 업무', { exact: true }).fill('같은 업무 내용')
  await page.getByLabel('기존 프롬프트', { exact: true }).fill('기존 지시')
  await page.getByLabel('개선 프롬프트', { exact: true }).fill('개선 지시')
  await submit.click()
  await expect(page.getByText('총 50 토큰 감소 (33.3%)', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'OpenAI 실측 결과', exact: true })).toBeFocused()
  const total = page
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: '총 토큰' }) })
  await expect(total.getByRole('cell')).toHaveText(['150', '100'])
  await expect(page.getByText('개선 응답', { exact: true })).toBeVisible()
  await page.getByText('OpenAI 호출 식별 정보', { exact: true }).click()
  await expect(page.getByText('req_baseline_fixture', { exact: true })).toBeVisible()
  await expect(page.getByText('resp_improved_fixture', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

  await submit.click()
  await expect(page.getByText('OpenAI 요청 실패', { exact: true })).toBeVisible()
  await expect(total.getByRole('cell')).toHaveText(['150', '—'])
  await expect(page.getByText('총 50 토큰 감소 (33.3%)', { exact: true })).toHaveCount(0)
  expect(attempts).toBe(2)
})
