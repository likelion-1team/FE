import { ApiError, endSession, request, queryString } from './client'
import * as schemas from './schemas'
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
  teams: (signal?: AbortSignal) =>
    request<Team[]>('/teams', { signal, validate: schemas.teamsSchema.parse }),
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
    request<Member[]>(`/teams/${id}/members`, { signal, validate: schemas.membersSchema.parse }),
  addMember: (id: string, email: string) =>
    request(`/teams/${id}/members`, { method: 'POST', json: { email } }),
  options: (id: string, signal?: AbortSignal) =>
    request<FilterOptions>(`/teams/${id}/filter-options`, {
      signal,
      validate: schemas.optionsSchema.parse,
    }),
  kpis: (id: string, filters: Record<string, string>, signal?: AbortSignal) =>
    request<Kpis>(`/teams/${id}/dashboard/kpis${queryString(filters)}`, {
      signal,
      validate: schemas.kpisSchema.parse,
    }),
  trends: (id: string, filters: Record<string, string>, signal?: AbortSignal) =>
    request<Trends>(`/teams/${id}/dashboard/trends${queryString(filters)}`, {
      signal,
      validate: schemas.trendsSchema.parse,
    }),
  upload: (id: string, file: File) => {
    const body = new FormData()
    body.set('file', file)
    return request<Upload>(`/teams/${id}/uploads`, {
      method: 'POST',
      body,
      timeoutMs: 90000,
      validate: schemas.uploadSchema.parse,
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
      validate: schemas.analysisStatusSchema.parse,
    }),
  history: (id: string, page: number, signal?: AbortSignal) =>
    request<UploadHistory>(`/teams/${id}/uploads?page=${page}&size=10`, {
      signal,
      validate: schemas.historySchema.parse,
    }),
  feedbacks: (id: string, filters: Record<string, string | number>, signal?: AbortSignal) =>
    request<FeedbackList>(`/teams/${id}/feedbacks${queryString(filters)}`, {
      signal,
      validate: schemas.feedbackListSchema.parse,
    }),
  feedback: (id: string, signal?: AbortSignal) =>
    request<FeedbackDetail>(`/feedbacks/${id}`, { signal, validate: schemas.feedbackSchema.parse }),
  reaction: (id: Id, reaction: Reaction | null, reason?: string) =>
    request(
      `/feedbacks/${id}/reaction`,
      reaction
        ? { method: 'PUT', json: { reaction, ...(reason ? { reason } : {}) } }
        : { method: 'DELETE' },
    ),
  revokeShare: (id: Id) =>
    request<{ isShared: boolean }>(`/feedbacks/${id}/share`, {
      method: 'PATCH',
      json: { shared: false },
      validate: schemas.shareSchema.parse,
    }),
  conversation: (id: Id, feedbackId: string, signal?: AbortSignal) =>
    request<Conversation>(`/conversations/${id}?highlightFeedbackId=${feedbackId}`, {
      signal,
      validate: schemas.conversationSchema.parse,
    }),
  sharedCases: (id: string, type: string, signal?: AbortSignal) =>
    request<{ items: SharedCase[] }>(`/teams/${id}/shared-cases${queryString({ type })}`, {
      signal,
      validate: schemas.sharedCasesSchema.parse,
    }),
  guides: (id: string, type: string, signal?: AbortSignal) =>
    request<Guides>(`/teams/${id}/guides${queryString({ type })}`, {
      signal,
      validate: schemas.guidesSchema.parse,
    }),
  guide: (id: Id, enabled: boolean) =>
    request(`/feedbacks/${id}/guide`, { method: enabled ? 'PUT' : 'DELETE' }),
}
export type { Tokens }
