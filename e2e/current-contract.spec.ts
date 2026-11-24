import { test, expect } from '@playwright/test'
import { analysis, candidateItems, login, mockApi, reply, settings } from './fixtures'

async function upload(page: import('@playwright/test').Page) {
  await login(page)
  await page.getByRole('link', { name: '대화 업로드', exact: true }).click()
  await page.getByLabel('대화 파일 선택').setInputFiles({
    name: 'conversations.json',
    mimeType: 'application/json',
    buffer: Buffer.from('[]'),
  })
}

test('unset v4 criteria block upload without treating null taskType as malformed', async ({
  page,
}) => {
  await mockApi(page)
  await page.route('**/api/v1/teams/*/settings', (route) =>
    reply(route, { ...settings, version: 0, taskType: null, targetFrom: null, targetTo: null }),
  )
  await login(page)
  await page.getByRole('link', { name: '대화 업로드', exact: true }).click()
  await expect(page.getByRole('heading', { name: '분석 기준 설정이 필요합니다' })).toBeVisible()
  await expect(page.getByLabel('대화 파일 선택')).toHaveCount(0)
})

test('settings conflict preserves edits and requires explicit reload before another save', async ({
  page,
}) => {
  await mockApi(page)
  await page.route('**/api/v1/teams/2/settings', (route) =>
    route.request().method() === 'PUT'
      ? reply(route, { code: 'VERSION_CONFLICT', message: '최신 버전은 4입니다.' }, 409)
      : reply(route, settings),
  )
  await login(page, true)
  await page.getByRole('link', { name: '팀 설정', exact: true }).click()
  await page.getByRole('button', { name: '분석 대상 수정' }).click()
  await page.getByRole('dialog').getByLabel('업무 유형 · 1개').fill('내가 수정한 업무')
  await page.getByRole('button', { name: '설정 저장' }).click()
  await expect(page.getByRole('dialog').getByLabel('업무 유형 · 1개')).toHaveValue(
    '내가 수정한 업무',
  )
  await expect(page.getByRole('button', { name: '설정 저장' })).toBeDisabled()
  await page.getByRole('button', { name: '최신 기준 불러오기' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('candidate selection survives paging and search and never submits externalId', async ({
  page,
}) => {
  const calls = await mockApi(page)
  await page.route('**/api/v1/uploads/31/conversations*', (route) => {
    const url = new URL(route.request().url()),
      current = Number(url.searchParams.get('page'))
    return reply(route, {
      items: [
        current === 1
          ? candidateItems[0]
          : {
              ...candidateItems[0],
              selectionId: 'selection-2',
              externalId: 'c2',
              title: '두 번째 보고서',
            },
      ],
      page: current,
      size: 1,
      total: 2,
    })
  })
  await upload(page)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: '다음 대화' }).click()
  await expect(page.getByText('두 번째 보고서', { exact: true })).toBeVisible()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: '2건 분석 시작' }).click()
  await expect(page).toHaveURL(/analysisId=41/)
  const body = JSON.parse(calls.find((c) => c.path === '/uploads/31/analyses')!.body!)
  expect(body).toEqual({
    settingsVersion: 3,
    selections: [
      { selectionId: 'selection-1', taskTypeId: 7 },
      { selectionId: 'selection-2', taskTypeId: 7 },
    ],
  })
})

test('expired candidate list prevents analysis submission and shows server failure', async ({
  page,
}) => {
  const calls = await mockApi(page)
  await page.route('**/api/v1/uploads/31/conversations*', (route) =>
    reply(route, { code: 'UPLOAD_EXPIRED', message: '업로드 선택 시간이 만료됐습니다.' }, 410),
  )
  await upload(page)
  await expect(page.getByRole('alert')).toContainText('선택 시간이 만료')
  await expect(page.getByRole('button', { name: '분석할 대화를 선택하세요' })).toBeDisabled()
  expect(calls.some((c) => c.path.endsWith('/analyses'))).toBe(false)
})

