import { test, expect } from '@playwright/test'
import { detail, login, mockApi, reply } from './fixtures'

test('share approval, revocation and reapproval use the preview version and restore shared state', async ({
  page,
}) => {
  await mockApi(page)
  let shared = false,
    version = 0
  const approvals: unknown[] = []
  await page.route('**/api/v1/feedbacks/11', (route) =>
    reply(route, {
      ...detail,
      sharing: {
        status: shared ? 'SHARED' : 'NOT_SHARED',
        version,
        sharedCaseId: shared ? 77 : null,
      },
    }),
  )
  await page.route('**/api/v1/feedbacks/11/share-preview', (route) =>
    reply(route, {
      previewId: 901,
      previewVersion: 1,
      redactionStatus: 'PASSED',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      content: {
        title: '공유 사례',
        type: 'MISSING_CONTEXT',
        problem: '맥락',
        improvement: '조건 정리',
        example: { before: '[원문 제외]', after: '대상과 조건을 정리합니다.' },
      },
    }),
  )
  await page.route('**/api/v1/feedbacks/11/share', (route) => {
    const body = route.request().postDataJSON()
    if (body.shared) {
      expect(body.expectedShareVersion).toBe(version)
      approvals.push(body)
    }
    shared = body.shared
    version++
    return reply(route, { shared, shareVersion: version, sharedCaseId: shared ? 77 : null })
  })
  await login(page)
  await page.getByRole('link', { name: '내 피드백', exact: true }).click()
  await page.getByRole('link', { name: '개선 내용 보기' }).click()
  await page.getByRole('button', { name: '공유 미리보기', exact: true }).click()
  await page.getByRole('button', { name: '이 내용으로 공유' }).click()
  await expect(page.getByRole('button', { name: '기존 공유 철회' })).toBeVisible()
  await expect(page.getByText('공유를 승인했습니다.')).toBeVisible()
  await page.getByRole('button', { name: '기존 공유 철회' }).click()
  await page.getByRole('button', { name: '공유 철회', exact: true }).click()
  await page.getByRole('button', { name: '공유 미리보기', exact: true }).click()
  await page.getByRole('button', { name: '이 내용으로 공유' }).click()
  await expect(page.getByRole('button', { name: '기존 공유 철회' })).toBeVisible()
  await expect(page.getByRole('button', { name: '공유 미리보기', exact: true })).toHaveCount(0)
  expect(approvals).toHaveLength(2)
})

test('failed redaction never exposes an approval button or the preview content', async ({
  page,
}) => {
  await mockApi(page)
  await page.route('**/api/v1/feedbacks/11', (route) =>
    reply(route, { ...detail, sharing: { status: 'NOT_SHARED', version: 0, sharedCaseId: null } }),
  )
  await page.route('**/api/v1/feedbacks/11/share-preview', (route) =>
    reply(route, {
      previewId: 901,
      previewVersion: 1,
      redactionStatus: 'FAILED',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      content: {
        title: 'SHOULD_NOT_RENDER',
        type: 'MISSING_CONTEXT',
        problem: '',
        improvement: '',
        example: { before: '', after: '' },
      },
    }),
  )
  await login(page)
  await page.getByRole('link', { name: '내 피드백', exact: true }).click()
  await page.getByRole('link', { name: '개선 내용 보기' }).click()
  await page.getByRole('button', { name: '공유 미리보기', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: '이 내용으로 공유' })).toHaveCount(0)
  await expect(page.getByText('SHOULD_NOT_RENDER')).toHaveCount(0)
})

test('expired preview cannot be approved', async ({ page }) => {
  await mockApi(page)
  await page.route('**/api/v1/feedbacks/11', (route) =>
    reply(route, { ...detail, sharing: { status: 'NOT_SHARED', version: 0, sharedCaseId: null } }),
  )
  await page.route('**/api/v1/feedbacks/11/share-preview', (route) =>
    reply(route, {
      previewId: 901,
      previewVersion: 1,
      redactionStatus: 'PASSED',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      content: {
        title: '공유 사례',
        type: 'MISSING_CONTEXT',
        problem: '',
        improvement: '',
        example: { before: '', after: '' },
      },
    }),
  )
  await login(page)
  await page.getByRole('link', { name: '내 피드백', exact: true }).click()
  await page.getByRole('link', { name: '개선 내용 보기' }).click()
  await page.getByRole('button', { name: '공유 미리보기', exact: true }).click()
  await expect(page.getByRole('button', { name: '이 내용으로 공유' })).toBeDisabled()
  await expect(page.getByRole('alert')).toContainText('미리보기가 만료')
})
