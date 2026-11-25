import { test, expect } from '@playwright/test'
import { detail, feedback, login, mockApi, reply } from './fixtures'

test('authoritative null reaction and NOT_SHARED override stale list state', async ({ page }) => {
  await mockApi(page)
  await page.route('**/api/v1/teams/1/feedbacks*', (r) =>
    reply(r, {
      days: [
        { date: '2026-11-22', feedbacks: [{ ...feedback, myReaction: 'HELPFUL', isShared: true }] },
      ],
    }),
  )
  await page.route('**/api/v1/feedbacks/11', (r) =>
    reply(r, {
      ...detail,
      itemId: 1,
      conversationId: 21,
      conversationVersionId: 22,
      evidenceMessageIds: [],
      limitations: [],
      reaction: null,
      sharing: { status: 'NOT_SHARED', version: 2, sharedCaseId: null },
    }),
  )
  await login(page)
  await page.getByRole('link', { name: '내 피드백', exact: true }).click()
  await page.getByRole('link', { name: '개선 내용 보기' }).click()
  await expect(page.getByRole('button', { name: '도움됨', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(page.getByRole('button', { name: '기존 공유 철회', exact: true })).toHaveCount(0)
})

test('withdrawn shared case is removed from an already open confirmation dialog', async ({
  page,
}) => {
  await mockApi(page)
  let revoked = false
  const shared = {
    sharedCaseId: 90,
    shareVersion: 2,
    taskTypeId: 7,
    type: 'MISSING_CONTEXT',
    title: '철회될 공유 사례',
    problem: '공유 내용',
    improvement: '개선',
    example: { before: '전', after: '후' },
    isGuide: false,
  }
  await page.route('**/api/v1/teams/2/shared-cases*', (r) =>
    reply(r, { items: revoked ? [] : [shared], page: 1, size: 20, total: revoked ? 0 : 1 }),
  )
  await login(page, true)
  await page.getByRole('link', { name: '공유 사례', exact: true }).click()
  await page.getByRole('button', { name: '개선 가이드로 지정' }).click()
  await expect(page.getByRole('dialog')).toContainText(shared.title)
  revoked = true
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
  await expect(page.getByRole('heading', { name: '공유된 사례가 없습니다' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('legacy feedback id cannot be submitted as a shared case id', async ({ page }) => {
  const calls = await mockApi(page)
  await page.route('**/api/v1/teams/2/shared-cases*', (r) =>
    reply(r, { items: [{ ...detail, isGuide: false, taskType: '보고서' }] }),
  )
  await login(page, true)
  await page.getByRole('link', { name: '공유 사례', exact: true }).click()
  await expect(page.getByRole('button', { name: '개선 가이드로 지정' })).toBeDisabled()
  expect(calls.some((c) => c.method === 'PUT' && c.path.includes('/guides/'))).toBe(false)
})
