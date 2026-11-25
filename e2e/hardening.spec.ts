import { test, expect } from '@playwright/test'
import { detail, login, mockApi } from './fixtures'

test('failed cookie logout stays logged out after reload and allows explicit login', async ({
  page,
}) => {
  const calls = await mockApi(page, { cookieSession: true })
  await page.route('**/api/v1/auth/logout', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'temporarily unavailable' }),
    }),
  )
  await page.goto('/teams/2/leader/dashboard')
  await page.getByRole('heading', { name: '나의 AI 업무 성과' }).waitFor()
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('이 기기의 자동 로그인은 중지했습니다.')
  const refreshCount = calls.filter((call) => call.path === '/auth/refresh').length
  await page.reload()
  await expect(page.getByRole('heading', { name: '로그인', exact: true })).toBeVisible()
  expect(calls.filter((call) => call.path === '/auth/refresh')).toHaveLength(refreshCount)
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }))
  expect(stored).not.toContain('cookie-access')
  await page.getByLabel('이메일', { exact: true }).fill('tester@example.com')
  await page.getByLabel('비밀번호', { exact: true }).fill('password123')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).toHaveURL('/teams')
  expect(await page.evaluate(() => localStorage.getItem('ai-work:logout-state'))).toBeNull()
})

test('pending logout immediately removes private routes and exposes a bounded status', async ({
  page,
}) => {
  await mockApi(page, { cookieSession: true })
  let release: (() => void) | undefined
  await page.route('**/api/v1/auth/logout', async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve
    })
    await route.fulfill({ status: 204 }).catch(() => {})
  })
  await page.goto('/teams/2/leader/dashboard')
  await page.getByRole('heading', { name: '나의 AI 업무 성과' }).waitFor()
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await expect(page).toHaveURL('/login')
  await expect(page.getByText('로그아웃 처리 중입니다.', { exact: false })).toBeVisible()
  await expect(page.getByRole('link', { name: '팀 설정', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeDisabled()
  release?.()
  await expect(page.getByText('로그아웃했습니다.', { exact: true })).toBeVisible()
})

test('logout intent propagates to another tab', async ({ page, context }) => {
  await mockApi(page, { cookieSession: true })
  const other = await context.newPage()
  await mockApi(other, { cookieSession: true })
  await Promise.all([
    page.goto('/teams/2/leader/dashboard'),
    other.goto('/teams/1/member/dashboard'),
  ])
  await Promise.all([
    page.getByRole('heading', { name: '나의 AI 업무 성과' }).waitFor(),
    other.getByRole('heading', { name: '나의 AI 업무 성과' }).waitFor(),
  ])
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await expect(other).toHaveURL('/login')
  await other.reload()
  await expect(other.getByRole('heading', { name: '로그인', exact: true })).toBeVisible()
})

test('logout in another tab also blocks an older pending login response', async ({
  page,
  context,
}) => {
  await mockApi(page)
  let release: (() => void) | undefined
  let started: (() => void) | undefined
  const pending = new Promise<void>((resolve) => {
    started = resolve
  })
  await page.route('**/api/v1/auth/login', async (route) => {
    started?.()
    await new Promise<void>((resolve) => {
      release = resolve
    })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          accessToken: 'late-access',
          user: { userId: 1, name: '사용자', email: 'tester@example.com' },
        },
      }),
    })
  })
  await page.goto('/login')
  await page.getByLabel('이메일', { exact: true }).fill('tester@example.com')
  await page.getByLabel('비밀번호', { exact: true }).fill('password123')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await pending
  const other = await context.newPage()
  await mockApi(other, { cookieSession: true })
  await other.goto('/teams/2/leader/dashboard')
  await other.getByRole('heading', { name: '나의 AI 업무 성과' }).waitFor()
  await other.getByRole('button', { name: '로그아웃', exact: true }).click()
  await expect(page.getByText('로그아웃했습니다.', { exact: true })).toBeVisible()
  release?.()
  await expect(page.getByRole('alert')).toContainText('로그인 중 세션이 변경됐습니다.')
  await expect(page).toHaveURL('/login')
  expect(await page.evaluate(() => localStorage.getItem('ai-work:logout-state'))).not.toBeNull()
})

