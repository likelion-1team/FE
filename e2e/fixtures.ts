import { expect, type Page, type Route } from '@playwright/test'

export const user = { userId: 1, name: '테스트 사용자', email: 'tester@example.com' }
export const teams = [
  {
    teamId: 1,
    name: '콘텐츠 운영팀',
    myRole: 'MEMBER',
    memberCount: 5,
    capabilities: {
      canViewOwnData: true,
      canViewTeamMetrics: true,
      canEditSettings: false,
      canEditGoals: false,
      canManageMembers: false,
      canManageSharedCases: false,
    },
  },
  {
    teamId: 2,
    name: '서비스 기획팀',
    myRole: 'LEADER',
    memberCount: 4,
    capabilities: {
      canViewOwnData: true,
      canViewTeamMetrics: true,
      canEditSettings: true,
      canEditGoals: true,
      canManageMembers: true,
      canManageSharedCases: true,
    },
  },
]
export const settings = {
  version: 3,
  taskType: {
    taskTypeId: 7,
    name: '주간 보고서 작성',
    successConditions: ['필수 항목·수치·근거가 충족된 보고서'],
    failureConditions: ['필수 항목이 빠짐'],
    unknownConditions: ['업무 결과 확인 불가'],
  },
  targetFrom: '2026-11-01',
  targetTo: '2026-11-30',
  onboardingStartDate: '2026-11-16',
  targetCount: 120,
  policies: {
    policyVersion: 1,
    minSampleSize: 20,
    minTeamContributors: 5,
    minOutcomeConfirmationRate: 0.8,
    uploadRetentionMinutes: 60,
    maxSelectionsPerRequest: 100,
  },
}
export const analysis = {
  analysisId: 41,
  uploadId: 31,
  settingsVersion: 3,
  status: 'SUCCEEDED',
  selectedCount: 1,
  completedCount: 1,
  succeededCount: 1,
  failedCount: 0,
  progressPercent: 100,
  pollAfterSeconds: 3,
  stage: 'COMPLETED',
}
export const candidateItems = [
  {
    selectionId: 'selection-1',
    externalId: 'c1',
    title: '11월 보고서',
    startedAt: '2026-11-10',
    duplicateType: 'NONE',
    selectable: true,
    validationCode: null,
  },
  {
    selectionId: 'selection-duplicate',
    externalId: 'duplicate',
    title: '이미 분석된 대화',
    startedAt: '2026-11-05',
    duplicateType: 'SAME_CONTENT',
    selectable: false,
    validationCode: 'ALREADY_ANALYZED',
  },
]
export const feedback = {
  feedbackId: 11,
  type: '맥락 누락',
  title: '요구사항을 한 번에 구조화하세요',
  occurrenceCount: 3,
  isShared: true,
  myReaction: null,
}
export const detail = {
  ...feedback,
  itemId: 51,
  conversationId: 21,
  conversationVersionId: 61,
  evidenceMessageIds: ['message-2'],
  limitations: [],
  reaction: null,
  sharing: { status: 'SHARED', version: 1, sharedCaseId: 11 },
  problem: '형식과 제약이 대화 도중 추가됐습니다.',
  causes: ['최초 요청의 완료 기준이 구체적이지 않았을 수 있습니다.'],
  improvement: '목적·독자·필수 항목·출력 형식을 함께 전달하세요.',
  example: { before: '보고서 써줘.', after: '완료 업무와 계획을 근거와 함께 표로 정리해줘.' },
  evidences: [{ conversationId: 21, turnIndexes: [2] }],
}
export async function reply(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(status >= 400 ? data : { code: 'S200', data }),
  })
}

