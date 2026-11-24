import { useCallback, useEffect, useRef } from 'react'

// A completed server mutation may outlive its screen. It must not navigate another workspace.
export function useActiveScreen() {
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  return useCallback(() => active.current, [])
}
