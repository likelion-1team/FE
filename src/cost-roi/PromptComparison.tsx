import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  promptComparisonApi,
  promptLimit,
  taskLimit,
  type PromptComparisonInput,
  type PromptComparisonResult,
  type PromptRun,
} from '../api/prompt-comparison'
import { Button, Card, ErrorState, Field, Loading, Notice } from '../components/ui'
import './prompt-comparison.css'

const fields = [
  {
    key: 'task',
    label: '공통 업무',
    limit: taskLimit,
    rows: 5,
    placeholder: '예: 고객의 문의 내용과 답변에 꼭 들어가야 할 정보',
  },
  {
    key: 'baselinePrompt',
    label: '기존 프롬프트',
    limit: promptLimit,
    rows: 6,
    placeholder: '지금 쓰고 있는 프롬프트를 입력하세요.',
  },
  {
    key: 'improvedPrompt',
    label: '개선 프롬프트',
    limit: promptLimit,
    rows: 6,
    placeholder: '가이드의 개선 문구나 직접 다듬은 프롬프트를 입력하세요.',
  },
] as const

const tokenRows = [
  { key: 'inputTokens', label: '입력 토큰' },
  { key: 'outputTokens', label: '출력 토큰' },
  { key: 'cachedInputTokens', label: '캐시 입력 토큰 (입력에 포함)' },
  { key: 'totalTokens', label: '총 토큰' },
] as const

const statusLabels = {
  COMPLETED: '완료',
  INCOMPLETE: '미완료',
  REFUSED: '답변 거절',
  FAILED: '실패',
}

const tokens = (value: number | null | undefined) =>
  value == null ? '—' : value.toLocaleString('ko-KR')

