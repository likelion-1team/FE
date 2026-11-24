import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/service'
import type { Upload } from '../api/types'
import { useWorkspace } from '../components/Workspace'
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
  UPLOADED: '선택 대기',
  ANALYZING: '분석 중',
  DONE: '분석 완료',
  FAILED: '분석 실패',
}

export function UploadPage() {
  const { teamId, base } = useWorkspace(),
    navigate = useNavigate(),
    client = useQueryClient()
  const settings = useQuery({
    queryKey: ['team', teamId, 'settings'],
    queryFn: ({ signal }) => api.settings(teamId, signal),
  })
  const options = useQuery({
    queryKey: ['team', teamId, 'options'],
    queryFn: ({ signal }) => api.options(teamId, signal),
  })
  const input = useRef<HTMLInputElement>(null)
  const [upload, setUpload] = useState<Upload | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [search, setSearch] = useState(''),
    [validation, setValidation] = useState(''),
    [fileName, setFileName] = useState('')
  const [attemptKey, setAttemptKey] = useState(() => crypto.randomUUID())
  const task = settings.data?.taskTypes[0]
  const taskId =
    task?.id ?? task?.taskTypeId ?? options.data?.taskTypes.find((t) => t.name === task?.name)?.id
  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.upload(teamId, file),
    onSuccess: (data) => {
      setUpload(data)
      setSelected([])
      setSearch('')
      setAttemptKey(crypto.randomUUID())
      void client.invalidateQueries({ queryKey: ['team', teamId, 'history'] })
    },
  })
  const start = useMutation({
    mutationFn: () => {
      if (!upload || taskId == null) throw new Error('분석할 업무 기준을 확인해주세요.')
      return api.startAnalysis(
        upload.uploadId,
        selected.map((externalId) => ({ externalId, taskTypeId: taskId })),
        attemptKey,
      )
    },
    onSuccess: (data) => {
      void client.invalidateQueries({ queryKey: ['team', teamId, 'history'] })
      navigate(`${base}/history?uploadId=${data.uploadId}`)
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
    setUpload(null)
    setSelected([])
    setFileName(file.name)
    uploadMutation.mutate(file)
  }
  function toggle(id: string) {
    start.reset()
    setAttemptKey(crypto.randomUUID())
    setSelected((s) => (s.includes(id) ? s.filter((v) => v !== id) : [...s, id]))
  }
  const candidates =
    upload?.conversations.filter((c) => c.title.toLowerCase().includes(search.toLowerCase())) || []
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
          {upload && (
            <Card>
              <Field label="대화 제목 검색">
                <input
                  type="search"
                  placeholder="대화 제목을 입력하세요"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Field>
              <p role="status">{selected.length}건 선택 · 기본은 모두 선택 해제</p>
              {candidates.length ? (
                <div className="list">
                  {candidates.map((c) => (
                    <label
                      className={`list-row selectable ${c.isDuplicate ? 'disabled' : ''}`}
                      key={c.externalId}
                    >
                      <input
                        type="checkbox"
                        disabled={c.isDuplicate || busy}
                        checked={selected.includes(c.externalId)}
                        onChange={() => toggle(c.externalId)}
                      />
                      <strong>{c.title || '제목 없는 대화'}</strong>
                      <span>
                        {formatDate(c.startedAt)} ·{' '}
                        {c.isDuplicate ? '동일 내용 · 선택 불가' : '선택 가능'}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <Empty
                  title={
                    upload.conversations.length
                      ? '검색 결과가 없습니다'
                      : '선택 가능한 대화가 없습니다'
                  }
                >
                  파일과 팀의 분석 대상 기간을 확인해주세요.
                </Empty>
              )}
              <ErrorMessage error={start.error} />
              {options.isError && (
                <ErrorState error={options.error} retry={() => void options.refetch()} />
              )}
              {taskId == null && (
                <Notice>
                  업무 유형을 확인하는 중입니다. 계속 확인되지 않으면 분석 기준을 다시 확인해주세요.
                </Notice>
              )}
              <div className="row">
                <Button
                  variant="primary"
                  disabled={busy || !selected.length || taskId == null}
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

function AnalysisProgress({ id }: { id: string }) {
  const { teamId, base } = useWorkspace(),
    client = useQueryClient()
  const query = useQuery({
    queryKey: ['team', teamId, 'analysis', id],
    queryFn: ({ signal }) => api.analysisStatus(id, signal),
    refetchInterval: (q) =>
      q.state.status === 'error' || ['DONE', 'FAILED'].includes(q.state.data?.status || '')
        ? false
        : 3000,
    refetchIntervalInBackground: false,
  })
  if (query.isPending) return <Loading />
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />
  const d = query.data
  return (
    <Card>
      <h2>{labels[d.status] || d.status}</h2>
      {d.status === 'ANALYZING' && (
        <>
          <p>선택한 대화를 분석하고 있습니다.</p>
          <progress
            max="100"
            value={Math.max(0, Math.min(d.progress || 0, 100))}
            aria-label="분석 진행률"
          />
          <p role="status">{d.progress ?? 0}%</p>
        </>
      )}
      {d.status === 'UPLOADED' && (
        <p>
          이 업로드는 분석 선택을 기다리고 있습니다. 선택 화면을 닫았다면 파일을 다시
          업로드해주세요.
        </p>
      )}
      {d.status === 'FAILED' && (
        <Notice tone="error">
          {d.failReason || '분석을 완료하지 못했습니다. 파일과 분석 기준을 확인해주세요.'}
        </Notice>
      )}
      {d.status === 'DONE' && (
        <>
          <p>
            저장 {d.savedCount ?? '확인 중'}건 · 중복 제외 {d.skippedDuplicateCount ?? 0}건. 분석
            완료는 실제 업무 성공과 다릅니다.
          </p>
          <Link
            className="button primary"
            to={`${base}/feedbacks`}
            onClick={() =>
              void client.invalidateQueries({ queryKey: ['team', teamId, 'feedbacks'] })
            }
          >
            내 피드백 보기
          </Link>
        </>
      )}
      {d.status === 'FAILED' && (
        <Link className="button secondary" to={`${base}/upload`}>
          파일 다시 업로드
        </Link>
      )}
    </Card>
  )
}

export function HistoryPage() {
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
  return (
    <>
      <PageTitle title="분석 진행 · 업로드 이력" />
      {active && <AnalysisProgress key={active} id={active} />}
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
                  <Button onClick={() => setParams({ uploadId: String(item.uploadId) })}>
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
