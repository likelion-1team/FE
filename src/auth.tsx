import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { clearSession, refreshSession, setTokens, subscribeSessionEnd } from './api/client'
import { api } from './api/service'
import type { User } from './api/types'

interface AuthValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}
const Context = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    const stop = subscribeSessionEnd(() => {
      setUser(null)
      queryClient.clear()
    })
    refreshSession()
      .then(() => api.me())
      .then((me) => {
        if (active) setUser(me)
      })
      .catch(() => {
        clearSession()
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      stop()
    }
  }, [queryClient])
  async function login(email: string, password: string) {
    const data = await api.login(email.trim(), password)
    queryClient.clear()
    setTokens(data)
    setUser(data.user)
  }
  async function logout() {
    try {
      await api.logout()
    } finally {
      clearSession()
      await queryClient.cancelQueries()
      queryClient.clear()
      setUser(null)
    }
  }
  return <Context.Provider value={{ user, loading, login, logout }}>{children}</Context.Provider>
}
export function useAuth() {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('AuthProvider is required')
  return ctx
}
