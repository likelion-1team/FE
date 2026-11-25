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
  { key: 'tokensPerSuccess', title: '성공 업무당 토큰', percent: false },
  { key: 'reworkRate', title: '재작업률', percent: true },
  { key: 'successRate', title: '업무 성공률', percent: true },
] as const

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
                    ? '표본 부족'
                    : formatNumber(
                        p.value,
                        data.metric === 'successRate' || data.metric === 'reworkRate',
                      )}
                </td>
                <td>{p.conversationCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

export function DashboardPage({ scope = 'ME' }: { scope?: 'ME' | 'TEAM' }) {
  const { teamId, leader, base } = useWorkspace()
  const options = useQuery({
    queryKey: ['team', teamId, 'options'],
    queryFn: ({ signal }) => api.options(teamId, signal),
  })
  const [draft, setDraft] = useState({
    from: '',
    to: '',
    unit: scope === 'TEAM' ? 'WEEK' : 'DAY',
    taskTypes: '',
  })
  const [applied, setApplied] = useState(draft)
  const [metric, setMetric] = useState('tokensPerSuccess')
  const dates = {
    from: applied.from || options.data?.dataFrom || today(),
    to: applied.to || options.data?.dataTo || today(),
    unit: applied.unit,
    taskTypes: applied.taskTypes,
    scope,
  }
  const kpis = useQuery({
    queryKey: ['team', teamId, 'kpis', dates],
    queryFn: ({ signal }) => api.kpis(teamId, dates, signal),
    enabled: options.isSuccess,
  })
  const trends = useQuery({
    queryKey: ['team', teamId, 'trends', dates, metric],
    queryFn: ({ signal }) => api.trends(teamId, { ...dates, metric }, signal),
    enabled: options.isSuccess,
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
          <Field label="업무 유형">
            <select
              value={draft.taskTypes}
              onChange={(e) => setDraft({ ...draft, taskTypes: e.target.value })}
            >
              <option value="">전체 업무</option>
              {options.data.taskTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="집계 단위">
            <select
              value={draft.unit}
              onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
            >
              <option value="DAY">일별</option>
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
        목표 설정과 확인 기반 성과 지표는 준비 중입니다. 아래 수치는 현재 대화 분석 기준이며, 실제
        업무 완료를 확인한 결과와는 다릅니다.
      </FeaturePending>
      {options.isSuccess &&
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
                        ? '측정 자료 또는 분모가 부족합니다.'
                        : value.estimated
                          ? '대화 분석 기반 추정치'
                          : '현재 분석 기준 집계'}
                    </small>
                  </Card>
                )
              })}
            </div>
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
