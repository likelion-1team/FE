import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  clearSession,
  getSessionGeneration,
  LOGOUT_TIMEOUT_MS,
  refreshSession,
  setTokens,
  subscribeSessionEnd,
} from './api/client'
import {
  automaticRestoreBlocked,
  finishLogout,
  getLogoutState,
  LOGOUT_KEY,
  resetLogoutIntent,
  subscribeLogoutState,
  type LogoutState,
} from './session-policy'
import { api } from './api/service'
import type { User } from './api/types'

interface AuthValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  logoutState: LogoutState | null
}
const Context = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [logoutState, setLogoutState] = useState(getLogoutState)
  useEffect(() => {
    let active = true
    let restoring = true
    const stop = subscribeSessionEnd(() => {
      restoring = false
      setUser(null)
      queryClient.clear()
    })
    const stopLogout = subscribeLogoutState(setLogoutState)
    const storage = (event: StorageEvent) => {
      if (event.key !== LOGOUT_KEY || event.newValue === null) return
      restoring = false
      clearSession()
      setUser(null)
      queryClient.clear()
      setLogoutState(getLogoutState())
      setLoading(false)
    }
    window.addEventListener('storage', storage)
    const restore = automaticRestoreBlocked()
      ? Promise.resolve(null)
      : refreshSession().then(() => api.me())
    restore
      .then((me) => {
        if (active && restoring) setUser(me)
      })
      .catch(() => {
        if (restoring) clearSession()
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      stop()
      stopLogout()
      window.removeEventListener('storage', storage)
    }
  }, [queryClient])
  useEffect(() => {
    if (logoutState?.phase !== 'pending') return
    const timer = setTimeout(
      () => finishLogout(logoutState.id, false),
      Math.max(0, LOGOUT_TIMEOUT_MS - (Date.now() - logoutState.at)),
    )
    return () => clearTimeout(timer)
  }, [logoutState])
  async function login(email: string, password: string) {
    if (getLogoutState()?.phase === 'pending')
      throw new Error('서버의 로그아웃 처리를 확인하는 중입니다. 잠시 후 다시 시도해주세요.')
    const generation = getSessionGeneration()
    const data = await api.login(email.trim(), password)
    if (generation !== getSessionGeneration())
      throw new Error('로그인 중 세션이 변경됐습니다. 다시 로그인해주세요.')
    clearSession()
    queryClient.clear()
    resetLogoutIntent()
    setTokens(data)
    setUser(data.user)
  }
  async function logout() {
    // api.logout captures the old bearer, then ends the local session synchronously.
    const operation = api.logout()
    setUser(null)
    queryClient.clear()
    await operation
  }
  return (
    <Context.Provider value={{ user, loading, login, logout, logoutState }}>
      {children}
    </Context.Provider>
  )
}
export function useAuth() {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('AuthProvider is required')
  return ctx
}
