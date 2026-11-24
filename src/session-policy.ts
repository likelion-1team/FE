// Only logout intent/status is persisted. Credentials and personal data stay in memory.
export const LOGOUT_KEY = 'ai-work:logout-state'
export type LogoutState = { id: string; phase: 'pending' | 'done' | 'failed'; at: number }
let fallback: LogoutState | null = null
const listeners = new Set<(state: LogoutState | null) => void>()

export function getLogoutState(): LogoutState | null {
  try {
    const raw = localStorage.getItem(LOGOUT_KEY)
    if (!raw) return fallback
    const value = JSON.parse(raw)
    if (
      typeof value.id === 'string' &&
      typeof value.at === 'number' &&
      ['pending', 'done', 'failed'].includes(value.phase)
    )
      return value
    return { id: 'invalid', phase: 'failed', at: 0 }
  } catch {
    return fallback
  }
}
export function automaticRestoreBlocked() {
  try {
    return localStorage.getItem(LOGOUT_KEY) !== null || fallback !== null
  } catch {
    return true
  }
}
function publish(state: LogoutState | null) {
  fallback = state
  try {
    if (state) localStorage.setItem(LOGOUT_KEY, JSON.stringify(state))
    else localStorage.removeItem(LOGOUT_KEY)
  } catch {
    /* Memory policy still applies; automatic restore fails closed. */
  }
  listeners.forEach((listener) => listener(state))
}
export function beginLogout() {
  const state: LogoutState = { id: crypto.randomUUID(), phase: 'pending', at: Date.now() }
  publish(state)
  return state.id
}
export function finishLogout(id: string, success: boolean) {
  if (getLogoutState()?.id === id)
    publish({ id, phase: success ? 'done' : 'failed', at: Date.now() })
}
export function resetLogoutIntent() {
  publish(null)
}
export function subscribeLogoutState(listener: (state: LogoutState | null) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
