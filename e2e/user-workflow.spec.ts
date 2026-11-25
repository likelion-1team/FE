import { test, expect } from '@playwright/test'
import { mockApi, reply } from './fixtures'

test('workflow links guide the user from criteria to upload and from guides to the next conversation', async ({
  page,
}) => {
  await mockApi(page, { cookieSession: true })
  await page.goto('/teams/1/member/settings')
  const workflow = page.getByRole('navigation', { name: '업무 진행 단계' })
  await expect(workflow.getByRole('link', { name: '업무 준비' })).toHaveAttribute(
    'aria-current',
    'step',
  )
  await expect(page.getByText(/MVP|분모|분자|서버 권한/)).toHaveCount(0)
  await page.getByRole('link', { name: '대화 업로드로 이동' }).click()
  await expect(
    page.getByRole('heading', { name: '대화 업로드 · 대화 선택', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('main')).toBeFocused()
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await expect(workflow.getByRole('link', { name: '파일 올리기' })).toHaveAttribute(
    'aria-current',
    'step',
  )
  await workflow.getByRole('link', { name: '가이드 활용' }).click()
  await expect(page.getByText('팀이 함께 읽고 다음 업무에 활용하는 가이드입니다.')).toBeVisible()
  await page.getByRole('link', { name: '내 대화 업로드', exact: true }).click()
  await expect(page).toHaveURL('/teams/1/member/upload')
})

test('goal percentages are converted to API ratios and concurrent edits require review', async ({
  page,
}) => {
  await mockApi(page, { cookieSession: true })
  let goals = {
    version: 1,
    successRateMin: 0.75,
    errorReworkRateMax: 0.25,
    tokensPerSuccessMax: 2000,
    updatedAt: null,
  }
  let writes = 0
  await page.route('**/api/v1/teams/2/goals', (route) => {
    if (route.request().method() === 'GET') return reply(route, goals)
    writes++
    const body = route.request().postDataJSON()
    if (writes === 1) {
      expect(body).toMatchObject({
        expectedVersion: 1,
        successRateMin: 0.8,
        errorReworkRateMax: 0.2,
      })
      goals = { ...goals, version: 2, successRateMin: 0.9 }
      return reply(route, { code: 'VERSION_CONFLICT', message: '목표가 변경됐습니다.' }, 409)
    }
    expect(body.expectedVersion).toBe(2)
    goals = { ...goals, ...body, version: 3 }
    return reply(route, goals)
  })
  await page.goto('/teams/2/leader/dashboard')
  await page.getByRole('button', { name: '목표 수정' }).click()
  await expect(page.getByLabel('목표 성공률 · %')).toHaveValue('75')
  await page.getByLabel('목표 성공률 · %').fill('80')
  await page.getByLabel('허용 재작업률 · %').fill('20')
  await page.getByRole('button', { name: '목표 저장' }).click()
  await expect(
    page.getByText('다른 사람이 목표를 변경했습니다. 취소한 뒤 목표를 다시 확인해주세요.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: '목표 저장' })).toBeDisabled()
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await page.getByRole('button', { name: '목표 수정' }).click()
  await expect(page.getByLabel('목표 성공률 · %')).toHaveValue('90')
  await page.getByRole('button', { name: '목표 저장' }).click()
  await expect(page.getByRole('button', { name: '목표 수정' })).toBeVisible()
  expect(writes).toBe(2)
})
