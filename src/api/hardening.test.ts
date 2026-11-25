import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSession,
  endSession,
  hasAccessToken,
  LOGOUT_TIMEOUT_MS,
  refreshSession,
  request,
  setTokens,
} from './client'
import { api } from './service'
import { feedbackSchema } from './schemas'
import {
  automaticRestoreBlocked,
  getLogoutState,
  LOGOUT_KEY,
  resetLogoutIntent,
} from '../session-policy'

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ data }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
const detail = {
  feedbackId: 1,
  type: '맥락 누락',
  title: '제목',
  problem: '문제',
  causes: ['원인'],
  improvement: '개선',
  example: { before: '전', after: '후' },
  evidences: [],
}

beforeEach(() => {
  resetLogoutIntent()
  clearSession()
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  resetLogoutIntent()
  clearSession()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function abortableFetch() {
  vi.mocked(fetch).mockImplementation(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        if (init?.signal?.aborted) reject(init.signal.reason)
        else
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      }),
  )
}

describe('red team regressions', () => {
  it('preserves legitimate nullable fields while an analysis is still running', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        json({
          status: 'ANALYZING',
          progress: 50,
          savedCount: null,
          skippedDuplicateCount: null,
          failReason: null,
        }),
      )
      .mockResolvedValueOnce(
        json({
          content: [
            {
              uploadId: 1,
              uploadedAt: '2026-11-24',
              analyzedCount: 0,
              period: null,
              status: 'UPLOADED',
            },
          ],
          page: 0,
          size: 10,
          totalElements: 1,
        }),
      )
    await expect(api.analysisStatus('1')).resolves.toMatchObject({
      status: 'ANALYZING',
      savedCount: undefined,
    })
    await expect(api.history('1', 0)).resolves.toMatchObject({ content: [{ period: null }] })
  })
  it('rejects null required arrays before they can crash a screen', async () => {
    vi.mocked(fetch).mockResolvedValue(json({ ...detail, causes: null }))
    await expect(api.feedback('1')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    expect(feedbackSchema.safeParse({ ...detail, causes: [] }).success).toBe(true)
  })

  it('rejects malformed upload candidates instead of showing an empty success', async () => {
    vi.mocked(fetch).mockResolvedValue(json({ uploadId: 1, conversations: null }))
    await expect(api.upload('1', new File(['{}'], 'file.json'))).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
  })

  it('never installs an invalid refresh token response', async () => {
    vi.mocked(fetch).mockResolvedValue(json({ accessToken: '' }))
    await expect(refreshSession()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    expect(hasAccessToken()).toBe(false)
  })

  it('bounds stalled requests with a deadline', async () => {
    vi.useFakeTimers()
    abortableFetch()
    const result = request('/teams', { timeoutMs: 50 }).catch((error) => error)
    await vi.advanceTimersByTimeAsync(50)
    expect(await result).toMatchObject({ code: 'REQUEST_TIMEOUT' })
  })

  it('retains query cancellation instead of presenting it as a network failure', async () => {
    abortableFetch()
    const controller = new AbortController()
    const result = request('/teams', { signal: controller.signal }).catch((error) => error)
    controller.abort()
    expect(await result).toMatchObject({ name: 'AbortError' })
  })

  it('blocks local access before a logout response and sends the captured bearer', async () => {
    let finish: ((response: Response) => void) | undefined
    setTokens({ accessToken: 'private-access', refreshToken: 'private-refresh' })
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const operation = endSession()
    expect(hasAccessToken()).toBe(false)
    expect(getLogoutState()?.phase).toBe('pending')
    expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers).get('Authorization')).toBe(
      'Bearer private-access',
    )
    expect(localStorage.getItem(LOGOUT_KEY)).not.toContain('private-')
    finish!(new Response(null, { status: 204 }))
    await operation
    expect(getLogoutState()?.phase).toBe('done')
    expect(automaticRestoreBlocked()).toBe(true)
  })

  it('does not refresh a surviving cookie after failed logout', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }))
    await expect(endSession()).rejects.toMatchObject({ status: 503 })
    await expect(refreshSession()).rejects.toMatchObject({ code: 'LOGGED_OUT' })
    expect(getLogoutState()?.phase).toBe('failed')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('expires stalled logout without restoring local access', async () => {
    vi.useFakeTimers()
    abortableFetch()
    setTokens({ accessToken: 'access' })
    const result = endSession().catch((error) => error)
    await vi.advanceTimersByTimeAsync(LOGOUT_TIMEOUT_MS)
    expect(await result).toMatchObject({ code: 'REQUEST_TIMEOUT' })
    expect(hasAccessToken()).toBe(false)
    expect(getLogoutState()?.phase).toBe('failed')
  })

  it('does not let an older logout completion overwrite explicit new login intent', async () => {
    let finish: ((response: Response) => void) | undefined
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const operation = endSession()
    resetLogoutIntent()
    setTokens({ accessToken: 'new-access' })
    finish!(new Response(null, { status: 204 }))
    await operation
    expect(hasAccessToken()).toBe(true)
    expect(automaticRestoreBlocked()).toBe(false)
  })

  it('supports explicit GET email-check releases without retrying a POST blindly', async () => {
    vi.stubEnv('VITE_EMAIL_CHECK_METHOD', 'GET')
    vi.mocked(fetch).mockResolvedValue(json({ available: true }))
    await api.emailCheck('member+new@example.com')
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain('/auth/email-check?email=member%2Bnew%40example.com')
    expect(init?.method).toBe('GET')
    expect(init?.body).toBeUndefined()
  })

  it('keeps GET as the default deployed email-check contract', async () => {
    vi.stubEnv('VITE_EMAIL_CHECK_METHOD', '')
    vi.mocked(fetch).mockResolvedValue(json({ available: true }))
    await api.emailCheck('member@example.com')
    expect(vi.mocked(fetch).mock.calls[0][1]?.method).toBe('GET')
  })
})
