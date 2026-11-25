import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/service'
import type { Trends } from '../api/types'
import { useWorkspace } from '../components/Workspace'
import {
  Button,
  Card,
  Empty,
  ErrorState,
  FeaturePending,
  Field,
  formatNumber,
  Loading,
  Notice,
  PageTitle,
  today,
} from '../components/ui'

const metrics = [
  { key: 'tokensPerSuccess', title: '확인된 성공 업무당 토큰', percent: false },
  { key: 'reworkRate', title: '오류 수정 재작업률', percent: true },
  { key: 'successRate', title: '본인 확인 성공률', percent: true },
] as const

function metricStatus(status?: string) {
  return (
    (
      {
        SUPPRESSED: '기여 인원·공개 정책에 따라 비공개',
        NOT_COMPARABLE: '서로 다른 기준으로 비교 불가',
        NO_DATA: '대상 데이터 없음',
        NOT_MEASURED: '미측정',
        ZERO_DENOMINATOR: '분모 없음',
        INSUFFICIENT_SAMPLE: '표본 부족',
        INSUFFICIENT_CONFIRMATION: '본인 확인율 부족',
      } as Record<string, string>
    )[status || ''] || '측정 자료 또는 분모가 부족합니다.'
  )
}
export function TrendChart({ data }: { data: Trends }) {
  const valid = data.points.filter((p) => p.value != null && !p.insufficientSample)
  if (!valid.length)
    return (
      <Empty title="추이를 표시할 자료가 부족합니다">
        측정값이나 표본이 충분하지 않은 구간은 0으로 표시하지 않습니다.
      </Empty>
    )
  const max = Math.max(...valid.map((p) => Math.abs(p.value!)), 1)
  const x = (i: number) =>
    data.points.length === 1 ? 310 : 30 + (i * 560) / (data.points.length - 1)
  const y = (value: number) => 190 - (value / max) * 150
  const segments: string[] = []
  let segment = ''
  data.points.forEach((p, i) => {
    if (p.value == null || p.insufficientSample) {
      if (segment) segments.push(segment)
      segment = ''
    } else segment += `${segment ? ' L' : 'M'}${x(i)},${y(p.value)}`
  })
  if (segment) segments.push(segment)
  return (
    <div className="chart">
      <svg viewBox="0 0 620 230" role="img" aria-label={`${data.metric} 기간별 추이`}>
        <title>기간별 추이. 아래 표에서 정확한 값을 확인할 수 있습니다.</title>
        {[40, 90, 140, 190].map((v) => (
          <line key={v} x1="30" x2="590" y1={v} y2={v} stroke="var(--border)" />
        ))}
        {segments.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--primary)" strokeWidth="2.5" />
        ))}
        {data.points.map((p, i) =>
          p.value != null && !p.insufficientSample ? (
            <circle key={p.date} cx={x(i)} cy={y(p.value)} r="4" fill="var(--primary)">
              <title>
                {p.date}: {formatNumber(p.value, data.metric !== 'tokensPerSuccess')}
              </title>
            </circle>
          ) : null,
        )}
      </svg>
      <details>
        <summary>기간별 수치 보기</summary>
        <table>
          <thead>
            <tr>
              <th>날짜</th>
              <th>측정값</th>
              <th>대화 수</th>
            </tr>
          </thead>
          <tbody>
            {data.points.map((p) => (
              <tr key={p.date}>
                <td>{p.date}</td>
                <td>
                  {p.insufficientSample
                    ? metricStatus(p.status)
                    : formatNumber(
                        p.value,
                        data.metric === 'successRate' || data.metric === 'reworkRate',
                      )}
                </td>
                <td>{p.conversationCount ?? '비공개·미측정'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

export function DashboardPage({ scope = 'ME' }: { scope?: 'ME' | 'TEAM' }) {
  const { team } = useWorkspace()
  if (scope === 'TEAM' && team.capabilities?.canViewTeamMetrics !== true)
    return <ErrorState error={new Error('이 팀의 팀 성과 조회 권한이 없습니다.')} />
  return <DashboardContent key={scope} scope={scope} />
}
function DashboardContent({ scope }: { scope: 'ME' | 'TEAM' }) {
  const { teamId, leader, base } = useWorkspace()
  const options = useQuery({
    queryKey: ['team', teamId, 'options', scope],
    queryFn: ({ signal }) => api.options(teamId, signal, scope),
  })
  const [draft, setDraft] = useState({
    from: '',
    to: '',
    unit: scope === 'TEAM' ? 'WEEK' : 'DAY',
    taskTypes: '',
    weekStart: '',
    settingsVersion: '',
  })
  const [applied, setApplied] = useState(draft)
  const [metric, setMetric] = useState('tokensPerSuccess')
  const dates = {
    from: applied.from || options.data?.dataFrom || today(),
    to: applied.to || options.data?.dataTo || today(),
    unit: applied.unit,
    taskTypes: applied.taskTypes,
    scope,
    weekStart: applied.weekStart || options.data?.availableWeeks?.[0]?.weekStart || '',
    settingsVersion: applied.settingsVersion || String(options.data?.settingsVersion ?? ''),
  }
  const ready =
    options.isSuccess &&
    (scope !== 'TEAM' || !options.data.availableWeeks || !!dates.weekStart) &&
    (!options.data.settingsVersions || options.data.settingsVersions.length > 0)
  const kpis = useQuery({
    queryKey: ['team', teamId, 'kpis', dates],
    queryFn: ({ signal }) => api.kpis(teamId, dates, signal),
    enabled: ready,
  })
  const trends = useQuery({
    queryKey: ['team', teamId, 'trends', dates, metric],
    queryFn: ({ signal }) => api.trends(teamId, { ...dates, metric }, signal),
    enabled: ready,
  })
  const [invalidDates, setInvalidDates] = useState(false)
  return (
    <>
      <PageTitle
        title={scope === 'ME' ? '나의 AI 업무 성과' : '팀 AI 업무 성과'}
        description={
          scope === 'ME'
            ? '본인 대화의 분석 결과를 확인합니다.'
            : '팀 성과는 집계로 확인합니다. 개인 원문과 피드백은 본인만 봅니다.'
        }
      />
      {scope === 'TEAM' && !leader && (
        <Notice>
          팀 집계 공개 범위는 서버 권한에 따릅니다. 조회가 제한되면 팀장에게 문의해주세요.
        </Notice>
      )}
      {options.isPending ? (
        <Loading />
      ) : options.isError ? (
        <ErrorState error={options.error} retry={() => void options.refetch()} />
      ) : (
        <form
          className="filters"
          onSubmit={(e) => {
            e.preventDefault()
            const from = draft.from || dates.from,
              to = draft.to || dates.to
            if (from > to) {
              setInvalidDates(true)
              return
            }
            setInvalidDates(false)
            setApplied({ ...draft, from, to })
          }}
        >
          {scope === 'ME' ? (
            <>
              <Field label="시작일">
                <input
                  type="date"
                  required
                  value={draft.from || dates.from}
                  onChange={(e) => setDraft({ ...draft, from: e.target.value })}
                />
              </Field>
              <Field label="종료일">
                <input
                  type="date"
                  required
                  min={draft.from || dates.from}
                  value={draft.to || dates.to}
                  onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                />
              </Field>
            </>
          ) : (
            <Field label="완료된 주간">
              <select
                value={draft.weekStart || dates.weekStart}
                onChange={(e) => setDraft({ ...draft, weekStart: e.target.value })}
              >
                {options.data.availableWeeks?.map((week) => (
                  <option key={week.weekStart} value={week.weekStart}>
                    {week.weekStart}–{week.weekEnd}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="분석 기준 버전">
            <select
              value={draft.settingsVersion || dates.settingsVersion}
              onChange={(e) => setDraft({ ...draft, settingsVersion: e.target.value })}
            >
              {(options.data.settingsVersions || [options.data.settingsVersion]).map(
                (version) =>
                  version != null && (
                    <option key={version} value={version}>
                      버전 {version}
                    </option>
                  ),
              )}
            </select>
          </Field>
          <Field label="집계 단위">
            <select
              value={draft.unit}
              onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
            >
              {scope === 'ME' && <option value="DAY">일별</option>}
              <option value="WEEK">주간</option>
            </select>
          </Field>
          <Button type="submit" variant="ghost">
            적용
          </Button>
        </form>
      )}
      {invalidDates && <Notice tone="error">종료일은 시작일 이후여야 합니다.</Notice>}
      <FeaturePending title="팀 목표">
        목표 편집 화면은 준비 중입니다. 아래 지표는 본인 확인 결과를 집계하며 토큰 수는 토크나이저
        추정값입니다. 팀 지표는 완료된 주간과 서버의 기여 인원·표본·확인율 정책을 적용합니다.
      </FeaturePending>
      {options.isSuccess && !ready && (
        <Notice>조회 가능한 기준 버전 또는 완료된 주간이 없습니다.</Notice>
      )}
      {ready &&
        (kpis.isPending ? (
          <Loading />
        ) : kpis.isError ? (
          <ErrorState error={kpis.error} retry={() => void kpis.refetch()} />
        ) : (
          <>
            <div className="kpi-grid">
              {metrics.map((m) => {
                const value = kpis.data[m.key]
                return (
                  <Card key={m.key}>
                    <p>{m.title}</p>
                    <strong className="kpi-value">{formatNumber(value?.value, m.percent)}</strong>
                    <small>
                      {value?.value == null
                        ? metricStatus(value?.status)
                        : value.estimated
                          ? '대화 분석 기반 추정치'
                          : '본인 확인 결과 집계'}
                    </small>
                  </Card>
                )
              })}
            </div>
            {kpis.data.cohortCoverage && (
              <Notice>
                선택 {kpis.data.cohortCoverage.selectedCount}건 · 집계 대상{' '}
                {kpis.data.cohortCoverage.inScopeCount}건 · 결과 확인{' '}
                {kpis.data.cohortCoverage.outcomeConfirmedCount}건 · 재작업 확인{' '}
                {kpis.data.cohortCoverage.reworkConfirmedCount}건
              </Notice>
            )}
            {scope === 'TEAM' && leader && kpis.data.coverage && (
              <Notice>
                제출 {kpis.data.coverage.submittedMembers} / {kpis.data.coverage.totalMembers}명 ·
                분석 {kpis.data.coverage.analyzedConversations}건
                {kpis.data.coverage.targetCount
                  ? ` / 대상 ${kpis.data.coverage.targetCount}건`
                  : ''}{' '}
                · 제출된 표본의 집계입니다.
              </Notice>
            )}
            <Card>
              <div className="row spread">
                <h2>{metrics.find((m) => m.key === metric)?.title} · 기간별 추이</h2>
                <Field label="지표 선택">
                  <select value={metric} onChange={(e) => setMetric(e.target.value)}>
                    {metrics.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {trends.isPending ? (
                <Loading />
              ) : trends.isError ? (
                <ErrorState error={trends.error} retry={() => void trends.refetch()} />
              ) : (
                <TrendChart data={trends.data} />
              )}
            </Card>
            <Card>
              <h2>보조 지표</h2>
              <p>분석 대화 {formatNumber(kpis.data.conversationCount?.value)}건</p>
              <Link className="button ghost" to={`${base}/feedbacks`}>
                내 피드백 보기
              </Link>
            </Card>
          </>
        ))}
    </>
  )
}
