import { test, expect } from '@playwright/test'
import { detail, feedback, login, mockApi, reply, teams } from './fixtures'

test('original source uses version id and never calls the removed conversation endpoint', async ({
  page,
}) => {
  const calls = await mockApi(page)
  await login(page)
  await page.getByRole('link', { name: '내 피드백', exact: true }).click()
  await page.getByRole('link', { name: '개선 내용 보기' }).click()
  await page.getByRole('button', { name: '근거 대화 원문', exact: true }).click()
  await expect(
    page.getByRole('dialog').getByText('<script>alert(1)</script> 표로 바꿔줘.'),
  ).toBeVisible()
  expect(calls.some((c) => c.path === '/conversation-versions/61')).toBe(true)
  expect(calls.some((c) => /^\/conversations\//.test(c.path))).toBe(false)
})
test('v3 feedback with null version and item ids stays readable without original button', async ({
  page,
}) => {
  const calls = await mockApi(page)
  await page.route('**/api/v1/teams/1/feedbacks*', (r) =>
    reply(r, {
      items: [
        {
          feedbackId: 11,
          itemId: null,
          conversationId: 21,
          conversationVersionId: null,
          type: 'MISSING_CONTEXT',
          title: feedback.title,
          occurrenceCount: 1,
          createdAt: '2026-11-22',
          reaction: null,
          sharingStatus: 'NOT_SHARED',
        },
      ],
      page: 1,
      size: 20,
      total: 1,
    }),
  )
  await page.route('**/api/v1/feedbacks/11', (r) =>
    reply(r, { ...detail, itemId: null, conversationVersionId: null, causes: [], limitations: [] }),
  )
  await login(page)
  await page.getByRole('link', { name: '내 피드백', exact: true }).click()
  await page.getByRole('link', { name: '개선 내용 보기' }).click()
  await expect(page.getByRole('heading', { name: feedback.title })).toBeVisible()
  await expect(page.getByRole('button', { name: '근거 대화 원문', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '원인 후보', exact: true })).toHaveCount(0)
  expect(calls.some((c) => c.path.includes('/conversation-versions/'))).toBe(false)
})
test('capability false hides team metrics and blocks direct route before requesting metrics', async ({
  page,
}) => {
  const calls = await mockApi(page, { cookieSession: true })
  await page.route('**/api/v1/teams?*', (r) =>
    reply(r, {
      items: teams.map((t) => ({
        ...t,
        capabilities: { ...t.capabilities, canViewTeamMetrics: false },
      })),
      page: 1,
      size: 100,
      total: 2,
    }),
  )
  await page.goto('/teams/1/member/team-dashboard')
  await expect(page.getByText('이 팀의 팀 성과 조회 권한이 없습니다.')).toBeVisible()
  await expect(page.getByRole('link', { name: '팀 성과', exact: true })).toHaveCount(0)
  expect(calls.some((c) => c.path.includes('/dashboard/'))).toBe(false)
})
test('leader role does not override denied management capabilities', async ({ page }) => {
  const calls = await mockApi(page)
  await page.route('**/api/v1/teams?*', (r) =>
    reply(r, {
      items: teams.map((t) => ({
        ...t,
        capabilities: {
          ...t.capabilities,
          canEditSettings: false,
          canManageMembers: false,
          canManageSharedCases: false,
        },
      })),
      page: 1,
      size: 100,
      total: 2,
    }),
  )
  await login(page, true)
  await page.getByRole('link', { name: '팀 설정', exact: true }).click()
  await expect(page.getByRole('heading', { name: '팀 설정 · 분석 기준' })).toBeVisible()
  await expect(page.getByRole('button', { name: '분석 대상 수정' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '이메일로 팀원 추가' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '공유 사례', exact: true })).toHaveCount(0)
  expect(calls.some((c) => c.path.endsWith('/members'))).toBe(false)
})
test('source deleted response removes original content and shows its error', async ({ page }) => {
  await mockApi(page, { cookieSession: true })
  await page.route('**/api/v1/conversation-versions/61*', (r) =>
    reply(r, { code: 'SOURCE_DELETED', message: '삭제된 원문입니다.' }, 410),
  )
  await page.goto('/teams/1/member/feedbacks/11')
  await page.getByRole('button', { name: '근거 대화 원문', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('삭제된 원문')
  await expect(page.getByRole('dialog').getByText('보고서 써줘.', { exact: true })).toHaveCount(0)
})
