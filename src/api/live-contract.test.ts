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
