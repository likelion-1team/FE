import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource/ibm-plex-sans-kr/400.css'
import '@fontsource/ibm-plex-sans-kr/500.css'
import '@fontsource/ibm-plex-sans-kr/600.css'
import '@fontsource/ibm-plex-sans-kr/700.css'
import { AuthProvider } from './auth'
import { ApiError } from './api/client'
import App from './App'
import './styles.css'
import { ErrorBoundary } from './components/ErrorBoundary'

const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      gcTime: 120_000,
      refetchOnWindowFocus: false,
      retry: (attempt, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && attempt < 1,
    },
    mutations: { retry: false },
  },
})
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <a className="skip-link" href="#main">
            본문으로 이동
          </a>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </QueryClientProvider>,
)
