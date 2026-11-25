import { test, expect } from '@playwright/test'
import { demoFile } from '../src/demo/data'

test('demo upload to feedback, metrics and guide remains isolated from production', async ({
  page,
}) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(request.url())
  })
  await page.goto('/demo')
  await expect(page.getByRole('note')).toContainText('샘플 데이터로 체험 중입니다')
  await page.getByText('파일로 업로드 체험하기', { exact: true }).click()
  await page.getByLabel('데모 파일 선택').setInputFiles({
    name: 'demo.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(demoFile)),
  })
  await page.getByRole('checkbox', { name: /신규 고객/ }).check()
  await page.getByRole('button', { name: '1건 분석 시작' }).click()
  await expect(page.getByRole('heading', { name: '분석 완료', exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('선택 1건 · 성공 1건 · 실패 0건')
  await page.getByRole('button', { name: '생성된 피드백 보기' }).click()
  await expect(page.getByRole('heading', { name: '맥락 누락', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '긴 대화', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '피드백 상세 보기 · 맥락 누락' }).click()
  await page.getByRole('button', { name: '근거 대화 보기' }).click()
  await expect(page.getByRole('region', { name: '근거 대화' })).toContainText('문제 근거')
  await page.getByRole('button', { name: '도움됨', exact: true }).click()
  await expect(page.getByRole('button', { name: '도움됨', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: '도움됨', exact: true }).click()
  await expect(page.getByRole('button', { name: '도움됨', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await page.getByRole('button', { name: '맥락 누락 · 피드백 닫기' }).click()
  await page.getByRole('button', { name: '4. 팀 성과' }).click()
  await expect(page.getByRole('heading', { name: '팀 성과', exact: true })).toBeFocused()
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await expect(page.getByText('2,000 토큰', { exact: true }).first()).toBeVisible()
  await page.getByRole('checkbox', { name: '기여자 4명인 비공개 상태 보기' }).check()
  await expect(page.getByText('2,000 토큰', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '5. 개선 가이드' }).click()
  await expect(page.getByRole('button', { name: '가이드에서 빼기' })).toHaveCount(0)
  await page.getByLabel('시연 역할').selectOption('leader')
  await page.getByRole('button', { name: '가이드에서 빼기' }).click()
  await expect(page.getByRole('heading', { name: '등록된 가이드가 없습니다' })).toBeVisible()
  await expect(page.getByText(/가이드에서 뺐습니다/)).toBeVisible()
  await expect(page.getByText(/위 공유 사례의/)).toBeVisible()
  await page.getByLabel('시연 역할').selectOption('member')
  await expect(page.getByRole('button', { name: '가이드에 추가' })).toHaveCount(0)
  await expect(page.getByText(/팀장이 가이드를 추가하면/)).toBeVisible()
  await page.getByLabel('시연 역할').selectOption('leader')
  await page.getByRole('button', { name: '가이드에 추가' }).click()
  await expect(page.getByText(/가이드에 추가했습니다/)).toBeVisible()
  await expect(
    page.getByRole('heading', { name: '고객과 제안 조건을 먼저 정리하기' }),
  ).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: '0건 분석 시작' })).toBeDisabled()
  expect(requests).toEqual([])
})

test('demo rejects real files, supports partial and failed results, and resets active analysis', async ({
  page,
}) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(request.url())
  })
  await page.goto('/demo')
  await page.getByText('파일로 업로드 체험하기', { exact: true }).click()
  await page.getByLabel('데모 파일 선택').setInputFiles({
    name: 'real.json',
    mimeType: 'application/json',
    buffer: Buffer.from('[{"title":"private"}]'),
  })
  await expect(page.getByRole('alert')).toContainText('제공된 데모 파일만 읽습니다')
  await page.getByRole('button', { name: '샘플 대화 불러오기' }).click()
  await page.getByRole('checkbox', { name: /신규 고객/ }).check()
  await page.getByText('다른 분석 결과 체험하기', { exact: true }).click()
  await page.getByLabel('분석 시나리오').selectOption('partial')
  await expect(page.getByRole('button', { name: '1건 분석 시작' })).toBeDisabled()
  await page.getByRole('checkbox', { name: /반복 수정/ }).check()
  await page.getByRole('button', { name: '2건 분석 시작' }).click()
  await expect(page.getByRole('heading', { name: '일부 분석 완료' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('성공 1건 · 실패 1건')
  await page.getByRole('button', { name: '다른 대화 분석하기' }).click()
  await page.getByText('다른 분석 결과 체험하기', { exact: true }).click()
  await page.getByLabel('분석 시나리오').selectOption('failure')
  await page.getByRole('button', { name: '2건 분석 시작' }).click()
  await expect(page.getByRole('heading', { name: '분석 실패', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '생성된 피드백 보기' })).toHaveCount(0)
  await page.getByRole('button', { name: '다른 대화 분석하기' }).click()
  await page.getByRole('button', { name: '2건 분석 시작' }).click()
  await page.getByRole('button', { name: '데모 초기화' }).click()
  await page.getByRole('button', { name: '2. 분석 진행' }).click()
  await expect(page.getByRole('heading', { name: '아직 분석을 시작하지 않았습니다' })).toBeVisible()
  await page.waitForTimeout(2800)
  await expect(page.getByRole('heading', { name: '아직 분석을 시작하지 않았습니다' })).toBeVisible()
  expect(requests).toEqual([])
})

test('demo mobile layout stays within viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/demo')
  await expect(page.getByRole('heading', { name: '대화 업로드', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})