test('late analysis acceptance cannot navigate a newly selected team', async ({ page }) => {
  await mockApi(page)
  let release: (() => void) | undefined
  let accepted: (() => void) | undefined
  const started = new Promise<void>((resolve) => {
    accepted = resolve
  })
  await page.route('**/api/v1/uploads/31/analyses', async (route) => {
    accepted?.()
    await new Promise<void>((resolve) => {
      release = resolve
    })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          analysisId: 41,
          uploadId: 31,
          status: 'QUEUED',
          selectedCount: 1,
          pollAfterSeconds: 3,
        },
      }),
    })
  })
  await login(page)
  await page.getByRole('link', { name: '대화 업로드', exact: true }).click()
  await page.getByLabel('대화 파일 선택').setInputFiles({
    name: 'conversations.json',
    mimeType: 'application/json',
    buffer: Buffer.from('[]'),
  })
  await page.getByRole('checkbox').first().check()
  await page.getByRole('button', { name: '1건 분석 시작' }).click()
  await started
  await page.getByRole('button', { name: /콘텐츠 운영팀 · 팀 전환/ }).click()
  await page.getByRole('button', { name: '이 팀 선택 · 팀장' }).click()
  await expect(page).toHaveURL('/teams/2/leader/dashboard')
  const response = page.waitForResponse((r) => r.url().endsWith('/uploads/31/analyses'))
  release?.()
  await (await response).finished()
  await page.waitForTimeout(200)
  await expect(page).toHaveURL('/teams/2/leader/dashboard')
  await expect(page.getByText('팀장', { exact: true })).toBeVisible()
})

test('invalid successful JSON preserves navigation and can be retried', async ({ page }) => {
  await mockApi(page, { cookieSession: true })
  let broken = true
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/api/v1/feedbacks/11', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { ...detail, causes: broken ? null : [] } }),
    }),
  )
  await page.goto('/teams/1/member/feedbacks/11')
  await expect(page.getByRole('alert')).toContainText('서버 응답 형식이 올바르지 않습니다.')
  await expect(page.getByRole('navigation', { name: '업무 공간 메뉴' })).toBeVisible()
  expect(errors).toHaveLength(0)
  broken = false
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page.getByRole('heading', { name: detail.title })).toBeVisible()
})

async function changingGuide(page: import('@playwright/test').Page) {
  await mockApi(page, { cookieSession: true })
  let revoked = false
  await page.route('**/api/v1/teams/2/guides*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          groups: revoked
            ? []
            : [{ type: '맥락 누락', guides: [{ ...detail, guideAddedAt: '2026-11-22' }] }],
        },
      }),
    }),
  )
  await page.goto('/teams/2/leader/guides')
  await page.getByRole('heading', { name: detail.title }).waitFor()
  return () => {
    revoked = true
  }
}

test('guide withdrawal is revalidated on return to the screen', async ({ page }) => {
  const revoke = await changingGuide(page)
  revoke()
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
  await expect(page.getByRole('heading', { name: '등록된 개선 가이드가 없습니다' })).toBeVisible()
  await expect(page.getByRole('heading', { name: detail.title })).toHaveCount(0)
})

test('copy revalidation blocks a withdrawn guide before the next poll', async ({ page }) => {
  const revoke = await changingGuide(page)
  await page.evaluate(() => {
    const audit = window as Window & { copiedCount?: number }
    audit.copiedCount = 0
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          audit.copiedCount = (audit.copiedCount ?? 0) + 1
        },
      },
      configurable: true,
    })
  })
  revoke()
  await page.getByRole('button', { name: '가이드 프롬프트 복사' }).click()
  await expect(page.getByRole('heading', { name: '등록된 개선 가이드가 없습니다' })).toBeVisible()
  expect(await page.evaluate(() => (window as Window & { copiedCount?: number }).copiedCount)).toBe(
    0,
  )
})

test('shared content is polled while the screen stays open', async ({ page }) => {
  await page.clock.install()
  const revoke = await changingGuide(page)
  revoke()
  await page.clock.fastForward(16000)
  await expect(page.getByRole('heading', { name: '등록된 개선 가이드가 없습니다' })).toBeVisible()
})
