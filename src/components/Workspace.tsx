import { createContext, useContext, useState } from 'react'
import { NavLink, Navigate, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth'
import { api } from '../api/service'
import type { Team } from '../api/types'
import { Button, ErrorState, Loading, Modal } from './ui'

const Context = createContext<{ team: Team; teamId: string; leader: boolean; base: string } | null>(
  null,
)
export function useWorkspace() {
  const value = useContext(Context)
  if (!value) throw new Error('Workspace is required')
  return value
}
export function teamPath(team: Team) {
  return `/teams/${team.teamId}/${team.myRole === 'LEADER' ? 'leader' : 'member'}`
}
export function Protected() {
  const { user, loading } = useAuth()
  return loading ? <Loading /> : user ? <Outlet /> : <Navigate to="/login" replace />
}

export function Topbar({ team }: { team?: Team }) {
  const { user, logout } = useAuth()
  const client = useQueryClient()
  const navigate = useNavigate()
  const [info, setInfo] = useState(false)
  return (
    <>
      <header className="topbar">
        <LinkBrand />
        <div className="topbar-actions">
          <Button
            onClick={async () => {
              await client.cancelQueries()
              client.removeQueries({ predicate: (q) => q.queryKey[0] === 'team' })
              navigate('/teams')
            }}
          >
            {team ? `${team.name} · 팀 전환` : '내 팀 목록'}
          </Button>
          <span className="role-badge">
            {team ? (team.myRole === 'LEADER' ? '팀장 LEADER' : '팀원 MEMBER') : '팀 선택 전'}
          </span>
          <Button variant="ghost" onClick={() => setInfo(true)}>
            내 정보
          </Button>
          <Button
            onClick={() => {
              const operation = logout()
              navigate('/login', { replace: true })
              void operation.catch(() => {
                /* AuthProvider publishes a visible failure on the login page. */
              })
            }}
          >
            로그아웃
          </Button>
        </div>
      </header>
      {info && (
        <Modal title="내 정보" onClose={() => setInfo(false)}>
          <p>{user?.name}</p>
          <p>{user?.email}</p>
          <p className="muted">역할은 선택한 팀에 따라 적용됩니다.</p>
        </Modal>
      )}
    </>
  )
}
function LinkBrand() {
  const navigate = useNavigate()
  return (
    <button className="brand" onClick={() => navigate('/teams')}>
      AI 업무 온보딩
    </button>
  )
}

export function Workspace() {
  const { teamId = '', workspace } = useParams()
  const query = useQuery({ queryKey: ['teams'], queryFn: ({ signal }) => api.teams(signal) })
  if (query.isPending) return <Loading />
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />
  const team = query.data.find((t) => String(t.teamId) === teamId)
  if (!team)
    return (
      <>
        <Topbar />
        <ErrorState error={new Error('이 팀에 속해 있지 않거나 팀이 존재하지 않습니다.')} />
      </>
    )
  const leader = team.myRole === 'LEADER'
  const base = teamPath(team)
  if (workspace !== (leader ? 'leader' : 'member'))
    return <Navigate to={`${base}/dashboard`} replace />
  const menu = [
    ['dashboard', '나의 성과'],
    ['team-dashboard', '팀 성과'],
    ['upload', '대화 업로드'],
    ['history', '분석 이력'],
    ['feedbacks', '내 피드백'],
    ['guides', '개선 가이드'],
    ['settings', leader ? '팀 설정' : '분석 대상 · 기준'],
    ...(leader ? [['shared', '공유 사례']] : []),
  ]
  return (
    <Context.Provider value={{ team, teamId, leader, base }}>
      <Topbar team={team} />
      <div className="workspace">
        <aside className="sidebar">
          <small>WORKSPACE</small>
          <nav aria-label="업무 공간 메뉴">
            {menu.map(([path, label]) => (
              <NavLink
                key={path}
                to={`${base}/${path}`}
                className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="privacy-note">
            <p>내 데이터는 나에게만</p>
            <p>
              개인 원문·피드백은 본인만 봅니다.
              <br />팀 지표는 집계로 확인합니다.
            </p>
          </div>
        </aside>
        <main className="content" id="main">
          <Outlet key={`${teamId}-${workspace}`} />
        </main>
      </div>
    </Context.Provider>
  )
}
