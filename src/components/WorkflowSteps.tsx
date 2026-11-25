import { Link, useLocation } from 'react-router-dom'
import { useLayoutEffect } from 'react'

export function WorkflowSteps({
  base,
  canViewTeamMetrics,
}: {
  base: string
  canViewTeamMetrics: boolean
}) {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [pathname])
  const stages = [
    ['settings', '업무 준비'],
    ['upload', '파일 올리기'],
    ['history', '분석 확인'],
    ['feedbacks', '피드백 읽기'],
    [canViewTeamMetrics ? 'team-dashboard' : 'dashboard', '성과 확인'],
    ['guides', '가이드 활용'],
  ]
  return (
    <nav className="workflow-steps" aria-label="업무 진행 단계">
      {stages.map(([path, label], index) => {
        const active = pathname === `${base}/${path}` || pathname.startsWith(`${base}/${path}/`)
        return (
          <Link key={path} to={`${base}/${path}`} aria-current={active ? 'step' : undefined}>
            <span aria-hidden="true">{index + 1}</span>
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
