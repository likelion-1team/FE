import { test, expect } from '@playwright/test'
import { login, mockApi } from './fixtures'

test('filter-option failure shows an error without an indefinite dependent loader', async ({
  page,
}) => {
  const calls = await mockApi(page)
  await page.route('**/api/v1/teams/*/dashboard/filter-options*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: '필터 정보를 불러올 수 없습니다.' }),
    }),
  )
  await login(page)
  await expect(page.getByRole('alert')).toContainText('필터 정보를 불러올 수 없습니다.')
  await expect(page.getByText('불러오는 중입니다.', { exact: true })).toHaveCount(0)
  expect(calls.some((c) => c.path.endsWith('/dashboard/kpis'))).toBe(false)
})

test('member and leader use server roles; member cannot enter manager pages', async ({ page }) => {
  const calls = await mockApi(page)
  await login(page)
  await expect(page.getByRole('link', { name: '공유 사례', exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: '분석 대상 · 기준' }).click()
  await expect(page.getByRole('button', { name: '분석 대상 수정' })).toHaveCount(0)
  expect(calls.filter((c) => c.path.endsWith('/members'))).toHaveLength(0)
  await page.goto('/teams/1/leader/settings')
  await expect(page).toHaveURL(/\/login/) // JSON refresh sessions deliberately do not survive reload.
})

test('team switch changes role, clears private UI and exposes manager controls', async ({
  page,
}) => {
  const calls = await mockApi(page)
  await login(page)
  await page.getByRole('button', { name: /콘텐츠 운영팀 · 팀 전환/ }).click()
  await page.getByRole('button', { name: '이 팀 선택 · 팀장' }).click()
  await expect(page.getByText('팀장 LEADER', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: '팀 설정', exact: true }).click()
  await page.getByRole('button', { name: '이메일로 팀원 추가' }).click()
  await page.getByLabel('가입된 이메일').fill('new@example.com')
  await page.getByRole('button', { name: '팀원 추가', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(
    calls.some(
      (c) =>
        c.method === 'POST' &&
        c.path === '/teams/2/members' &&
        JSON.parse(c.body!).email === 'new@example.com',
    ),
  ).toBe(true)
})

test('upload selects only eligible conversations and sends settingsVersion and selectionId with taskTypeId', async ({
  page,
}) => {
  const calls = await mockApi(page)
  await login(page)
  await page.getByRole('link', { name: '대화 업로드', exact: true }).click()
  await page.getByLabel('대화 파일 선택').setInputFiles({
    name: 'conversations.json',
    mimeType: 'application/json',
    buffer: Buffer.from('[]'),
  })
  await expect(page.getByRole('checkbox').nth(1)).toBeDisabled()
  await page.getByRole('checkbox').first().check()
  await page.getByRole('button', { name: '1건 분석 시작' }).click()
  await expect(page.getByRole('heading', { name: '분석 완료', exact: true })).toBeVisible()
  const start = calls.find((c) => c.path === '/uploads/31/analyses')!
  expect(JSON.parse(start.body!)).toEqual({
    settingsVersion: 3,
    selections: [{ selectionId: 'selection-1', taskTypeId: 7 }],
  })
  expect(calls.some((c) => c.path === '/analyses/41')).toBe(true)
})

test('upload errors remain errors and do not show false completion', async ({ page }) => {
  await mockApi(page, { uploadFail: true })
  await login(page)
  await page.getByRole('link', { name: '대화 업로드', exact: true }).click()
  await page
    .getByLabel('대화 파일 선택')
    .setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') })
  await expect(page.getByRole('alert')).toContainText('지원하지 않는 대화 구조')
  await expect(page.getByRole('checkbox')).toHaveCount(0)
})

test('feedback reaction cancellation, escaped originals, share revocation and pending v4 features', async ({
  page,
}) => {
  const calls = await mockApi(page)
  await login(page)
  await page.getByRole('link', { name: '내 피드백', exact: true }).click()
  await page.getByRole('link', { name: '개선 내용 보기' }).click()
  await page.getByRole('button', { name: '도움됨', exact: true }).click()
  await expect(page.getByRole('button', { name: '도움됨 · 선택됨' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: '도움됨 · 선택됨' }).click()
  await expect(page.getByText('반응을 취소했습니다.')).toBeVisible()
  await page.getByRole('button', { name: '근거 대화 원문', exact: true }).click()
  await expect(
    page.getByRole('dialog').getByText('<script>alert(1)</script> 표로 바꿔줘.'),
  ).toBeVisible()
  await page.getByRole('button', { name: '근거 대화 원문 닫기' }).click()
  await page.getByRole('button', { name: '기존 공유 철회' }).click()
  await page.getByRole('button', { name: '공유 철회', exact: true }).click()
  await expect(page.getByText('공유를 철회했습니다.')).toBeVisible()
  await expect(page.getByRole('button', { name: '업무 결과 확인', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '대화 삭제', exact: true })).toBeDisabled()
  expect(calls.some((c) => c.method === 'DELETE' && c.path.endsWith('/reaction'))).toBe(true)
  expect(calls.some((c) => c.path.endsWith('/share') && JSON.parse(c.body!).shared === false)).toBe(
    true,
  )
  expect(
    calls.some((c) => c.path.includes('share-preview') || c.path.includes('analysis-items')),
  ).toBe(false)
})

test('manager saves deployed settings shape and can manage guides', async ({ page }) => {
  const calls = await mockApi(page)
  await login(page, true)
  await page.getByRole('link', { name: '팀 설정', exact: true }).click()
  await page.getByRole('button', { name: '분석 대상 수정' }).click()
  await page.getByRole('dialog').getByLabel('업무 유형 · 1개').fill('프로젝트 보고서')
  await page.getByRole('button', { name: '설정 저장' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const saved = calls.find((c) => c.method === 'PUT' && c.path.endsWith('/settings'))!
  expect(JSON.parse(saved.body!)).toMatchObject({
    expectedVersion: 3,
    taskType: {
      name: '프로젝트 보고서',
      successConditions: ['필수 항목·수치·근거가 충족된 보고서'],
      failureConditions: ['필수 항목이 빠짐'],
      unknownConditions: ['업무 결과 확인 불가'],
    },
  })
  await page.getByRole('link', { name: '공유 사례', exact: true }).click()
  await page.getByRole('button', { name: '개선 가이드로 지정' }).click()
  await page.getByRole('button', { name: '가이드로 지정', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(calls.some((c) => c.method === 'PUT' && c.path === '/teams/2/guides/11')).toBe(true)
})

test('restricted team dashboard is an explicit 403, not zeros', async ({ page }) => {
  await mockApi(page)
  await login(page)
  await page.getByRole('link', { name: '팀 성과', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('팀장만 팀 집계')
  await expect(page.getByText('0.0%', { exact: true })).toHaveCount(0)
})

test('cookie sessions restore and incorrect role URLs redirect to the real team role', async ({
  page,
}) => {
  await mockApi(page, { cookieSession: true })
  await page.goto('/teams/1/leader/settings')
  await expect(page).toHaveURL(/\/teams\/1\/member\/dashboard/)
  await expect(page.getByText('팀원 MEMBER', { exact: true })).toBeVisible()
  expect(
    await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
  ).toEqual({ local: 0, session: 0 })
})

test('responsive member workspace has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockApi(page)
  await login(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.getByRole('link', { name: '내 피드백', exact: true }).click()
  await page.getByRole('link', { name: '개선 내용 보기' }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

test('signup checks email with GET and submits validated credentials', async ({ page }) => {
  const calls = await mockApi(page)
  await page.goto('/signup')
  await page.getByLabel('이름', { exact: true }).fill('새 사용자')
  await page.getByLabel('이메일', { exact: true }).fill('new@example.com')
  await page.getByRole('button', { name: '이메일 중복 확인' }).click()
  await expect(page.getByText('사용할 수 있는 이메일입니다.')).toBeVisible()
  await page.getByLabel('비밀번호', { exact: true }).fill('password123')
  await page.getByLabel('비밀번호 확인', { exact: true }).fill('password123')
  await page.getByRole('button', { name: '가입하기' }).click()
  await expect(page).toHaveURL(/\/login\?joined=1/)
  expect(calls.some((c) => c.method === 'GET' && c.path === '/auth/email-check')).toBe(true)
})
