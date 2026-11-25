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
  Reaction,
  Settings,
  SettingsInput,
  SharedCase,
  Team,
  Tokens,
  Trends,
  Upload,
  UploadHistory,
  User,
} from './types'

async function allPages<T>(
  path: string,
  schema: z.ZodType<{ items: T[]; page: number; size: number; total: number }>,
  signal?: AbortSignal,
): Promise<T[]> {
  const result: T[] = []
  for (let page = 1; ; page++) {
    const data = await request(`${path}?page=${page}&size=100`, { signal, validate: schema.parse })
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
      validate: live.options.or(schemas.optionsSchema).parse,
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
        const raw = live.kpis.or(schemas.kpisSchema).parse(value)
        if (!('metrics' in raw)) return raw
        const find = (code: string) => {
          const m = raw.metrics.find((m) => m.code === code)
          if (!m) throw new Error('필수 지표 누락')
          return {
            ...m,
            value: m.status === 'AVAILABLE' ? m.value : null,
            estimated: m.valueSource === 'TOKENIZER_ESTIMATE',
          }
        }
        return {
          from: filters.from || '',
          to: filters.to || '',
          tokensPerSuccess: find('tokensPerConfirmedSuccess'),
          reworkRate: find('errorReworkRate'),
          successRate: find('confirmedSuccessRate'),
          conversationCount: { value: raw.coverage?.inScopeCount ?? null },
          cohortCoverage: raw.coverage,
        }
      },
    }),
  trends: (id: string, filters: Record<string, string>, signal?: AbortSignal) =>
    request<Trends>(
      `/teams/${id}/dashboard/trends${queryString(dashboardFilters(filters, true))}`,
      {
        signal,
        validate: (value) => {
          const raw = live.trends.or(schemas.trendsSchema).parse(value)
          if (!('scope' in raw)) return raw
          return {
            metric: filters.metric,
            estimated: filters.metric === 'tokensPerSuccess',
            points: raw.points.map((p) => ({
              date: p.periodStart,
              value: p.metric.status === 'AVAILABLE' ? p.metric.value : null,
              conversationCount: p.metric.sampleSize,
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
      validate: live.upload.or(schemas.uploadSchema).parse,
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
        const raw = live.uploadStatus.or(schemas.analysisStatusSchema).parse(value)
        return 'uploadId' in raw ? { ...raw, progress: 0 } : raw
      },
    }),
  history: (id: string, page: number, signal?: AbortSignal) =>
    request<UploadHistory>(`/teams/${id}/uploads?page=${page + 1}&size=10`, {
      signal,
      validate: (value) => {
        const raw = live.history.or(schemas.historySchema).parse(value)
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
          const raw = live.feedbacks.or(schemas.feedbackListSchema).parse(value)
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
        const raw = live.feedback.or(schemas.feedbackSchema).parse(value)
        return 'conversationId' in raw
          ? { ...raw, evidences: [{ conversationId: raw.conversationId, turnIndexes: [] }] }
          : raw
      },
    }),
  reaction: (id: Id, reaction: Reaction | null, reason?: string) =>
    request(
      `/feedbacks/${id}/reaction`,
      reaction
        ? { method: 'PUT', json: { reaction, ...(reason ? { reason } : {}) } }
        : { method: 'DELETE' },
    ),
  revokeShare: (id: Id, expectedShareVersion?: number) =>
    request<{ isShared: boolean }>(`/feedbacks/${id}/share`, {
      method: 'PATCH',
      json: { shared: false, expectedShareVersion },
      validate: (value) => {
        const raw = live.share.or(schemas.shareSchema).parse(value)
        return 'shared' in raw ? { isShared: raw.shared } : raw
      },
    }),
  conversation: (id: Id, feedbackId: string, signal?: AbortSignal) =>
    request<Conversation>(`/conversations/${id}?highlightFeedbackId=${feedbackId}`, {
      signal,
      validate: (value) => {
        const raw = live.conversation.or(schemas.conversationSchema).parse(value)
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
    }),
  sharedCases: (id: string, type: string, signal?: AbortSignal) =>
    request<{ items: SharedCase[] }>(`/teams/${id}/shared-cases${queryString({ type })}`, {
      signal,
      validate: (value) => {
        const raw = live.shared.or(schemas.sharedCasesSchema).parse(value)
        return {
          items: raw.items.map((x) =>
            'sharedCaseId' in x
              ? { ...x, feedbackId: x.sharedCaseId, taskType: String(x.taskTypeId) }
              : x,
          ),
        }
      },
    }),
  guides: (id: string, type: string, signal?: AbortSignal) =>
    request<Guides>(`/teams/${id}/guides${queryString({ type })}`, {
      signal,
      validate: (value) => {
        const raw = live.shared.or(schemas.guidesSchema).parse(value)
        return 'items' in raw
          ? {
              groups: raw.items.map((x) => ({
                type: x.type,
                guides: [{ ...x, feedbackId: x.sharedCaseId, guideAddedAt: '' }],
              })),
            }
          : raw
      },
    }),
  guide: (id: Id, enabled: boolean, teamId?: string, shareVersion?: number) =>
    request(`/teams/${teamId}/guides/${id}`, {
      method: enabled ? 'PUT' : 'DELETE',
      ...(enabled ? { json: { expectedShareVersion: shareVersion } } : {}),
    }),
}
export type { Tokens }
