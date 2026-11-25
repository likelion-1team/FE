import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { api } from '../api/service'
import type { Id } from '../api/types'
import { useWorkspace } from '../components/Workspace'
import { useActiveScreen } from '../components/useActiveScreen'
import {
  Button,
  Card,
  Empty,
  ErrorMessage,
  ErrorState,
  Field,
  formatDate,
  Loading,
  Notice,
  PageTitle,
} from '../components/ui'

const labels: Record<string, string> = {
  READY: '선택 대기',
  EXPIRED: '업로드 만료',
  UPLOADED: '선택 대기',
  ANALYZING: '분석 중',
  DONE: '분석 완료',
  FAILED: '분석 실패',
  CONSUMED: '선택 확정',
  QUEUED: '분석 대기',
  RUNNING: '분석 중',
  SUCCEEDED: '분석 완료',
  PARTIALLY_SUCCEEDED: '일부 분석 완료',
}
function unavailableConversation(code: string | null, duplicateType: string) {
  if (code === 'ALREADY_ANALYZED' || duplicateType === 'SAME_CONTENT')
    return '이미 분석한 대화입니다.'
  if (code === 'UNSUPPORTED_STRUCTURE') return '대화 본문을 읽을 수 없습니다.'
  return '분석할 수 없는 대화입니다. 다른 대화를 선택해주세요.'
}

