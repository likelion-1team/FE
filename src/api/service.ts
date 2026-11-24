import { request, queryString } from './client'
import type {
  AnalysisStatus,
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
    }),
  signup: (name: string, email: string, password: string) =>
    request<{ userId: Id }>('/auth/signup', {
      method: 'POST',
      json: { name, email, password },
      authenticated: false,
    }),
  emailCheck: (email: string) =>
    request<{ available: boolean }>('/auth/email-check', {
      method: 'POST',
      json: { email },
      authenticated: false,
    }),
  logout: () => request<void>('/auth/logout', { method: 'POST', retryAuth: false }),
  me: () => request<User>('/users/me'),
  teams: (signal?: AbortSignal) => request<Team[]>('/teams', { signal }),
  createTeam: (name: string, description: string) =>
    request<{ teamId: Id }>('/teams', { method: 'POST', json: { name, description } }),
  settings: (id: string, signal?: AbortSignal) =>
    request<Settings>(`/teams/${id}/settings`, { signal }),
  saveSettings: (id: string, data: SettingsInput) =>
    request(`/teams/${id}/settings`, { method: 'PUT', json: data }),
  members: (id: string, signal?: AbortSignal) =>
    request<Member[]>(`/teams/${id}/members`, { signal }),
  addMember: (id: string, email: string) =>
    request(`/teams/${id}/members`, { method: 'POST', json: { email } }),
  options: (id: string, signal?: AbortSignal) =>
    request<FilterOptions>(`/teams/${id}/filter-options`, { signal }),
  kpis: (id: string, filters: Record<string, string>, signal?: AbortSignal) =>
    request<Kpis>(`/teams/${id}/dashboard/kpis${queryString(filters)}`, { signal }),
  trends: (id: string, filters: Record<string, string>, signal?: AbortSignal) =>
    request<Trends>(`/teams/${id}/dashboard/trends${queryString(filters)}`, { signal }),
  upload: (id: string, file: File) => {
    const body = new FormData()
    body.set('file', file)
    return request<Upload>(`/teams/${id}/uploads`, { method: 'POST', body })
  },
  startAnalysis: (id: Id, selections: { externalId: string; taskTypeId: Id }[], key: string) =>
    request<{ uploadId: Id; status: string }>(`/uploads/${id}/analyses`, {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      json: { selections },
    }),
  analysisStatus: (id: string, signal?: AbortSignal) =>
    request<AnalysisStatus>(`/uploads/${id}`, { signal }),
  history: (id: string, page: number, signal?: AbortSignal) =>
    request<UploadHistory>(`/teams/${id}/uploads?page=${page}&size=10`, { signal }),
  feedbacks: (id: string, filters: Record<string, string | number>, signal?: AbortSignal) =>
    request<FeedbackList>(`/teams/${id}/feedbacks${queryString(filters)}`, { signal }),
  feedback: (id: string, signal?: AbortSignal) =>
    request<FeedbackDetail>(`/feedbacks/${id}`, { signal }),
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
    }),
  conversation: (id: Id, feedbackId: string, signal?: AbortSignal) =>
    request<Conversation>(`/conversations/${id}?highlightFeedbackId=${feedbackId}`, { signal }),
  sharedCases: (id: string, type: string, signal?: AbortSignal) =>
    request<{ items: SharedCase[] }>(`/teams/${id}/shared-cases${queryString({ type })}`, {
      signal,
    }),
  guides: (id: string, type: string, signal?: AbortSignal) =>
    request<Guides>(`/teams/${id}/guides${queryString({ type })}`, { signal }),
  guide: (id: Id, enabled: boolean) =>
    request(`/feedbacks/${id}/guide`, { method: enabled ? 'PUT' : 'DELETE' }),
}
export type { Tokens }
