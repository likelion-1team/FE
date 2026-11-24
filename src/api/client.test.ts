import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  clearSession,
  queryString,
  request,
  setTokens,
  subscribeSessionEnd,
} from './client'

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })

describe('API session contract', () => {
  beforeEach(() => {
    clearSession()
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    clearSession()
  })

  it('unwraps the deployment envelope and sends Bearer credentials', async () => {
    setTokens({ accessToken: 'access' })
    vi.mocked(fetch).mockResolvedValue(json({ code: 'S200', data: { name: '팀' } }))
    await expect(request('/teams')).resolves.toEqual({ name: '팀' })
    expect(vi.mocked(fetch).mock.calls[0][1]?.credentials).toBe('include')
    expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers).get('Authorization')).toBe(
      'Bearer access',
    )
  })

  it('shares one refresh across simultaneous 401 responses and rotates JSON tokens', async () => {
    setTokens({ accessToken: 'old', refreshToken: 'refresh-old' })
    let refreshCount = 0
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (String(url).endsWith('/auth/refresh')) {
        refreshCount++
        expect(JSON.parse(init!.body as string)).toEqual({ refreshToken: 'refresh-old' })
        await new Promise((resolve) => setTimeout(resolve, 5))
        return json({ data: { accessToken: 'new', refreshToken: 'refresh-new' } })
      }
      return new Headers(init?.headers).get('Authorization') === 'Bearer new'
        ? json({ data: 'ok' })
        : json({ message: 'expired' }, 401)
    })
    await expect(Promise.all([request('/teams'), request('/users/me')])).resolves.toEqual([
      'ok',
      'ok',
    ])
    expect(refreshCount).toBe(1)
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('uses an empty JSON body for HttpOnly-cookie refresh sessions', async () => {
    setTokens({ accessToken: 'old' })
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ data: { accessToken: 'new', expiresIn: 900 } }))
      .mockResolvedValueOnce(json({ data: 'ok' }))
    await expect(request('/teams')).resolves.toBe('ok')
    expect(vi.mocked(fetch).mock.calls[1][1]?.body).toBe('{}')
  })

  it('accepts 204 and the currently deployed empty 200 logout response', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    await expect(request('/feedbacks/1/reaction', { method: 'DELETE' })).resolves.toBeUndefined()
    await expect(request('/auth/logout', { method: 'POST' })).resolves.toBeUndefined()
  })

  it('does not retry 403 or turn a server error into an empty list', async () => {
    vi.mocked(fetch).mockResolvedValue(
      json({ code: 'LEADER_ONLY', message: '팀장만 조회할 수 있습니다.' }, 403),
    )
    await expect(request('/teams/1/dashboard/kpis')).rejects.toMatchObject({
      status: 403,
      code: 'LEADER_ONLY',
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('clears the session when the retried access token is also rejected', async () => {
    const ended = vi.fn(),
      unsubscribe = subscribeSessionEnd(ended)
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ data: { accessToken: 'still-rejected' } }))
      .mockResolvedValueOnce(json({}, 401))
    await expect(request('/teams')).rejects.toBeInstanceOf(ApiError)
    expect(ended).toHaveBeenCalledOnce()
    unsubscribe()
  })

  it('does not resurrect a session after logout during refresh', async () => {
    let finish: ((value: Response) => void) | undefined
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({}, 401))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          }),
      )
    const pending = request('/teams').catch((error) => error)
    await vi.waitFor(() => expect(finish).toBeDefined())
    clearSession()
    finish!(json({ data: { accessToken: 'stale' } }))
    expect(await pending).toMatchObject({ code: 'SESSION_CHANGED' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('lets the browser set multipart boundaries', async () => {
    const body = new FormData()
    body.set('file', new File(['{}'], 'conversations.json'))
    vi.mocked(fetch).mockResolvedValue(json({ data: { uploadId: 1 } }))
    await request('/teams/1/uploads', { method: 'POST', body })
    expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers).has('Content-Type')).toBe(false)
  })

  it('distinguishes an HTML hosting fallback from a successful API response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('<html>SPA</html>', { headers: { 'content-type': 'text/html' } }),
    )
    await expect(request('/teams')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('encodes filters without dropping the zero-based page', () => {
    expect(queryString({ q: '보고서 & 계획', page: 0, type: '', absent: undefined })).toBe(
      '?q=%EB%B3%B4%EA%B3%A0%EC%84%9C+%26+%EA%B3%84%ED%9A%8D&page=0',
    )
  })
})