export function UploadPage() {
  const isActive = useActiveScreen()
  const { teamId, base } = useWorkspace(),
    navigate = useNavigate(),
    client = useQueryClient()
  const settings = useQuery({
    queryKey: ['team', teamId, 'settings'],
    queryFn: ({ signal }) => api.settings(teamId, signal),
  })
  const input = useRef<HTMLInputElement>(null)
  const [params] = useSearchParams()
  const [uploadId, setUploadId] = useState<Id | null>(params.get('uploadId')),
    [candidatePage, setCandidatePage] = useState(1),
    [selected, setSelected] = useState<string[]>([]),
    [search, setSearch] = useState(''),
    [validation, setValidation] = useState(''),
    [fileName, setFileName] = useState('')
  const [attemptKey, setAttemptKey] = useState(() => crypto.randomUUID())
  const attempt = useRef<{
    uploadId: Id
    version: number
    selections: { selectionId: string; taskTypeId: Id }[]
    key: string
  } | null>(null)
  const task = settings.data?.taskType
  const taskId = task?.taskTypeId
  const candidatesQuery = useQuery({
    queryKey: ['team', teamId, 'candidates', uploadId, candidatePage, search],
    queryFn: ({ signal }) => api.candidates(uploadId!, candidatePage, search, signal),
    enabled: uploadId != null,
  })
  const blocked = startBlocked(candidatesQuery.error)
  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.upload(teamId, file, settings.data?.version),
    onSuccess: (data) => {
      if (!isActive()) return
      attempt.current = null
      setUploadId(data.uploadId)
      setCandidatePage(1)
      setSelected([])
      setSearch('')
      setAttemptKey(crypto.randomUUID())
      void client.invalidateQueries({ queryKey: ['team', teamId, 'history'] })
    },
  })
  const start = useMutation({
    mutationFn: () => {
      if (uploadId == null || taskId == null || !settings.data)
        throw new Error('분석할 업무 기준을 확인해주세요.')
      attempt.current ??= {
        uploadId,
        version: settings.data.version,
        selections: selected.map((selectionId) => ({ selectionId, taskTypeId: taskId })),
        key: attemptKey,
      }
      const payload = attempt.current
      return api.startAnalysis(payload.uploadId, payload.version, payload.selections, payload.key)
    },
    onSuccess: (data) => {
      if (!isActive()) return
      void client.invalidateQueries({ queryKey: ['team', teamId, 'history'] })
      client.setQueryData(
        ['team', teamId, 'analysisForUpload', String(data.uploadId)],
        data.analysisId,
      )
      navigate(`${base}/history?analysisId=${data.analysisId}`)
    },
  })
  const busy = uploadMutation.isPending || start.isPending
  function choose(file?: File) {
    if (!file || busy) return
    setValidation('')
    start.reset()
    uploadMutation.reset()
    if (!/\.(json|zip)$/i.test(file.name)) {
      setValidation('conversations.json 또는 ZIP 파일을 선택해주세요.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setValidation('20 MiB 이하의 파일을 선택해주세요.')
      return
    }
    if (!file.size) {
      setValidation('빈 파일은 업로드할 수 없습니다.')
      return
    }
    setUploadId(null)
    setSelected([])
    setCandidatePage(1)
    setFileName(file.name)
    uploadMutation.mutate(file)
  }
  function toggle(id: string) {
    attempt.current = null
    start.reset()
    setAttemptKey(crypto.randomUUID())
    setSelected((s) => (s.includes(id) ? s.filter((v) => v !== id) : [...s, id]))
  }
  const candidates = candidatesQuery.data?.items || []
  const maxSelections = settings.data?.policies.maxSelectionsPerRequest ?? 0
  const conflict = start.error instanceof ApiError && start.error.status === 409
  return (
    <>
      <PageTitle title="대화 업로드 · 대화 선택" />
      {settings.isPending ? (
        <Loading />
      ) : settings.isError ? (
        <ErrorState error={settings.error} retry={() => void settings.refetch()} />
      ) : !task ? (
        <Empty title="분석 기준 설정이 필요합니다">
          <Link to={`${base}/settings`}>분석 대상 · 기준 확인하기</Link>
        </Empty>
      ) : (
        <>
          <Notice>
            분석 대상: {task.name} · {formatDate(settings.data.targetFrom)}–
            {formatDate(settings.data.targetTo)} · 분석할 대화를 직접 선택해주세요.
          </Notice>
          {start.isPending && (
            <Notice>
              분석 접수를 확인하고 있습니다. 접수된 분석은 화면을 이동해도 계속 진행됩니다. 접수가
              확인될 때까지 기다려주세요.
            </Notice>
          )}
          <Card className={`dropzone ${busy ? 'busy' : ''}`}>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                choose(e.dataTransfer.files[0])
              }}
            >
              <div className="row spread">
                <div>
                  <h2>ChatGPT 내보내기 파일</h2>
                  <p>conversations.json 또는 .zip · 본인 계정의 파일 · 최대 20 MiB</p>
                </div>
                <Button onClick={() => input.current?.click()} disabled={busy}>
                  파일 선택
                </Button>
              </div>
              <input
                ref={input}
                type="file"
                accept=".json,.zip,application/json,application/zip"
                aria-label="대화 파일 선택"
                className="sr-only"
                disabled={busy}
                onChange={(e) => {
                  choose(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              <p>
                {uploadMutation.isPending
                  ? '파일을 업로드하고 확인하고 있습니다…'
                  : fileName || '파일을 여기에 끌어 놓거나 파일 선택을 누르세요.'}
              </p>
            </div>
          </Card>
          {validation && <Notice tone="error">{validation}</Notice>}
          <ErrorMessage error={uploadMutation.error} />
          {uploadId != null && (
            <Card>
              <Field label="대화 제목 검색">
                <input
                  type="search"
                  placeholder="대화 제목을 입력하세요"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setCandidatePage(1)
                  }}
                />
              </Field>
              <p role="status">{selected.length}건 선택 · 분석할 대화를 골라주세요.</p>
              {candidatesQuery.isPending ? (
                <Loading />
              ) : candidatesQuery.isError ? (
                <ErrorState
                  error={candidatesQuery.error}
                  retry={() => void candidatesQuery.refetch()}
                />
              ) : candidates.length ? (
                <div className="list">
                  {candidates.map((c) => (
                    <label
                      className={`list-row selectable ${!c.selectable ? 'disabled' : ''}`}
                      key={c.selectionId}
                    >
                      <input
                        type="checkbox"
                        disabled={
                          !c.selectable ||
                          busy ||
                          (!selected.includes(c.selectionId) && selected.length >= maxSelections)
                        }
                        checked={selected.includes(c.selectionId)}
                        onChange={() => toggle(c.selectionId)}
                      />
                      <strong>{c.title || '제목 없는 대화'}</strong>
                      <span>
                        {formatDate(c.startedAt)} ·{' '}
                        {!c.selectable
                          ? unavailableConversation(c.validationCode, c.duplicateType)
                          : c.duplicateType === 'CONTENT_UPDATED'
                            ? '변경된 내용 · 선택 가능'
                            : '선택 가능'}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <Empty
                  title={search.length ? '검색 결과가 없습니다' : '선택 가능한 대화가 없습니다'}
                >
                  파일과 팀의 분석 대상 기간을 확인해주세요.
                </Empty>
              )}
              <ErrorMessage error={start.error} />
              {candidatesQuery.data && (
                <div className="pagination">
                  <Button
                    disabled={candidatePage === 1 || busy}
                    onClick={() => setCandidatePage((p) => p - 1)}
                  >
                    이전 대화
                  </Button>
                  <span>
                    {candidatePage}페이지 · 총 {candidatesQuery.data.total}건
                  </span>
                  <Button
                    disabled={
                      candidatePage * candidatesQuery.data.size >= candidatesQuery.data.total ||
                      busy
                    }
                    onClick={() => setCandidatePage((p) => p + 1)}
                  >
                    다음 대화
                  </Button>
                </div>
              )}
              <p>
                한 번에 최대 {maxSelections}건 · 업로드 후{' '}
                {settings.data.policies.uploadRetentionMinutes}분 안에 선택해주세요.
              </p>
              {conflict && (
                <Notice tone="error">
                  기준 또는 선택 상태가 변경됐습니다. 최신 기준과 후보를 확인하고 다시 선택해주세요.
                  <Button
                    onClick={() => {
                      attempt.current = null
                      setSelected([])
                      setAttemptKey(crypto.randomUUID())
                      start.reset()
                      void settings.refetch()
                      void candidatesQuery.refetch()
                    }}
                  >
                    기준·후보 다시 확인
                  </Button>
                </Notice>
              )}
              <div className="row">
                <Button
                  variant="primary"
                  disabled={
                    busy ||
                    !selected.length ||
                    selected.length > maxSelections ||
                    taskId == null ||
                    blocked ||
                    startBlocked(start.error) ||
                    conflict ||
                    candidatesQuery.isError ||
                    candidatesQuery.isPending
                  }
                  onClick={() => start.mutate()}
                >
                  {start.isPending
                    ? '분석 요청 중…'
                    : selected.length
                      ? `${selected.length}건 분석 시작`
                      : '분석할 대화를 선택하세요'}
                </Button>
                <Link className="button secondary" to={`${base}/history`}>
                  내 업로드 이력
                </Link>
              </div>
            </Card>
          )}
          <small>본인 대화만 업로드해주세요. 원문은 본인만 열람할 수 있습니다.</small>
        </>
      )}
    </>
  )
}

function startBlocked(error: unknown) {
  return error instanceof ApiError && [404, 409, 410].includes(error.status)
}
const terminal = (status?: string) =>
  ['SUCCEEDED', 'PARTIALLY_SUCCEEDED', 'FAILED'].includes(status || '')
function analysisFailureMessage(code: string) {
  switch (code) {
    case 'MODEL_NOT_CONFIGURED':
      return '지금은 AI 분석을 이용할 수 없습니다. 파일을 다시 올리기 전에 관리자에게 문의해주세요.'
    case 'MODEL_TIMEOUT':
      return 'AI 분석 응답 시간이 초과됐습니다. 잠시 후에도 같은 문제가 발생하면 서비스 관리자에게 문의해주세요.'
    default:
      return '이 대화를 분석하지 못했습니다. 아래 오류 코드를 서비스 관리자에게 전달해주세요.'
  }
}
function AnalysisProgress({ id }: { id: string }) {
  const { teamId, base } = useWorkspace()
  const [page, setPage] = useState(1)
  const status = useQuery({
    queryKey: ['team', teamId, 'analysis', id],
    queryFn: ({ signal }) => api.analysis(id, signal),
    refetchInterval: (q) =>
      q.state.error || !q.state.data || terminal(q.state.data.status)
        ? false
        : Math.max(1000, Math.min(30000, q.state.data.pollAfterSeconds * 1000)),
  })
  const items = useQuery({
    queryKey: ['team', teamId, 'analysis', id, 'items', page],
    queryFn: ({ signal }) => api.analysisItems(id, page, signal),
    enabled: terminal(status.data?.status),
  })
  if (status.isPending) return <Loading />
  if (status.isError) return <ErrorState error={status.error} retry={() => void status.refetch()} />
  const data = status.data
  return (
    <Card>
      <h2>{labels[data.status]}</h2>
      <p>
        {' '}
        {data.stage === 'ASSESSING'
          ? '대화 평가 중'
          : data.stage === 'GENERATING_FEEDBACK'
            ? '피드백 생성 중'
            : '대화 처리 현황'}{' '}
        · {data.completedCount}/{data.selectedCount}건 처리
      </p>
      <progress max="100" value={data.progressPercent} aria-label="분석 진행률" />
      <p role="status">
        {data.progressPercent}% · 성공 {data.succeededCount}건 · 실패 {data.failedCount}건
      </p>
      {terminal(data.status) && (
        <>
          {data.status !== 'SUCCEEDED' && (
            <Notice tone="error">
              {data.status === 'PARTIALLY_SUCCEEDED'
                ? '일부 대화만 분석됐습니다. 성공한 결과와 실패한 항목을 각각 확인해주세요.'
                : '분석을 완료하지 못했습니다. 항목별 실패 사유를 확인해주세요.'}
            </Notice>
          )}
          <p>분석 완료는 실제 업무 성공을 의미하지 않습니다.</p>
          {data.succeededCount > 0 && (
            <Link className="button primary" to={`${base}/feedbacks`}>
              내 피드백 보기
            </Link>
          )}
          {items.isPending ? (
            <Loading />
          ) : items.isError ? (
            <ErrorState error={items.error} retry={() => void items.refetch()} />
          ) : (
            <>
              <h3>대화별 분석 결과</h3>
              {items.data.items.length ? (
                <div className="list">
                  {items.data.items.map((item) => (
                    <div className="list-row" key={item.itemId}>
                      <strong>
                        대화 {String(item.conversationId)} · {labels[item.status] || '상태 확인 중'}
                      </strong>
                      {item.failureCode && (
                        <div>
                          <p>{analysisFailureMessage(item.failureCode)}</p>
                          <details>
                            <summary>문의용 오류 정보</summary>
                            <small>
                              분석 {String(id)} · 오류 코드: {item.failureCode}
                            </small>
                          </details>
                        </div>
                      )}
                      {item.feedbackIds.map((feedbackId) => (
                        <Link key={feedbackId} to={`${base}/feedbacks/${feedbackId}`}>
                          피드백 {String(feedbackId)} 보기
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <p>조회 가능한 항목이 없습니다.</p>
              )}
              <div className="pagination">
                <Button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  이전 결과
                </Button>
                <span>
                  {page}페이지 · 총 {items.data.total}건
                </span>
                <Button
                  disabled={page * items.data.size >= items.data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  다음 결과
                </Button>
              </div>
            </>
          )}
          <Link className="button secondary" to={`${base}/upload`}>
            추가 파일 업로드
          </Link>
        </>
      )}
    </Card>
  )
}
function UploadProgress({ id }: { id: string }) {
  const { teamId, base } = useWorkspace()
  const status = useQuery({
    queryKey: ['team', teamId, 'upload', id],
    queryFn: ({ signal }) => api.analysisStatus(id, signal),
    refetchInterval: (q) => (!q.state.error && q.state.data?.status === 'ANALYZING' ? 3000 : false),
  })
  if (status.isPending) return <Loading />
  if (status.isError) return <ErrorState error={status.error} retry={() => void status.refetch()} />
  return (
    <Card>
      <h2>{labels[status.data.status]}</h2>
      {status.data.analysisId != null ? (
        <Link
          className="button primary"
          to={`${base}/history?analysisId=${status.data.analysisId}`}
        >
          분석 상태 보기
        </Link>
      ) : status.data.status === 'CONSUMED' ? (
        <Notice>대화 선택이 확정된 업로드입니다. 아래에서 분석 진행 상태를 확인해주세요.</Notice>
      ) : (
        <>
          {status.data.failReason && <Notice tone="error">{status.data.failReason}</Notice>}
          {['READY', 'UPLOADED', 'FAILED'].includes(status.data.status) && (
            <Link className="button primary" to={`${base}/upload?uploadId=${id}`}>
              대화 선택 계속하기
            </Link>
          )}
          {status.data.status === 'DONE' && (
            <Link className="button primary" to={`${base}/feedbacks`}>
              내 피드백 보기
            </Link>
          )}
        </>
      )}
    </Card>
  )
}

export function HistoryPage() {
  const client = useQueryClient()
  const { teamId, base } = useWorkspace(),
    [params, setParams] = useSearchParams()
  const [page, setPage] = useState(0)
  const history = useQuery({
    queryKey: ['team', teamId, 'history', page],
    queryFn: ({ signal }) => api.history(teamId, page, signal),
    refetchInterval: (q) =>
      q.state.data?.content.some((x) => x.status === 'ANALYZING') ? 5000 : false,
  })
  const active = params.get('uploadId')
  const analysisId = params.get('analysisId')
  return (
    <>
      <PageTitle title="분석 진행 · 업로드 이력" />
      {analysisId ? (
        <AnalysisProgress key={analysisId} id={analysisId} />
      ) : active ? (
        <UploadProgress key={active} id={active} />
      ) : null}
      <Card>
        <div className="row spread">
          <h2>내 업로드 이력</h2>
          <Link className="button secondary" to={`${base}/upload`}>
            추가 대화 업로드
          </Link>
        </div>
        {history.isPending ? (
          <Loading />
        ) : history.isError ? (
          <ErrorState error={history.error} retry={() => void history.refetch()} />
        ) : !history.data.content.length ? (
          <Empty title="업로드 이력이 없습니다">
            본인 대화를 업로드하면 이곳에서 진행 상황을 확인할 수 있습니다.
          </Empty>
        ) : (
          <>
            <div className="list">
              {history.data.content.map((item) => (
                <div className="list-row" key={item.uploadId}>
                  <div>
                    <strong>
                      {formatDate(item.uploadedAt)} · {item.analyzedCount ?? '미확정'}건
                    </strong>
                    <p>
                      {formatDate(item.period?.from)}–{formatDate(item.period?.to)}
                    </p>
                  </div>
                  <span className={`status ${item.status.toLowerCase()}`}>
                    {labels[item.status]}
                  </span>
                  <Button
                    onClick={() => {
                      const run =
                        item.analysisId ??
                        client.getQueryData<Id>([
                          'team',
                          teamId,
                          'analysisForUpload',
                          String(item.uploadId),
                        ])
                      setParams(
                        run == null
                          ? { uploadId: String(item.uploadId) }
                          : { analysisId: String(run) },
                      )
                    }}
                  >
                    상태 보기
                  </Button>
                </div>
              ))}
            </div>
            <div className="pagination">
              <Button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                이전
              </Button>
              <span>{page + 1} 페이지</span>
              <Button
                disabled={(page + 1) * history.data.size >= history.data.totalElements}
                onClick={() => setPage((p) => p + 1)}
              >
                다음
              </Button>
            </div>
          </>
        )}
      </Card>
    </>
  )
}
