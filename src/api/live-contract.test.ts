import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from './service'
import { clearSession } from './client'
import { resetLogoutIntent } from '../session-policy'
const json = (data: unknown) =>
  new Response(JSON.stringify({ data }), { headers: { 'content-type': 'application/json' } })
beforeEach(() => {
  resetLogoutIntent()
  clearSession()
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
  clearSession()
})
it('reads all team pages without assuming a bare array', async () => {
  const team = { teamId: 4, name: '시연팀', myRole: 'LEADER', memberCount: 6 }
  vi.mocked(fetch)
    .mockResolvedValueOnce(json({ items: [team], page: 1, size: 1, total: 2 }))
    .mockResolvedValueOnce(json({ items: [{ ...team, teamId: 5 }], page: 2, size: 1, total: 2 }))
  expect(await api.teams()).toHaveLength(2)
  expect(String(vi.mocked(fetch).mock.calls[1][0])).toContain('page=2')
})
const codes = ['tokensPerConfirmedSuccess', 'errorReworkRate', 'confirmedSuccessRate']
const metrics = codes.map((code) => ({
  code,
  value: null,
  status: 'SUPPRESSED',
  assessmentSource: 'SELF_REPORT',
  valueSource: 'USER_INPUT',
  sampleSize: null,
  reasonCodes: [],
}))
it('preserves suppressed metrics and null coverage instead of creating zeros', async () => {
  vi.mocked(fetch).mockResolvedValue(json({ scope: 'TEAM', metrics, coverage: null }))
  const result = await api.kpis('4', {
    scope: 'TEAM',
    weekStart: '2026-11-16',
    settingsVersion: '1',
    from: '2026-11-01',
    to: '2026-11-30',
    unit: 'DAY',
  })
  expect(result.successRate).toMatchObject({ value: null, status: 'SUPPRESSED' })
  expect(result.conversationCount.value).toBeNull()
  const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]), 'https://example.test')
  expect(url.searchParams.get('weekStart')).toBe('2026-11-16')
  expect(url.searchParams.has('from')).toBe(false)
  expect(url.searchParams.has('unit')).toBe(false)
})
it('preserves null trend sample size when privacy suppression applies', async () => {
  vi.mocked(fetch).mockResolvedValue(
    json({ scope: 'TEAM', points: [{ periodStart: '2026-11-16', metric: metrics[0] }] }),
  )
  const result = await api.trends('4', {
    scope: 'TEAM',
    weekStart: '2026-11-16',
    settingsVersion: '1',
    metric: 'tokensPerSuccess',
    unit: 'WEEK',
  })
  expect(result.points[0]).toMatchObject({
    value: null,
    conversationCount: null,
    status: 'SUPPRESSED',
  })
})
it('records a confirmed outcome against the current confirmation version', async () => {
  vi.mocked(fetch).mockResolvedValue(
    json({
      itemId: 31,
      version: 1,
      outcome: 'SUCCESS',
      source: 'SELF_REPORT',
      assessedAt: '2026-11-24T10:20:00+09:00',
    }),
  )
  await expect(
    api.outcome(31, { expectedVersion: 0, outcome: 'SUCCESS', note: '보고서에 사용' }),
  ).resolves.toMatchObject({ version: 1, outcome: 'SUCCESS' })
  const [url, init] = vi.mocked(fetch).mock.calls[0]
  expect(String(url)).toContain('/analysis-items/31/outcome')
  expect(init?.method).toBe('PUT')
  expect(JSON.parse(String(init?.body))).toEqual({
    expectedVersion: 0,
    outcome: 'SUCCESS',
    note: '보고서에 사용',
  })
})
it('keeps suppressed submission counts null instead of turning them into zero', async () => {
  vi.mocked(fetch).mockResolvedValue(
    json({
      settingsVersion: null,
      submittedMembers: 4,
      totalMembers: 6,
      analyzedConversations: null,
      targetCount: null,
      coverageRatio: null,
      status: 'SUPPRESSED',
    }),
  )
  await expect(api.submissions('4')).resolves.toMatchObject({
    status: 'SUPPRESSED',
    submittedMembers: 4,
    analyzedConversations: null,
    coverageRatio: null,
  })
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('/teams/4/submissions')
})
it('replaces every team goal so an omitted target is cleared', async () => {
  vi.mocked(fetch).mockResolvedValue(
    json({
      version: 2,
      successRateMin: 0.8,
      errorReworkRateMax: null,
      tokensPerSuccessMax: 1200,
      updatedAt: '2026-11-24T10:20:00+09:00',
    }),
  )
  await expect(
    api.updateGoals('4', {
      expectedVersion: 1,
      successRateMin: 0.8,
      errorReworkRateMax: null,
      tokensPerSuccessMax: 1200,
    }),
  ).resolves.toMatchObject({ version: 2, errorReworkRateMax: null })
  const [url, init] = vi.mocked(fetch).mock.calls[0]
  expect(String(url)).toContain('/teams/4/goals')
  expect(init?.method).toBe('PUT')
  expect(JSON.parse(String(init?.body))).toEqual({
    expectedVersion: 1,
    successRateMin: 0.8,
    errorReworkRateMax: null,
    tokensPerSuccessMax: 1200,
  })
})
it('approves a share only after a one-time preview', async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(
      json(
        {
          previewId: 901,
          previewVersion: 3,
          expiresAt: '2026-11-24T10:50:00+09:00',
          redactionStatus: 'REDACTED',
          content: {
            title: '맥락',
            type: 'MISSING_CONTEXT',
            problem: '배경이 빠짐',
            improvement: '대상을 적기',
            example: { before: '써줘', after: '영업팀 주간 보고를 써줘' },
          },
        },
      ),
    )
    .mockResolvedValueOnce(json({ shared: true, shareVersion: 1, sharedCaseId: 77 }))
  await expect(api.sharePreview(12)).resolves.toMatchObject({ previewId: 901, previewVersion: 3 })
  await expect(
    api.approveShare(12, { expectedShareVersion: 0, previewId: 901, previewVersion: 3 }),
  ).resolves.toMatchObject({ isShared: true, shareVersion: 1 })
  const [previewUrl, previewInit] = vi.mocked(fetch).mock.calls[0]
  const [shareUrl, shareInit] = vi.mocked(fetch).mock.calls[1]
  expect(String(previewUrl)).toContain('/feedbacks/12/share-preview')
  expect(previewInit?.method).toBe('POST')
  expect(JSON.parse(String(previewInit?.body))).toEqual({})
  expect(String(shareUrl)).toContain('/feedbacks/12/share')
  expect(shareInit?.method).toBe('PATCH')
  expect(JSON.parse(String(shareInit?.body))).toEqual({
    shared: true,
    expectedShareVersion: 0,
    previewId: 901,
    previewVersion: 3,
  })
})
it('records an error-correction rework so only that type counts as the numerator', async () => {
  vi.mocked(fetch).mockResolvedValue(
    json({
      itemId: 31,
      version: 1,
      type: 'ERROR_CORRECTION',
      source: 'SELF_REPORT',
      assessedAt: '2026-11-24T10:20:00+09:00',
    }),
  )
  await expect(
    api.rework(31, { expectedVersion: 0, type: 'ERROR_CORRECTION' }),
  ).resolves.toMatchObject({ version: 1, type: 'ERROR_CORRECTION' })
  const [url, init] = vi.mocked(fetch).mock.calls[0]
  expect(String(url)).toContain('/analysis-items/31/rework-assessment')
  expect(JSON.parse(String(init?.body))).toEqual({
    expectedVersion: 0,
    type: 'ERROR_CORRECTION',
  })
})
it('uploads settingsVersion with the file and accepts metadata rather than old candidate arrays', async () => {
  vi.mocked(fetch).mockResolvedValue(
    json({
      uploadId: 10,
      status: 'READY',
      settingsVersion: 2,
      expiresAt: '2026-11-25T17:00:00+09:00',
      conversationCount: 3,
      eligibleConversationCount: 2,
    }),
  )
  expect((await api.upload('4', new File(['[]'], 'conversations.json'), 2)).uploadId).toBe(10)
  const form = vi.mocked(fetch).mock.calls[0][1]?.body as FormData
  expect(form.get('settingsVersion')).toBe('2')
  expect(form.get('file')).toBeInstanceOf(File)
})
it('restores analysisId from one-based upload history pages', async () => {
  vi.mocked(fetch).mockResolvedValue(
    json({
      items: [
        {
          uploadId: 10,
          createdAt: '2026-11-25',
          status: 'CONSUMED',
          analysisId: 20,
          analysisStatus: 'PARTIALLY_SUCCEEDED',
          selectedCount: 2,
          succeededCount: 1,
          failedCount: 1,
          targetFrom: '2026-11-01',
          targetTo: '2026-11-30',
        },
      ],
      page: 1,
      size: 10,
      total: 1,
    }),
  )
  expect((await api.history('4', 0)).content[0]).toMatchObject({
    analysisId: 20,
    status: 'PARTIALLY_SUCCEEDED',
  })
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('page=1')
})
it('rejects a ME response to a TEAM metrics request', async () => {
  vi.mocked(fetch).mockResolvedValue(json({ scope: 'ME', metrics, coverage: null }))
  await expect(
    api.kpis('4', { scope: 'TEAM', settingsVersion: '1', weekStart: '2026-11-16' }),
  ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
})
it('hides coverage and sample sizes if any metric is suppressed even in an inconsistent response', async () => {
  vi.mocked(fetch).mockResolvedValue(
    json({
      scope: 'TEAM',
      metrics: metrics.map((m) => ({ ...m, value: 99, sampleSize: 9 })),
      coverage: {
        selectedCount: 9,
        inScopeCount: 9,
        excludedCount: 0,
        pendingCount: 0,
        failedCount: 0,
        outcomeConfirmedCount: 9,
        reworkConfirmedCount: 9,
        tokenMeasuredCount: 9,
      },
    }),
  )
  const result = await api.kpis('4', {
    scope: 'TEAM',
    settingsVersion: '1',
    weekStart: '2026-11-16',
  })
  expect(result.cohortCoverage).toBeNull()
  expect(result.conversationCount.value).toBeNull()
  expect(result.successRate.sampleSize).toBeNull()
})
it('rejects malformed current metrics rather than falling back to extra legacy fields', async () => {
  vi.mocked(fetch).mockResolvedValue(
    json({
      scope: 'TEAM',
      metrics: null,
      coverage: null,
      tokensPerSuccess: { value: 123 },
      successRate: { value: 0.9 },
      reworkRate: { value: 0.1 },
      conversationCount: { value: 5 },
    }),
  )
  await expect(
    api.kpis('4', { scope: 'TEAM', settingsVersion: '1', weekStart: '2026-11-16' }),
  ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
})
it('loads subsequent guide pages and groups each type only once', async () => {
  const item = {
    sharedCaseId: 7,
    shareVersion: 1,
    taskTypeId: 3,
    type: '맥락 누락',
    title: '공유 사례',
    problem: '문제',
    improvement: '개선',
    example: { before: '전', after: '후' },
    isGuide: true,
  }
  vi.mocked(fetch)
    .mockResolvedValueOnce(json({ items: [item], page: 1, size: 1, total: 2 }))
    .mockResolvedValueOnce(
      json({ items: [{ ...item, sharedCaseId: 8 }], page: 2, size: 1, total: 2 }),
    )
  const result = await api.guides('4', '')
  expect(result.groups).toHaveLength(1)
  expect(result.groups[0].guides).toHaveLength(2)
})
it('rejects repeated page numbers rather than claiming a complete team list', async () => {
  const item = { teamId: 4, name: '팀', myRole: 'MEMBER' }
  vi.mocked(fetch).mockImplementation(async () =>
    json({ items: [item], page: 1, size: 1, total: 2 }),
  )
  await expect(api.teams()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
})
it('rejects original content returned for a different version', async () => {
  vi.mocked(fetch).mockResolvedValue(
    json({
      conversationVersionId: 99,
      title: '원문',
      startedAt: '2026-11-25',
      highlightMessageIds: [],
      messages: [],
    }),
  )
  await expect(api.conversationVersion(61, '11')).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  })
})
it('accepts nullable v3 source ids without manufacturing a source reference', async () => {
  vi.mocked(fetch).mockResolvedValue(
    json({
      feedbackId: 11,
      itemId: null,
      conversationId: 21,
      conversationVersionId: null,
      type: 'MISSING_CONTEXT',
      title: '피드백',
      problem: '문제',
      causes: [],
      improvement: '개선',
      example: { before: '전', after: '후' },
      evidenceMessageIds: [],
      limitations: [],
      reaction: null,
      sharing: { status: 'NOT_SHARED', version: 0, sharedCaseId: null },
    }),
  )
  expect((await api.feedback('11')).evidences).toEqual([])
})
it('keeps the saved confirmation version instead of treating every visit as the first', async () => {
  vi.mocked(fetch).mockResolvedValue(
    json({
      feedbackId: 11,
      itemId: 31,
      conversationId: 21,
      conversationVersionId: 61,
      type: 'OUTPUT_FORMAT',
      title: '형식',
      problem: '문제',
      causes: [],
      improvement: '개선',
      example: { before: '전', after: '후' },
      evidenceMessageIds: [],
      limitations: [],
      reaction: null,
      sharing: { status: 'NOT_SHARED', version: 2, sharedCaseId: null },
      aiAssessment: { outcome: 'SUCCESS', reworkType: 'REQUIREMENT_CHANGE' },
      outcomeAssessment: {
        outcome: 'FAILURE',
        source: 'SELF_REPORT',
        version: 3,
        assessedAt: '2026-11-24T10:20:00+09:00',
      },
      reworkAssessment: null,
    }),
  )
  const detail = await api.feedback('11')
  expect(detail.outcomeAssessment).toMatchObject({ outcome: 'FAILURE', version: 3 })
  expect(detail.aiAssessment).toMatchObject({ outcome: 'SUCCESS' })
  expect(detail.reworkAssessment).toBeNull()
})
it('revokes a share without sending a version that could block it', async () => {
  vi.mocked(fetch).mockResolvedValue(json({ shared: false, shareVersion: 4, sharedCaseId: null }))
  await expect(api.revokeShare(11)).resolves.toMatchObject({ isShared: false, shareVersion: 4 })
  expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual({ shared: false })
})
