// Cross-user withdrawal still requires a server event for immediate delivery.
// Until then, revalidate on return/reconnect and every 15 seconds while visible.
export const sharedContentPolicy = {
  staleTime: 0,
  gcTime: 0,
  refetchOnWindowFocus: 'always' as const,
  refetchOnReconnect: 'always' as const,
  refetchInterval: 15000,
  refetchIntervalInBackground: false,
}
