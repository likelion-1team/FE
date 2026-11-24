import type { Tokens } from './types'
import { tokensSchema } from './schemas'
import { automaticRestoreBlocked, beginLogout, finishLogout } from '../session-policy'

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
export function getSessionGeneration() {
  return sessionGeneration
}

type Options<T> = Omit<RequestInit, 'body'> & {
  json?: unknown
  body?: BodyInit
  authenticated?: boolean
  retryAuth?: boolean
  timeoutMs?: number
  validate?: (value: unknown) => T
}

export const LOGOUT_TIMEOUT_MS = 8000

async function send<T>(
  path: string,
  init: RequestInit,
  timeoutMs: number,
  validate?: (value: unknown) => T,
): Promise<T> {
  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort(init.signal?.reason)
  if (init.signal?.aborted) abort()
  else init.signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  try {
    const response = await fetch(`${API_BASE}${path}`, { ...init, signal: controller.signal })
    const data = await parseResponse<T>(response)
    if (!validate) return data
    try {
      return validate(data)
    } catch {
      throw new ApiError(
        response.status,
        'INVALID_RESPONSE',
        '서버 응답 형식이 올바르지 않습니다. 다시 시도해주세요.',
      )
    }
  } catch (error) {
    if (timedOut)
      throw new ApiError(
        0,
        'REQUEST_TIMEOUT',
        '서버 응답 시간이 초과됐습니다. 연결을 확인하고 다시 시도해주세요.',
      )
    if (controller.signal.aborted) throw controller.signal.reason
    if (error instanceof ApiError) throw error
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      '서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.',
    )
  } finally {
    clearTimeout(timer)
    init.signal?.removeEventListener('abort', abort)
  }
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
  if (automaticRestoreBlocked())
    throw new ApiError(401, 'LOGGED_OUT', '로그아웃 상태입니다. 직접 로그인해주세요.')
  if (refreshFlight) return refreshFlight
  const generation = sessionGeneration
  const legacy = import.meta.env.VITE_AUTH_TRANSPORT === 'json' || Boolean(refreshToken)
  const body = legacy ? { refreshToken } : {}
  const flight = (async () => {
    const tokens = await send<Tokens>(
      '/auth/refresh',
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      10000,
      tokensSchema.parse,
    )
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

export async function endSession() {
  const bearer = accessToken
  const logoutId = beginLogout()
  clearSession()
  listeners.forEach((listener) => listener())
  try {
    await request<void>('/auth/logout', {
      method: 'POST',
      authenticated: false,
      retryAuth: false,
      timeoutMs: LOGOUT_TIMEOUT_MS,
      headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined,
    })
    finishLogout(logoutId, true)
  } catch (error) {
    finishLogout(logoutId, false)
    throw error
  }
}

export async function request<T>(path: string, options: Options<T> = {}): Promise<T> {
  const {
    json,
    authenticated = true,
    retryAuth = true,
    timeoutMs = 20000,
    validate,
    ...init
  } = options
  const generation = sessionGeneration
  const headers = new Headers(init.headers)
  if (json !== undefined) headers.set('Content-Type', 'application/json')
  if (authenticated && accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  let data: T
  try {
    data = await send<T>(
      path,
      {
        ...init,
        headers,
        credentials: 'include',
        body: json !== undefined ? JSON.stringify(json) : init.body,
      },
      timeoutMs,
      validate,
    )
  } catch (error) {
    if (authenticated && generation !== sessionGeneration)
      throw new ApiError(401, 'SESSION_CHANGED', '세션이 변경됐습니다.')
    if (!(error instanceof ApiError) || error.status !== 401 || !authenticated) throw error
    if (!retryAuth) {
      clearSession()
      listeners.forEach((listener) => listener())
      throw error
    }
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