export async function mockApi(
  page: Page,
  options: { cookieSession?: boolean; uploadFail?: boolean; membersFail?: boolean } = {},
) {
  const calls: { method: string; path: string; body: string | null }[] = []
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace('/api/v1', ''),
      method = req.method()
    calls.push({ method, path, body: req.postData() })
    if (path === '/auth/refresh')
      return options.cookieSession
        ? reply(route, { accessToken: 'cookie-access', expiresIn: 900 })
        : reply(route, { code: 'VALIDATION_FAILED', message: '갱신 세션 없음' }, 400)
    if (path === '/auth/login')
      return reply(route, {
        ...user,
        user,
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
      })
    if (path === '/auth/email-check')
      return method === 'GET' && url.searchParams.has('email')
        ? reply(route, { available: true })
        : reply(route, { code: 'AUTH_REQUIRED' }, 401)
    if (path === '/auth/signup') return reply(route, { userId: 1 }, 201)
    if (path === '/auth/logout') return route.fulfill({ status: 204 })
    if (path === '/users/me') return reply(route, user)
    if (path === '/teams' && method === 'GET')
      return reply(route, { items: teams, page: 1, size: 100, total: teams.length })
    if (path === '/teams' && method === 'POST') return reply(route, { teamId: 3 }, 201)
    if (/\/teams\/\d+\/settings/.test(path))
      return reply(
        route,
        method === 'PUT'
          ? {
              ...settings,
              ...req.postDataJSON(),
              taskType: { ...settings.taskType, ...req.postDataJSON().taskType },
              version: 4,
            }
          : settings,
      )
    if (/\/teams\/\d+\/members/.test(path))
      return options.membersFail
        ? reply(route, { message: '팀원 목록 오류' }, 500)
        : reply(
            route,
            method === 'POST'
              ? { userId: 3, name: '새 팀원', role: 'MEMBER' }
              : {
                  items: [{ ...user, role: 'LEADER', submitted: true }],
                  page: 1,
                  size: 100,
                  total: 1,
                },
          )
    if (/\/teams\/\d+\/goals$/.test(path)) {
      const saved = method === 'PUT' ? req.postDataJSON() : null
      return reply(route, {
        version: saved ? saved.expectedVersion + 1 : 0,
        successRateMin: saved ? saved.successRateMin : null,
        errorReworkRateMax: saved ? saved.errorReworkRateMax : null,
        tokensPerSuccessMax: saved ? saved.tokensPerSuccessMax : null,
        updatedAt: saved ? '2026-11-24T10:20:00+09:00' : null,
      })
    }
    if (/\/teams\/\d+\/submissions$/.test(path))
      return reply(route, {
        settingsVersion: 3,
        submittedMembers: 3,
        totalMembers: 5,
        analyzedConversations: 42,
        targetCount: 120,
        coverageRatio: 0.35,
        status: 'AVAILABLE',
      })
    if (/\/teams\/\d+\/dashboard\/filter-options/.test(path))
      return reply(route, {
        taskTypes: [{ id: 7, name: '주간 보고서 작성' }],
        models: [],
        dataFrom: '2026-11-01',
        dataTo: '2026-11-30',
      })
    if (path.endsWith('/dashboard/kpis')) {
      if (path.startsWith('/teams/1/') && url.searchParams.get('scope') === 'TEAM')
        return reply(
          route,
          { code: 'LEADER_ONLY', message: '현재 서버에서는 팀장만 팀 집계를 조회할 수 있습니다.' },
          403,
        )
      return reply(route, {
        tokensPerSuccess: { value: 1250, estimated: true },
        reworkRate: { value: 0.18 },
        successRate: { value: 0.92 },
        conversationCount: { value: 14 },
        coverage: {
          submittedMembers: 3,
          totalMembers: 5,
          analyzedConversations: 42,
          targetCount: 120,
        },
      })
    }
    if (path.endsWith('/dashboard/trends'))
      return reply(route, {
        metric: url.searchParams.get('metric'),
        estimated: true,
        points: [
          { date: '2026-11-02', value: 1560, conversationCount: 4 },
          { date: '2026-11-09', value: null, conversationCount: 1, insufficientSample: true },
          { date: '2026-11-16', value: 1250, conversationCount: 9 },
        ],
      })
    if (/\/teams\/\d+\/uploads/.test(path) && method === 'POST')
      return options.uploadFail
        ? reply(
            route,
            { code: 'UNSUPPORTED_STRUCTURE', message: '지원하지 않는 대화 구조입니다.' },
            422,
          )
        : reply(route, {
            uploadId: 31,
            conversations: [
              {
                externalId: 'c1',
                title: '11월 보고서',
                startedAt: '2026-11-10',
                isDuplicate: false,
              },
              {
                externalId: 'duplicate',
                title: '이미 분석된 대화',
                startedAt: '2026-11-05',
                isDuplicate: true,
              },
            ],
          })
    if (/\/teams\/\d+\/uploads/.test(path))
      return reply(route, {
        content: [
          {
            uploadId: 31,
            uploadedAt: '2026-11-22',
            analyzedCount: 1,
            period: { from: '2026-11-01', to: '2026-11-30' },
            status: 'DONE',
          },
        ],
        page: 0,
        size: 10,
        totalElements: 1,
      })
    if (path === '/uploads/31/conversations')
      return reply(route, {
        items: candidateItems.filter((c) => c.title.includes(url.searchParams.get('q') || '')),
        page: 1,
        size: 20,
        total: candidateItems.length,
      })
    if (path === '/uploads/31/analyses') {
      const body = req.postDataJSON()
      if (
        body.settingsVersion !== 3 ||
        body.selections?.some((x: Record<string, unknown>) => !x.selectionId || x.externalId) ||
        !req.headers()['idempotency-key']
      )
        return reply(route, { message: '잘못된 분석 계약' }, 422)
      return reply(route, { ...analysis, status: 'QUEUED' }, 202)
    }
    if (path === '/analyses/41') return reply(route, analysis)
    if (path === '/analyses/41/items')
      return reply(route, {
        items: [
          {
            itemId: 51,
            conversationId: 21,
            conversationVersionId: 61,
            status: 'SUCCEEDED',
            scopeClassification: 'IN_SCOPE',
            failureCode: null,
            feedbackIds: [11],
          },
        ],
        page: 1,
        size: 20,
        total: 1,
      })
    if (path === '/uploads/31')
      return reply(route, {
        status: 'DONE',
        progress: 100,
        savedCount: 1,
        skippedDuplicateCount: 0,
      })
    if (path.endsWith('/feedbacks'))
      return reply(route, { days: [{ date: '2026-11-22', feedbacks: [feedback] }] })
    if (path === '/feedbacks/11') return reply(route, detail)
    if (path === '/feedbacks/11/reaction')
      return method === 'DELETE'
        ? route.fulfill({ status: 204 })
        : reply(route, { reaction: req.postDataJSON().reaction })
    if (path === '/feedbacks/11/share') return reply(route, { isShared: req.postDataJSON().shared })
    if (path === '/teams/2/guides/11')
      return method === 'DELETE' ? route.fulfill({ status: 204 }) : reply(route, { isGuide: true })
    if (path === '/conversation-versions/61')
      return reply(route, {
        title: '주간 보고서',
        startedAt: '2026-11-22',
        conversationVersionId: 61,
        highlightMessageIds: ['message-2'],
        messages: [
          { messageId: 'message-1', role: 'USER', content: '보고서 써줘.' },
          {
            messageId: 'message-2',
            role: 'USER',
            content: '<script>alert(1)</script> 표로 바꿔줘.',
          },
        ],
      })
    if (path.endsWith('/guides'))
      return reply(route, {
        groups: [{ type: '맥락 누락', guides: [{ ...detail, guideAddedAt: '2026-11-22' }] }],
      })
    if (path.endsWith('/shared-cases'))
      return reply(route, {
        items: [
          {
            sharedCaseId: 11,
            shareVersion: 1,
            taskTypeId: 7,
            type: detail.type,
            title: detail.title,
            problem: detail.problem,
            improvement: detail.improvement,
            example: detail.example,
            isGuide: false,
          },
        ],
        page: 1,
        size: 100,
        total: 1,
      })
    return reply(route, { code: 'NOT_FOUND', message: `Unhandled mock: ${method} ${path}` }, 404)
  })
  return calls
}
export async function login(page: Page, leader = false) {
  await page.goto('/login')
  await page.getByLabel('이메일', { exact: true }).fill(user.email)
  await page.getByLabel('비밀번호', { exact: true }).fill('password123')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '내 팀 목록' })).toBeVisible()
  await page
    .getByRole('button', { name: leader ? '이 팀 선택 · 팀장' : '이 팀 선택 · 팀원' })
    .click()
  await expect(page.getByRole('heading', { name: '나의 AI 업무 성과' })).toBeVisible()
}
