import { ApiError, endSession, request, queryString } from './client'
import * as schemas from './schemas'
import * as live from './live-contract'
import { z } from 'zod'
import type {
  AnalysisStatus,
  AnalysisStart,
  AnalysisRun,
  AnalysisItems,
  CandidatePage,
  Conversation,
  FeedbackDetail,
  FeedbackList,
  FilterOptions,
  Guides,
  Id,
  Kpis,
  LoginResult,
  Member,
  OutcomeAssessment,
  Reaction,
  ReworkAssessment,
  Settings,
  SharePreview,
  SettingsInput,
  SharedCase,
  Team,
  TeamGoals,
  TeamSubmissions,
  Tokens,
  Trends,
  Upload,
  UploadHistory,
  User,
} from './types'

function hasField(value: unknown, key: string): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, key)
  )
}
function release<T, U>(
  value: unknown,
  marker: string,
  current: z.ZodType<T>,
  legacy: z.ZodType<U>,
): T | U {
  return hasField(value, marker) ? current.parse(value) : legacy.parse(value)
}
function invalidResponse(message = '서버 응답 범위를 확인할 수 없습니다. 다시 시도해주세요.') {
  return new ApiError(200, 'INVALID_RESPONSE', message)
}
async function allPages<T>(
  path: string,
  schema: z.ZodType<{ items: T[]; page: number; size: number; total: number }>,
  signal?: AbortSignal,
): Promise<T[]> {
  const result: T[] = []
  let pageSize: number | undefined
  for (let page = 1; ; page++) {
    const separator = path.includes('?') ? '&' : '?'
    const data = await request(`${path}${separator}page=${page}&size=100`, {
      signal,
      validate: schema.parse,
    })
    if (data.page !== page || (pageSize != null && data.size !== pageSize))
      throw invalidResponse('목록 페이지가 일치하지 않습니다. 다시 불러와주세요.')
    pageSize = data.size
    result.push(...data.items)
    if (page * data.size >= data.total) return result
    if (!data.items.length || page >= 1000)
      throw new ApiError(200, 'INVALID_RESPONSE', '목록 페이지를 모두 확인할 수 없습니다.')
  }
}
const metricCode: Record<string, string> = {
  tokensPerSuccess: 'tokensPerConfirmedSuccess',
  reworkRate: 'errorReworkRate',
  successRate: 'confirmedSuccessRate',
}
function dashboardFilters(filters: Record<string, string>, trends = false) {
  const result: Record<string, string> = {
    scope: filters.scope,
    settingsVersion: filters.settingsVersion,
  }
  if (filters.scope === 'TEAM') result.weekStart = filters.weekStart
  else {
    result.from = filters.from
    result.to = filters.to
  }
  if (trends) {
    result.metric = metricCode[filters.metric] || filters.metric
    result.unit = filters.scope === 'TEAM' ? 'WEEK' : filters.unit
  }
  return result
}
export const api = {
  login: (email: string, password: string) =>
    request<LoginResult>('/auth/login', {
      method: 'POST',
      json: { email, password },
      authenticated: false,
      validate: schemas.loginSchema.parse,
    }),
  signup: (name: string, email: string, password: string) =>
    request<{ userId: Id }>('/auth/signup', {
      method: 'POST',
      json: { name, email, password },
      authenticated: false,
    }),
  emailCheck: (email: string) => {
    const method = (import.meta.env.VITE_EMAIL_CHECK_METHOD || 'GET').toUpperCase()
    if (method !== 'GET' && method !== 'POST')
      throw new ApiError(0, 'CONFIGURATION_ERROR', '이메일 확인 요청 설정을 확인해주세요.')
    return request<{ available: boolean }>(
      `/auth/email-check${method === 'GET' ? queryString({ email }) : ''}`,
      {
        method,
        ...(method === 'POST' ? { json: { email } } : {}),
        authenticated: false,
        validate: schemas.emailCheckSchema.parse,
      },
    )
  },
  logout: endSession,
  me: () => request<User>('/users/me', { validate: schemas.userSchema.parse }),
  teams: (signal?: AbortSignal) => allPages<Team>('/teams', live.teamPage, signal),
  createTeam: (name: string, description: string) =>
    request<{ teamId: Id }>('/teams', { method: 'POST', json: { name, description } }),
  settings: (id: string, signal?: AbortSignal) =>
    request<Settings>(`/teams/${id}/settings`, { signal, validate: schemas.settingsSchema.parse }),
  saveSettings: (id: string, data: SettingsInput) =>
    request<Settings>(`/teams/${id}/settings`, {
      method: 'PUT',
      json: data,
      validate: schemas.settingsSchema.parse,
    }),
  members: (id: string, signal?: AbortSignal) =>
    allPages<Member>(`/teams/${id}/members`, live.memberPage, signal),
  addMember: (id: string, email: string) =>
    request(`/teams/${id}/members`, { method: 'POST', json: { email } }),
  options: async (id: string, signal?: AbortSignal, scope = 'ME'): Promise<FilterOptions> => {
    const raw = await request(`/teams/${id}/dashboard/filter-options?scope=${scope}`, {
      signal,
      validate: (value) => {
        const raw = release(value, 'scope', live.options, schemas.optionsSchema)
        if ('scope' in raw && raw.scope !== scope) throw invalidResponse()
        return raw
      },
    })
    if (!('settingsVersions' in raw)) return raw
    const settings = await api.settings(id, signal)
    return {
      ...raw,
      taskTypes: raw.taskTypes.map((t) => ({ id: t.taskTypeId, name: t.name })),
      models: raw.allowedModels,
      dataFrom: settings.targetFrom,
      dataTo: settings.targetTo,
      settingsVersion: settings.version,
    }
  },
  kpis: (id: string, filters: Record<string, string>, signal?: AbortSignal) =>
    request<Kpis>(`/teams/${id}/dashboard/kpis${queryString(dashboardFilters(filters))}`, {
      signal,
      validate: (value) => {
        const raw = release(value, 'metrics', live.kpis, schemas.kpisSchema)
        if (!('metrics' in raw)) return raw
        if (raw.scope !== filters.scope) throw invalidResponse()
        const hidden = raw.metrics.some((m) => m.status === 'SUPPRESSED')
        const coverage = hidden ? null : raw.coverage
        const find = (code: string) => {
          const m = raw.metrics.find((m) => m.code === code)
          if (!m) throw new Error('필수 지표 누락')
          return {
            ...m,
            value: m.status === 'AVAILABLE' ? m.value : null,
            sampleSize: m.status === 'SUPPRESSED' ? null : m.sampleSize,
            estimated: m.valueSource === 'TOKENIZER_ESTIMATE',
          }
        }
        return {
          from: filters.from || '',
          to: filters.to || '',
          tokensPerSuccess: find('tokensPerConfirmedSuccess'),
          reworkRate: find('errorReworkRate'),
          successRate: find('confirmedSuccessRate'),
          conversationCount: { value: coverage?.inScopeCount ?? null },
          cohortCoverage: coverage,
        }
      },
    }),
  trends: (id: string, filters: Record<string, string>, signal?: AbortSignal) =>
    request<Trends>(
      `/teams/${id}/dashboard/trends${queryString(dashboardFilters(filters, true))}`,
      {
        signal,
        validate: (value) => {
          const raw = release(value, 'scope', live.trends, schemas.trendsSchema)
          if (!('scope' in raw)) return raw
          if (raw.scope !== filters.scope) throw invalidResponse()
          return {
            metric: filters.metric,
            estimated: filters.metric === 'tokensPerSuccess',
            points: raw.points.map((p) => ({
              date: p.periodStart,
              value: p.metric.status === 'AVAILABLE' ? p.metric.value : null,
              conversationCount: p.metric.status === 'SUPPRESSED' ? null : p.metric.sampleSize,
              status: p.metric.status,
              insufficientSample: p.metric.status !== 'AVAILABLE',
            })),
          }
        },
      },
    ),
  upload: (id: string, file: File, settingsVersion?: number) => {
    const body = new FormData()
    body.set('file', file)
    if (settingsVersion != null) body.set('settingsVersion', String(settingsVersion))
    return request<Upload>(`/teams/${id}/uploads`, {
      method: 'POST',
      body,
      timeoutMs: 90000,
      validate: (value) => release(value, 'status', live.upload, schemas.uploadSchema),
    })
  },
  candidates: (id: Id, page: number, search: string, signal?: AbortSignal) =>
    request<CandidatePage>(
      `/uploads/${id}/conversations${queryString({ page, size: 20, q: search })}`,
      {
        signal,
        validate: schemas.candidatesSchema.parse,
      },
    ),
  startAnalysis: (
    id: Id,
    settingsVersion: number,
    selections: { selectionId: string; taskTypeId: Id }[],
    key: string,
  ) =>
    request<AnalysisStart>(`/uploads/${id}/analyses`, {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      json: { settingsVersion, selections },
      validate: schemas.analysisStartSchema.parse,
    }),
  analysis: (id: string, signal?: AbortSignal) =>
    request<AnalysisRun>(`/analyses/${id}`, { signal, validate: schemas.analysisRunSchema.parse }),
  analysisItems: (id: string, page: number, signal?: AbortSignal) =>
    request<AnalysisItems>(`/analyses/${id}/items${queryString({ page, size: 20 })}`, {
      signal,
      validate: schemas.analysisItemsSchema.parse,
    }),
  analysisStatus: (id: string, signal?: AbortSignal) =>
    request<AnalysisStatus>(`/uploads/${id}`, {
      signal,
      validate: (value) => {
        const raw = release(value, 'uploadId', live.uploadStatus, schemas.analysisStatusSchema)
        return 'uploadId' in raw ? { ...raw, progress: 0 } : raw
      },
    }),
  history: (id: string, page: number, signal?: AbortSignal) =>
    request<UploadHistory>(`/teams/${id}/uploads?page=${page + 1}&size=10`, {
      signal,
      validate: (value) => {
        const raw = release(value, 'items', live.history, schemas.historySchema)
        return 'items' in raw
          ? {
              content: raw.items.map((x) => ({
                uploadId: x.uploadId,
                analysisId: x.analysisId,
                uploadedAt: x.createdAt,
                analyzedCount: x.succeededCount,
                period: x.targetFrom && x.targetTo ? { from: x.targetFrom, to: x.targetTo } : null,
                status: x.analysisStatus || x.status,
              })),
              page: raw.page - 1,
              size: raw.size,
              totalElements: raw.total,
            }
          : raw
      },
    }),
  feedbacks: (id: string, filters: Record<string, string | number>, signal?: AbortSignal) =>
    request<FeedbackList>(
      `/teams/${id}/feedbacks${queryString({ ...filters, page: Number(filters.page || 0) + 1, type: filters.types, types: undefined, sort: filters.sort })}`,
      {
        signal,
        validate: (value) => {
          const raw = release(value, 'items', live.feedbacks, schemas.feedbackListSchema)
          return 'items' in raw
            ? {
                days: raw.items.map((x) => ({
                  date: x.createdAt,
                  feedbacks: [
                    { ...x, myReaction: x.reaction, isShared: x.sharingStatus === 'SHARED' },
                  ],
                })),
              }
            : raw
        },
      },
    ),
  feedback: (id: string, signal?: AbortSignal) =>
    request<FeedbackDetail>(`/feedbacks/${id}`, {
      signal,
      validate: (value) => {
        const raw = release(value, 'conversationId', live.feedback, schemas.feedbackSchema)
        return 'conversationId' in raw
          ? {
              ...raw,
              evidences:
                raw.conversationVersionId == null
                  ? []
                  : [{ conversationVersionId: raw.conversationVersionId, turnIndexes: [] }],
            }
          : { ...raw, conversationVersionId: null, evidences: [] }
      },
    }),
  reaction: (id: Id, reaction: Reaction | null, reason?: string) =>
    request(
      `/feedbacks/${id}/reaction`,
      reaction
        ? { method: 'PUT', json: { reaction, ...(reason ? { reason } : {}) } }
        : { method: 'DELETE' },
    ),
  sharePreview: (id: Id) =>
    request<SharePreview>(`/feedbacks/${id}/share-preview`, {
      method: 'POST',
      json: {},
      validate: live.sharePreview.parse,
    }),
  approveShare: (
    id: Id,
    body: { expectedShareVersion: number; previewId: Id; previewVersion: number },
  ) =>
    request<{ isShared: boolean; shareVersion: number; sharedCaseId: Id | null }>(
      `/feedbacks/${id}/share`,
      {
        method: 'PATCH',
        json: { shared: true, ...body },
        validate: (value) => {
          const raw = release(value, 'shared', live.share, schemas.shareSchema)
          if (!('shared' in raw)) return { isShared: raw.isShared, shareVersion: 0, sharedCaseId: null }
          return { isShared: raw.shared, shareVersion: raw.shareVersion, sharedCaseId: raw.sharedCaseId }
        },
      },
    ),
  revokeShare: (id: Id) =>
    request<{ isShared: boolean; shareVersion: number }>(`/feedbacks/${id}/share`, {
      method: 'PATCH',
      json: { shared: false },
      validate: (value) => {
        const raw = release(value, 'shared', live.share, schemas.shareSchema)
        return 'shared' in raw
          ? { isShared: raw.shared, shareVersion: raw.shareVersion }
          : { isShared: raw.isShared, shareVersion: 0 }
      },
    }),
  conversationVersion: (id: Id, feedbackId: string, signal?: AbortSignal) =>
    request<Conversation>(
      `/conversation-versions/${encodeURIComponent(String(id))}${queryString({ highlightFeedbackId: feedbackId })}`,
      {
        signal,
        validate: (value) => {
          const raw = release(
            value,
            'highlightMessageIds',
            live.conversation,
            schemas.conversationSchema,
          )
          if (!('highlightMessageIds' in raw) || String(raw.conversationVersionId) !== String(id))
            throw invalidResponse()
          return 'highlightMessageIds' in raw
            ? {
                title: raw.title,
                startedAt: raw.startedAt,
                model: '',
                messages: raw.messages.map((m, i) => ({ ...m, idx: i })),
                highlightIndexes: raw.messages.flatMap((m, i) =>
                  raw.highlightMessageIds.includes(m.messageId) ? [i] : [],
                ),
              }
            : raw
        },
      },
    ),
  sharedCases: async (
    id: string,
    type: string,
    signal?: AbortSignal,
  ): Promise<{ items: SharedCase[] }> => {
    const legacy = schemas.sharedCasesSchema.transform((raw) => ({
      ...raw,
      page: 1,
      size: Math.max(1, raw.items.length),
      total: raw.items.length,
    }))
    const schema = z.unknown().transform((value) => release(value, 'page', live.shared, legacy))
    const items = await allPages<z.infer<typeof schema>['items'][number]>(
      `/teams/${id}/shared-cases${queryString({ type })}`,
      schema,
      signal,
    )
    return {
      items: items.map((x) =>
        'sharedCaseId' in x
          ? { ...x, feedbackId: x.sharedCaseId, taskType: String(x.taskTypeId) }
          : x,
      ),
    }
  },
  guides: async (id: string, type: string, signal?: AbortSignal): Promise<Guides> => {
    const legacy = schemas.guidesSchema.transform((raw) => {
      const items = raw.groups.flatMap((group) =>
        group.guides.map((item) => ({ ...item, type: group.type })),
      )
      return { items, page: 1, size: Math.max(1, items.length), total: items.length }
    })
    const schema = z.unknown().transform((value) => release(value, 'page', live.shared, legacy))
    const items = await allPages<z.infer<typeof schema>['items'][number]>(
      `/teams/${id}/guides${queryString({ type })}`,
      schema,
      signal,
    )
    const groups: Guides['groups'] = []
    for (const item of items) {
      let group = groups.find((g) => g.type === item.type)
      if (!group) {
        group = { type: item.type, guides: [] }
        groups.push(group)
      }
      group.guides.push(
        'sharedCaseId' in item
          ? { ...item, feedbackId: item.sharedCaseId, guideAddedAt: '' }
          : item,
      )
    }
    return { groups }
  },
  guide: (id: Id, enabled: boolean, teamId: string, shareVersion: number) =>
    request(`/teams/${teamId}/guides/${id}`, {
      method: enabled ? 'PUT' : 'DELETE',
      ...(enabled ? { json: { expectedShareVersion: shareVersion } } : {}),
    }),
  submissions: (teamId: string, signal?: AbortSignal) =>
    request<TeamSubmissions>(`/teams/${teamId}/submissions`, {
      signal,
      validate: live.submissions.parse,
    }),
  goals: (teamId: string, signal?: AbortSignal) =>
    request<TeamGoals>(`/teams/${teamId}/goals`, { signal, validate: live.goals.parse }),
  updateGoals: (
    teamId: string,
    body: {
      expectedVersion: number
      successRateMin: number | null
      errorReworkRateMax: number | null
      tokensPerSuccessMax: number | null
    },
  ) =>
    request<TeamGoals>(`/teams/${teamId}/goals`, {
      method: 'PUT',
      json: body,
      validate: live.goals.parse,
    }),
  outcome: (
    itemId: Id,
    body: { expectedVersion: number; outcome: 'SUCCESS' | 'FAILURE' | 'UNKNOWN'; note?: string },
  ) =>
    request<OutcomeAssessment>(
      `/analysis-items/${itemId}/outcome`,
      { method: 'PUT', json: body, validate: live.outcome.parse },
    ),
  rework: (
    itemId: Id,
    body: { expectedVersion: number; type: (typeof live.reworkTypes)[number]; note?: string },
  ) =>
    request<ReworkAssessment>(
      `/analysis-items/${itemId}/rework-assessment`,
      { method: 'PUT', json: body, validate: live.rework.parse },
    ),
}
export type { Tokens }
