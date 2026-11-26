import { test, expect } from '@playwright/test'
import { mockApi } from './fixtures'

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