test('analysis polls by analysisId, stops on partial success and exposes failed items', async ({
  page,
}) => {
  await page.clock.install()
  await mockApi(page, { cookieSession: true })
  let polls = 0
  await page.route('**/api/v1/analyses/41', (route) => {
    polls++
    return reply(
      route,
      polls === 1
        ? {
            ...analysis,
            status: 'RUNNING',
            selectedCount: 2,
            completedCount: 0,
            succeededCount: 0,
            progressPercent: 0,
          }
        : {
            ...analysis,
            status: 'PARTIALLY_SUCCEEDED',
            selectedCount: 2,
            completedCount: 2,
            failedCount: 1,
          },
    )
  })
  await page.route('**/api/v1/analyses/41/items*', (route) =>
    reply(route, {
      items: [
        {
          itemId: 1,
          conversationId: 21,
          conversationVersionId: 101,
          status: 'SUCCEEDED',
          scopeClassification: 'IN_SCOPE',
          failureCode: null,
          feedbackIds: [11],
        },
        {
          itemId: 2,
          conversationId: 22,
          conversationVersionId: 102,
          status: 'FAILED',
          scopeClassification: null,
          failureCode: 'MODEL_TIMEOUT',
          feedbackIds: [],
        },
      ],
      page: 1,
      size: 20,
      total: 2,
    }),
  )
  await page.goto('/teams/1/member/history?analysisId=41')
  await expect(page.getByRole('heading', { name: '분석 중', exact: true })).toBeVisible()
  await page.clock.fastForward(3500)
  await expect(page.getByRole('heading', { name: '일부 분석 완료' })).toBeVisible()
  await expect(page.getByText('실패 사유: MODEL_TIMEOUT')).toBeVisible()
  await expect(page.getByRole('link', { name: '피드백 11 보기' })).toBeVisible()
  const completedPolls = polls
  await page.clock.fastForward(20000)
  expect(polls).toBe(completedPolls)
})

test('unknown analysis success response is an explicit error without false completion', async ({
  page,
}) => {
  await mockApi(page, { cookieSession: true })
  await page.route('**/api/v1/analyses/41', (route) =>
    reply(route, { ...analysis, status: 'DONE' }),
  )
  await page.goto('/teams/1/member/history?analysisId=41')
  await expect(page.getByRole('alert')).toContainText('서버 응답 형식')
  await expect(page.getByRole('heading', { name: '분석 완료', exact: true })).toHaveCount(0)
})

test('selection limit comes from server policy and updated content remains selectable', async ({
  page,
}) => {
  await mockApi(page)
  await page.route('**/api/v1/teams/*/settings', (route) =>
    reply(route, { ...settings, policies: { ...settings.policies, maxSelectionsPerRequest: 1 } }),
  )
  await page.route('**/api/v1/uploads/31/conversations*', (route) =>
    reply(route, {
      items: [
        candidateItems[0],
        {
          ...candidateItems[0],
          selectionId: 'updated',
          title: '갱신된 대화',
          duplicateType: 'CONTENT_UPDATED',
        },
      ],
      page: 1,
      size: 20,
      total: 2,
    }),
  )
  await upload(page)
  await expect(page.getByRole('checkbox').nth(1)).toBeEnabled()
  await page.getByRole('checkbox').first().check()
  await expect(page.getByRole('checkbox').nth(1)).toBeDisabled()
  await page.getByRole('checkbox').first().uncheck()
  await expect(page.getByRole('checkbox').nth(1)).toBeEnabled()
})

test('ambiguous analysis timeout retries the same idempotency key', async ({ page }) => {
  await mockApi(page)
  const keys: string[] = []
  await page.route('**/api/v1/uploads/31/analyses', (route) => {
    keys.push(route.request().headers()['idempotency-key'])
    return keys.length === 1 ? route.abort('failed') : reply(route, analysis, 202)
  })
  await upload(page)
  await page.getByRole('checkbox').first().check()
  await page.getByRole('button', { name: '1건 분석 시작' }).click()
  await expect(page.getByRole('alert')).toContainText('서버에 연결할 수 없습니다')
  await page.getByRole('button', { name: '1건 분석 시작' }).click()
  await expect(page).toHaveURL(/analysisId=41/)
  expect(keys).toHaveLength(2)
  expect(keys[1]).toBe(keys[0])
})
