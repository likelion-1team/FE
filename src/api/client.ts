import type { Tokens } from './types'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: { field: string; message?: string; code?: string }[] = [],
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const configuredBase = import.meta.env.VITE_API_BASE_URL || '/api/v1'
export const API_BASE = configuredBase.replace(/\/$/, '')
let accessToken: string | null = null
let refreshToken: string | null = null
let sessionGeneration = 0
let refreshFlight: Promise<void> | null = null
const listeners = new Set<() => void>()
export function subscribeSessionEnd(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
export function setTokens(tokens: Tokens) {
  accessToken = tokens.accessToken
  refreshToken = tokens.refreshToken || null
}
export function clearSession() {
  sessionGeneration++
  accessToken = null
  refreshToken = null
  refreshFlight = null
}
export function hasAccessToken() {
  return Boolean(accessToken)
}

type Options = Omit<RequestInit, 'body'> & {
  json?: unknown
  body?: BodyInit
  authenticated?: boolean
  retryAuth?: boolean
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T
  const contentType = response.headers.get('content-type') || ''
  const body = await response.text()
  let payload = null
  if (contentType.includes('json') && body) {
    try {
      payload = JSON.parse(body)
    } catch {
      /* Handled as INVALID_RESPONSE below. */
    }
  }
  if (!response.ok) {
    const error = payload?.error || payload
    const message =
      error?.message ||
      (
        {
          401: '로그인이 만료되었습니다. 다시 로그인해주세요.',
          403: '이 기능을 사용할 권한이 없습니다.',
          404: '자료를 찾을 수 없거나 접근할 수 없습니다.',
          409: '내용이나 상태가 변경됐습니다. 새로 확인해주세요.',
          410: '보관 시간이 만료됐습니다. 다시 업로드해주세요.',
          413: '파일 용량이 너무 큽니다.',
          415: '지원하지 않는 파일 형식입니다.',
          429: '요청이 많습니다. 잠시 후 다시 시도해주세요.',
        } as Record<number, string>
      )[response.status] ||
      '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.'
    const fields = Array.isArray(error?.fieldErrors)
      ? error.fieldErrors
      : Array.isArray(payload?.errors)
        ? payload.errors
        : []
    throw new ApiError(response.status, error?.code || 'REQUEST_FAILED', message, fields)
  }
  if (!body) return undefined as T
  if (payload === null)
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      '서버 응답을 읽을 수 없습니다. API 주소를 확인해주세요.',
    )
  return Object.prototype.hasOwnProperty.call(payload, 'data')
    ? (payload.data as T)
    : (payload as T)
}

export async function refreshSession() {
  if (refreshFlight) return refreshFlight
  const generation = sessionGeneration
  const legacy = import.meta.env.VITE_AUTH_TRANSPORT === 'json' || Boolean(refreshToken)
  const body = legacy ? { refreshToken } : {}
  const flight = (async () => {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const tokens = await parseResponse<Tokens>(response)
    if (generation !== sessionGeneration)
      throw new ApiError(401, 'SESSION_CHANGED', '세션이 변경됐습니다.')
    setTokens(tokens)
  })()
  refreshFlight = flight
  try {
    await flight
  } finally {
    if (refreshFlight === flight) refreshFlight = null
  }
}

export async function request<T>(path: string, options: Options = {}): Promise<T> {
  const { json, authenticated = true, retryAuth = true, ...init } = options
  const generation = sessionGeneration
  const headers = new Headers(init.headers)
  if (json !== undefined) headers.set('Content-Type', 'application/json')
  if (authenticated && accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      credentials: 'include',
      body: json !== undefined ? JSON.stringify(json) : init.body,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      '서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.',
    )
  }
  if (authenticated && generation !== sessionGeneration)
    throw new ApiError(401, 'SESSION_CHANGED', '세션이 변경됐습니다.')
  if (response.status === 401 && authenticated && retryAuth) {
    // A slower request can return its old 401 after another request already rotated the token.
    if (accessToken && headers.get('Authorization') !== `Bearer ${accessToken}`)
      return request<T>(path, { ...options, retryAuth: false })
    try {
      await refreshSession()
    } catch (error) {
      if (generation === sessionGeneration) {
        clearSession()
        listeners.forEach((fn) => fn())
      }
      throw error
    }
    if (generation !== sessionGeneration)
      throw new ApiError(401, 'SESSION_CHANGED', '세션이 변경됐습니다.')
    return request<T>(path, { ...options, retryAuth: false })
  }
  if (response.status === 401 && authenticated && generation === sessionGeneration) {
    clearSession()
    listeners.forEach((fn) => fn())
  }
  const data = await parseResponse<T>(response)
  if (authenticated && generation !== sessionGeneration)
    throw new ApiError(401, 'SESSION_CHANGED', '세션이 변경됐습니다.')
  return data
}

export function queryString(values: Record<string, string | number | undefined | null>) {
  const q = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') q.set(key, String(value))
  })
  return q.size ? `?${q}` : ''
}
