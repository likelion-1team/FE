import { Navigate, Route, Routes, Link } from 'react-router-dom'
import { Protected, Workspace } from './components/Workspace'
import { AuthPage } from './pages/AuthPage'
import { TeamsPage } from './pages/TeamsPage'
import { DashboardPage } from './pages/DashboardPage'
import { SettingsPage } from './pages/SettingsPage'
import { UploadPage, HistoryPage } from './pages/UploadPage'
import { FeedbackPage, FeedbackDetailPage } from './pages/FeedbackPage'
import { GuidesPage, SharedCasesPage } from './pages/GuidesPage'
import { Empty } from './components/ui'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/signup" element={<AuthPage key="signup" signup />} />
      <Route element={<Protected />}>
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/teams/:teamId/:workspace" element={<Workspace />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage key="ME" />} />
          <Route path="team-dashboard" element={<DashboardPage key="TEAM" scope="TEAM" />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="feedbacks" element={<FeedbackPage />} />
          <Route path="feedbacks/:feedbackId" element={<FeedbackDetailPage />} />
          <Route path="guides" element={<GuidesPage />} />
          <Route path="shared" element={<SharedCasesPage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/teams" replace />} />
      <Route
        path="*"
        element={
          <main className="teams-page">
            <Empty title="페이지를 찾을 수 없습니다">
              <Link to="/teams">내 팀 목록으로</Link>
            </Empty>
          </main>
        }
      />
    </Routes>
  )
}