function ComparisonResults({
  baseline,
  improved,
  active,
}: PromptComparisonResult & { active: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (active) heading.current?.focus()
  }, [active, baseline, improved])

  const sameModel = Boolean(baseline.model) && baseline.model === improved.model
  const providerRuns = [
    { label: '기존', ids: baseline.providerIds },
    { label: '개선', ids: improved.providerIds },
  ]
  const comparable = sameModel && baseline.status === 'COMPLETED' && improved.status === 'COMPLETED'
  const difference =
    comparable && baseline.usage && improved.usage
      ? baseline.usage.totalTokens - improved.usage.totalTokens
      : null
  const baselineTotal = baseline.usage?.totalTokens
  const percent =
    difference != null && baselineTotal
      ? (Math.abs(difference) / baselineTotal).toLocaleString('ko-KR', {
          style: 'percent',
          maximumFractionDigits: 1,
        })
      : null
  const message =
    difference == null
      ? '같은 모델에서 두 실행이 모두 완료되면 증감률을 표시합니다.'
      : difference === 0
        ? '총 토큰이 같습니다.'
        : `총 ${tokens(Math.abs(difference))} 토큰 ${difference > 0 ? '감소' : '증가'}${percent ? ` (${percent})` : ''}`

  return (
    <Card className="prompt-results">
      <h2 ref={heading} tabIndex={-1}>
        OpenAI 실측 결과
      </h2>
      <p className="prompt-delta" role="status">
        {message}
      </p>
      {sameModel && <p className="muted">실행 모델 {baseline.model}</p>}
      <table className="prompt-token-table" aria-label="프롬프트별 OpenAI 토큰 사용량">
        <thead>
          <tr>
            <th scope="col">사용량</th>
            <th scope="col">기존</th>
            <th scope="col">개선</th>
          </tr>
        </thead>
        <tbody>
          {tokenRows.map(({ key, label }) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              <td>{tokens(baseline.usage?.[key])}</td>
              <td>{tokens(improved.usage?.[key])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">응답을 읽고 두 결과가 같은 업무 기준을 충족했는지 확인하세요.</p>
      <div className="prompt-pair">
        <RunOutput label="기존 프롬프트 결과" run={baseline} showModel={!sameModel} />
        <RunOutput label="개선 프롬프트 결과" run={improved} showModel={!sameModel} />
      </div>
      {providerRuns.some(({ ids }) => ids?.requestId || ids?.responseId) && (
        <details className="prompt-provider-ids">
          <summary>OpenAI 호출 식별 정보</summary>
          <p className="muted">토큰은 OpenAI Responses API의 usage 값입니다.</p>
          <dl>
            {providerRuns.map(({ label, ids }) => (
              <div key={label}>
                <dt>{label} 프롬프트</dt>
                <dd>
                  요청 ID <code>{ids?.requestId ?? '—'}</code>
                </dd>
                <dd>
                  응답 ID <code>{ids?.responseId ?? '—'}</code>
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </Card>
  )
}

function RunOutput({
  label,
  run,
  showModel,
}: {
  label: string
  run: PromptRun
  showModel: boolean
}) {
  return (
    <section className="prompt-output">
      <h3>{label}</h3>
      <p className="muted">
        {statusLabels[run.status]}
        {showModel && run.model ? ` · ${run.model}` : ''}
      </p>
      {run.message && <p>{run.message}</p>}
      {run.output && <div className="prompt-response">{run.output}</div>}
    </section>
  )
}

export function PromptComparison({ teamId, active }: { teamId: string; active: boolean }) {
  const [input, setInput] = useState<PromptComparisonInput>({
    task: '',
    baselinePrompt: '',
    improvedPrompt: '',
  })
  const configuration = useQuery({
    queryKey: ['team', teamId, 'prompt-comparison'],
    queryFn: ({ signal }) => promptComparisonApi.configuration(teamId, signal),
    enabled: active,
    retry: false,
  })
  const comparison = useMutation({
    mutationFn: (value: PromptComparisonInput) => promptComparisonApi.compare(teamId, value),
    retry: false,
  })

  if (configuration.isPending) return <Loading />
  if (configuration.isError) {
    return <ErrorState error={configuration.error} retry={() => void configuration.refetch()} />
  }

  const { configured, model } = configuration.data
  const valid = fields.every(({ key }) => input[key].trim())
  function compare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (configured && valid && !comparison.isPending) comparison.mutate(input)
  }

  return (
    <div className="prompt-comparison">
      <Card>
        <h2>OpenAI 토큰 실측 비교</h2>
        <p>같은 업무를 두 프롬프트로 각각 한 번 실행해 OpenAI가 반환한 토큰을 비교합니다.</p>
        {configured ? (
          <form className="prompt-form" onSubmit={compare} aria-busy={comparison.isPending}>
            <fieldset disabled={comparison.isPending}>
              {fields.map(({ key, label, limit, rows, placeholder }) => (
                <div key={key} className={key === 'task' ? 'prompt-task' : undefined}>
                  <Field label={label}>
                    <textarea
                      required
                      maxLength={limit}
                      rows={rows}
                      value={input[key]}
                      placeholder={placeholder}
                      onChange={(event) => {
                        setInput({ ...input, [key]: event.target.value })
                        comparison.reset()
                      }}
                    />
                  </Field>
                </div>
              ))}
            </fieldset>
            <p className="muted">
              실행하면 입력 내용이 OpenAI로 전송되며 호출 2건의 비용이 발생할 수 있습니다.
            </p>
            <div className="prompt-actions">
              <Button type="submit" variant="primary" disabled={!valid || comparison.isPending}>
                {comparison.isPending ? 'OpenAI 실행 중…' : '두 프롬프트 실행'}
              </Button>
              <small className="muted">모델 {model} · 응답당 최대 1,024 토큰</small>
            </div>
          </form>
        ) : (
          <Notice>관리자가 서버에서 OpenAI 연동을 설정하면 실측 비교를 실행할 수 있습니다.</Notice>
        )}
        {comparison.isError && <Notice tone="error">{comparison.error.message}</Notice>}
      </Card>
      {comparison.data && <ComparisonResults {...comparison.data} active={active} />}
    </div>
  )
}
