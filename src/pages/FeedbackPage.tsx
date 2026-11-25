import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/service'
import type {
  FeedbackItem,
  FeedbackList,
  Id,
  OutcomeAssessment,
  Reaction,
  ReworkAssessment,
  SharePreview,
} from '../api/types'
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
  Modal,
  Notice,
  PageTitle,
  today,
} from '../components/ui'

const reworkOptions = [
  ['ERROR_CORRECTION', '오류 수정'],
  ['REQUIREMENT_CHANGE', '요구 변경'],
  ['EXPRESSION_REFINEMENT', '표현 개선'],
  ['EXPLORATION', '탐색·추가 질문'],
  ['NONE', '다시 처리하지 않음'],
  ['UNKNOWN', '구분할 수 없음'],
] as const
const outcomeLabels = { SUCCESS: '성공', FAILURE: '실패', UNKNOWN: '모름' } as const
function reworkLabel(type: string) {
  return reworkOptions.find(([value]) => value === type)?.[1] ?? type
}

export const feedbackTypes = [
  { value: '', label: '모든 피드백 유형' },
  { value: 'MISSING_CONTEXT', label: '맥락 누락' },
  { value: 'LONG_CONVERSATION', label: '긴 대화' },
  { value: 'OVERSPEC_MODEL', label: '과한 모델' },
]

export function FeedbackPage() {
  const { teamId, base } = useWorkspace()
  const options = useQuery({
    queryKey: ['team', teamId, 'options'],
    queryFn: ({ signal }) => api.options(teamId, signal),
  })
  const [filters, setFilters] = useState({ from: '', to: '', types: '', sort: 'LATEST', page: 0 })
  const params = {
    ...filters,
    from: filters.from || options.data?.dataFrom || today(),
    to: filters.to || options.data?.dataTo || today(),
  }
  const query = useQuery({
    queryKey: ['team', teamId, 'feedbacks', params],
    queryFn: ({ signal }) => api.feedbacks(teamId, params, signal),
    enabled: options.isSuccess,
  })
  const items =
    query.data?.days.flatMap((day) => day.feedbacks.map((item) => ({ ...item, date: day.date }))) ||
    []
  return (
    <>
      <PageTitle title="내 피드백" />
      <Notice>실제 대화에서 찾은 개선점을 확인하고 개선 프롬프트를 다음 업무에 사용하세요.</Notice>
      <div className="filters">
        <Field label="시작일">
          <input
            type="date"
            value={params.from}
            max={params.to}
            onChange={(e) => setFilters({ ...filters, from: e.target.value, page: 0 })}
          />
        </Field>
        <Field label="종료일">
          <input
            type="date"
            value={params.to}
            min={params.from}
            onChange={(e) => setFilters({ ...filters, to: e.target.value, page: 0 })}
          />
        </Field>
        <Field label="피드백 유형">
          <select
            value={filters.types}
            onChange={(e) => setFilters({ ...filters, types: e.target.value, page: 0 })}
          >
            {feedbackTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="정렬">
          <select
            value={filters.sort}
            onChange={(e) => setFilters({ ...filters, sort: e.target.value, page: 0 })}
          >
            <option value="LATEST">최신순</option>
            <option value="FREQUENCY">빈도순</option>
          </select>
        </Field>
      </div>
      {options.isError ? (
        <ErrorState error={options.error} retry={() => void options.refetch()} />
      ) : query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !items.length ? (
        <Empty title="조건에 맞는 피드백이 없습니다">
          분석을 완료했는지 확인하거나 기간과 유형을 변경해주세요.
        </Empty>
      ) : (
        items.map((item) => (
          <Card key={item.feedbackId}>
            <small>
              {formatDate(item.date)} · {item.type}
            </small>
            <h2>{item.title}</h2>
            <p className="success">발생 {item.occurrenceCount}회 · 절감량 미측정</p>
            <div className="row">
              <Link
                className="button primary"
                to={`${base}/feedbacks/${item.feedbackId}`}
                state={{ item }}
              >
                개선 내용 보기
              </Link>
              <small>{item.isShared ? '팀 공유 허용 중' : '팀 공유 꺼짐 · 본인만 열람'}</small>
            </div>
          </Card>
        ))
      )}
      <div className="pagination">
        <Button
          disabled={filters.page === 0 || query.isFetching}
          onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
        >
          이전
        </Button>
        <span>{filters.page + 1} 페이지</span>
        <Button
          disabled={!items.length || query.isFetching}
          onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
        >
          다음
        </Button>
      </div>
    </>
  )
}

function OriginalConversation({
  id,
  feedbackId,
  onClose,
}: {
  id: Id
  feedbackId: string
  onClose: () => void
}) {
  const { teamId } = useWorkspace()
  const query = useQuery({
    queryKey: ['team', teamId, 'conversation-version', id, feedbackId],
    queryFn: ({ signal }) => api.conversationVersion(id, feedbackId, signal),
  })
  return (
    <Modal title="근거 대화 원문" onClose={onClose}>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <p>
            {query.data.title} · {formatDate(query.data.startedAt)}
          </p>
          <small>본인 대화만 열람 가능합니다. 강조된 메시지는 피드백의 근거입니다.</small>
          <div className="messages">
            {query.data.messages.map((m) => (
              <article
                key={m.idx}
                className={`message ${query.data.highlightIndexes.includes(m.idx) ? 'highlight' : ''}`}
              >
                <strong>
                  {m.role === 'USER' || m.role === 'user' ? '사용자' : 'AI'}
                  {query.data.highlightIndexes.includes(m.idx) ? ' · 피드백 근거' : ''}
                </strong>
                <p className="pre-wrap">{m.content}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}

export function FeedbackDetailPage() {
  const { feedbackId = '' } = useParams()
  return <FeedbackDetailContent key={feedbackId} />
}
function FeedbackDetailContent() {
  const { feedbackId = '' } = useParams(),
    { teamId, base } = useWorkspace(),
    client = useQueryClient()
  const location = useLocation()
  const item = (location.state as { item?: FeedbackItem } | null)?.item
  const query = useQuery({
    queryKey: ['team', teamId, 'feedback', feedbackId],
    queryFn: ({ signal }) => api.feedback(feedbackId, signal),
  })
  const [original, setOriginal] = useState<Id | null>(null),
    [reason, setReason] = useState(''),
    [reactionOverride, setReaction] = useState<Reaction | null | undefined>(undefined),
    [revoke, setRevoke] = useState(false),
    [revoked, setRevoked] = useState(false),
    [copyMessage, setCopyMessage] = useState(''),
    [copyError, setCopyError] = useState(false),
    [savedOutcome, setSavedOutcome] = useState<OutcomeAssessment | null>(null),
    [outcomeNote, setOutcomeNote] = useState(''),
    [outcomeMessage, setOutcomeMessage] = useState(''),
    [savedRework, setSavedRework] = useState<ReworkAssessment | null>(null),
    [reworkType, setReworkType] = useState<(typeof reworkOptions)[number][0] | null>(null),
    [reworkNote, setReworkNote] = useState(''),
    [reworkMessage, setReworkMessage] = useState(''),
    [preview, setPreview] = useState<SharePreview | null>(null),
    [previewShareVersion, setPreviewShareVersion] = useState(0),
    [now, setNow] = useState(Date.now),
    [shareMessage, setShareMessage] = useState(''),
    [shareVersionOverride, setShareVersionOverride] = useState<number | null>(null)
  useEffect(() => {
    if (!preview) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [preview])
  const previewExpired = preview != null && Date.parse(preview.expiresAt) <= now
  function refreshMetrics() {
    for (const key of ['kpis', 'trends', 'options', 'submissions'])
      void client.invalidateQueries({ queryKey: ['team', teamId, key] })
  }
  const currentReaction =
    reactionOverride === undefined
      ? query.data && 'reaction' in query.data
        ? query.data.reaction
        : item?.myReaction
      : reactionOverride
  function patchList(update: Partial<FeedbackItem>) {
    client.setQueriesData<FeedbackList>({ queryKey: ['team', teamId, 'feedbacks'] }, (old) =>
      old
        ? {
            days: old.days.map((day) => ({
              ...day,
              feedbacks: day.feedbacks.map((f) =>
                String(f.feedbackId) === feedbackId ? { ...f, ...update } : f,
              ),
            })),
          }
        : old,
    )
  }
  const reaction = useMutation({
    mutationFn: (value: Reaction | null) =>
      api.reaction(feedbackId, value, value === 'NOT_APPLICABLE' ? reason : undefined),
    onSuccess: (_, value) => {
      setReaction(value)
      patchList({ myReaction: value })
      setReason('')
    },
  })
  const outcomeAssessment = savedOutcome ?? query.data?.outcomeAssessment ?? null
  const reworkAssessment = savedRework ?? query.data?.reworkAssessment ?? null
  const selectedRework = reworkType ?? reworkAssessment?.type ?? 'ERROR_CORRECTION'
  const saveOutcome = useMutation({
    mutationFn: (outcome: 'SUCCESS' | 'FAILURE' | 'UNKNOWN') => {
      if (query.data?.itemId == null) throw new Error('확인할 분석 항목이 없습니다.')
      return api.outcome(query.data.itemId, {
        expectedVersion: outcomeAssessment?.version ?? 0,
        outcome,
        ...(outcomeNote.trim() ? { note: outcomeNote.trim() } : {}),
      })
    },
    onSuccess: async (saved) => {
      setSavedOutcome(saved)
      refreshMetrics()
      setOutcomeNote('')
      setOutcomeMessage(
        saved.outcome === 'UNKNOWN'
          ? '결과를 모름으로 저장했습니다. 성공률 분모에는 넣지 않습니다.'
          : '업무 결과를 저장했습니다. 성공률은 이 확인값으로 계산됩니다.',
      )
      await client.invalidateQueries({ queryKey: ['team', teamId, 'feedback', feedbackId] })
    },
  })
  const saveRework = useMutation({
    mutationFn: () => {
      if (query.data?.itemId == null) throw new Error('확인할 분석 항목이 없습니다.')
      return api.rework(query.data.itemId, {
        expectedVersion: reworkAssessment?.version ?? 0,
        type: selectedRework,
        ...(reworkNote.trim() ? { note: reworkNote.trim() } : {}),
      })
    },
    onSuccess: async (saved) => {
      setSavedRework(saved)
      refreshMetrics()
      setReworkType(saved.type)
      setReworkNote('')
      setReworkMessage(
        saved.type === 'UNKNOWN'
          ? '재작업 이유를 모름으로 저장했습니다. 오류 재작업률에서는 제외됩니다.'
          : saved.type === 'ERROR_CORRECTION'
            ? '오류 수정으로 저장했습니다. 오류 재작업률의 분자에 포함됩니다.'
            : '재작업 이유를 저장했습니다. 분모에만 포함됩니다.',
      )
      await client.invalidateQueries({ queryKey: ['team', teamId, 'feedback', feedbackId] })
    },
  })
  const previewShare = useMutation({
    mutationFn: async () => {
      const version = shareVersionOverride ?? query.data?.sharing?.version ?? 0
      return { preview: await api.sharePreview(feedbackId), version }
    },
    onSuccess: (value) => {
      setPreview(value.preview)
      setPreviewShareVersion(value.version)
      setNow(Date.now())
      setShareMessage('')
    },
  })
  const approveShare = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error('공유 미리보기가 없습니다.')
      if (preview.redactionStatus !== 'PASSED' || Date.parse(preview.expiresAt) <= Date.now())
        throw new Error('미리보기가 만료됐습니다. 닫은 뒤 새 미리보기를 만들어주세요.')
      return api.approveShare(feedbackId, {
        expectedShareVersion: previewShareVersion,
        previewId: preview.previewId,
        previewVersion: preview.previewVersion,
      })
    },
    onSuccess: async (saved) => {
      setRevoked(false)
      setShareVersionOverride(saved.shareVersion)
      setPreview(null)
      setShareMessage('공유를 승인했습니다.')
      patchList({ isShared: true })
      await client.invalidateQueries({ queryKey: ['team', teamId, 'feedback', feedbackId] })
      await client.invalidateQueries({ queryKey: ['team', teamId, 'guides'] })
      await client.invalidateQueries({ queryKey: ['team', teamId, 'shared'] })
    },
  })
  const share = useMutation({
    mutationFn: () => api.revokeShare(feedbackId),
    onSuccess: async (saved) => {
      setRevoked(true)
      setShareVersionOverride(saved.shareVersion)
      setRevoke(false)
      patchList({ isShared: false })
      await client.invalidateQueries({ queryKey: ['team', teamId, 'guides'] })
      await client.invalidateQueries({ queryKey: ['team', teamId, 'shared'] })
    },
  })
  async function copy(text: string) {
    setCopyError(false)
    try {
      await navigator.clipboard.writeText(text)
      setCopyMessage('개선 프롬프트를 복사했습니다.')
    } catch {
      setCopyError(true)
      setCopyMessage('복사하지 못했습니다. 텍스트를 직접 선택해 복사해주세요.')
    }
  }
  if (query.isPending) return <Loading />
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />
  const data = query.data
  const sharedNow =
    !revoked && (data.sharing ? data.sharing.status === 'SHARED' : item?.isShared === true)
  return (
    <>
      <PageTitle title="피드백 상세" />
      <div className="row">
        <Link className="button secondary" to={`${base}/feedbacks`}>
          목록으로
        </Link>
        <span className="muted">{data.type}</span>
        {data.evidences.map((e, i) => (
          <Button
            key={`${e.conversationVersionId}-${i}`}
            variant="ghost"
            onClick={() => setOriginal(e.conversationVersionId)}
          >
            근거 대화 원문{data.evidences.length > 1 ? ` ${i + 1}` : ''}
          </Button>
        ))}
      </div>
      <div className="detail-grid">
        <Card>
          <h2>{data.title}</h2>
          <h3>문제</h3>
          <p className="pre-wrap">{data.problem}</p>
          {data.causes.length > 0 && (
            <>
              <h3>원인 후보</h3>
              {data.causes.map((c, i) => (
                <p key={i}>{c}</p>
              ))}
            </>
          )}
          {!!data.limitations?.length && (
            <>
              <h3>해석 시 유의사항</h3>
              {data.limitations.map((text, i) => (
                <p key={i}>{text}</p>
              ))}
            </>
          )}
          <h3>개선 방안</h3>
          <p className="pre-wrap">{data.improvement}</p>
        </Card>
        <Card>
          <h3>예상 절감량</h3>
          <strong className="success">미측정</strong>
          <p>검증된 절감 근거가 없습니다.</p>
          {!sharedNow && (
            <>
              <p>
                새 공유는 가려진 미리보기를 확인한 뒤에만 승인됩니다. 미리보기는 30분 동안, 한 번만
                쓸 수 있습니다.
              </p>
              <Button disabled={previewShare.isPending} onClick={() => previewShare.mutate()}>
                {previewShare.isPending ? '미리보기 만드는 중…' : '공유 미리보기'}
              </Button>
              <ErrorMessage error={previewShare.error} />
            </>
          )}
          {sharedNow && (
            <Button
              onClick={() => {
                share.reset()
                setRevoke(true)
              }}
            >
              기존 공유 철회
            </Button>
          )}
          {shareMessage && <Notice>{shareMessage}</Notice>}
          {revoked && (
            <Notice>공유를 철회했습니다. 다시 공유하려면 새 미리보기가 필요합니다.</Notice>
          )}
        </Card>
      </div>
      <div className="two-col">
        <Card>
          <h3>개선 전</h3>
          <p className="pre-wrap">{data.example.before}</p>
        </Card>
        <Card>
          <h3>개선 후</h3>
          <p className="pre-wrap">{data.example.after}</p>
          <Button onClick={() => void copy(data.example.after)}>개선 프롬프트 복사</Button>
          {copyMessage && <Notice tone={copyError ? 'error' : ''}>{copyMessage}</Notice>}
        </Card>
      </div>
      <Card>
        <h2>이 피드백이 도움이 되었나요?</h2>
        <div className="row">
          <Button
            aria-pressed={currentReaction === 'HELPFUL'}
            disabled={reaction.isPending}
            onClick={() => reaction.mutate(currentReaction === 'HELPFUL' ? null : 'HELPFUL')}
          >
            도움됨{currentReaction === 'HELPFUL' ? ' · 선택됨' : ''}
          </Button>
          <Button
            aria-pressed={currentReaction === 'NOT_APPLICABLE'}
            disabled={reaction.isPending}
            onClick={() =>
              reaction.mutate(currentReaction === 'NOT_APPLICABLE' ? null : 'NOT_APPLICABLE')
            }
          >
            해당 없음{currentReaction === 'NOT_APPLICABLE' ? ' · 선택됨' : ''}
          </Button>
        </div>
        <Field label="해당 없음 사유 · 선택">
          <textarea
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="피드백이 맞지 않는 이유를 적을 수 있습니다."
          />
        </Field>
        {reaction.isSuccess && (
          <Notice>{currentReaction ? '반응을 저장했습니다.' : '반응을 취소했습니다.'}</Notice>
        )}
        <ErrorMessage error={reaction.error} />
      </Card>
      <div className="notice">
        <h2>업무가 실제로 성공했는지 확인해주세요</h2>
        <p>
          성공률은 여기서 확인한 성공·실패만 분모로 씁니다. 모름은 저장되지만 분모에서 빠집니다.
        </p>
        {data.aiAssessment?.outcome && (
          <p className="muted">
            AI 추정은{' '}
            {outcomeLabels[data.aiAssessment.outcome as keyof typeof outcomeLabels] ??
              data.aiAssessment.outcome}
            입니다. 아래 저장값과는 따로 둡니다.
          </p>
        )}
        {outcomeAssessment ? (
          <p>
            저장된 본인 확인 {outcomeLabels[outcomeAssessment.outcome]} · 버전{' '}
            {outcomeAssessment.version}
          </p>
        ) : (
          <p>아직 본인 확인이 없습니다.</p>
        )}
        {data.itemId == null ? (
          <p>분석 항목이 없는 이전 피드백은 결과를 확인할 수 없습니다.</p>
        ) : (
          <>
            <Field label="확인 메모 · 선택">
              <textarea
                maxLength={500}
                value={outcomeNote}
                onChange={(e) => setOutcomeNote(e.target.value)}
                placeholder="본인만 볼 수 있는 메모입니다."
              />
            </Field>
            <div className="row">
              {(
                [
                  ['SUCCESS', '성공'],
                  ['FAILURE', '실패'],
                  ['UNKNOWN', '모름'],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  disabled={saveOutcome.isPending}
                  onClick={() => saveOutcome.mutate(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            {outcomeMessage && <Notice>{outcomeMessage}</Notice>}
            <ErrorMessage error={saveOutcome.error} />
          </>
        )}
        <h2>다시 요청한 이유를 골라주세요</h2>
        <p>
          오류 재작업률의 분자는 오류 수정만 셉니다. 오류 수정이 있었다면 그 이유를 우선 골라주세요.
        </p>
        {data.aiAssessment?.reworkType && (
          <p className="muted">
            AI 추정 이유는 {reworkLabel(data.aiAssessment.reworkType)}입니다. 저장값과는 따로
            둡니다.
          </p>
        )}
        {reworkAssessment ? (
          <p>
            저장된 재작업 이유 {reworkLabel(reworkAssessment.type)} · 버전{' '}
            {reworkAssessment.version}
          </p>
        ) : (
          <p>아직 재작업 이유를 확인하지 않았습니다.</p>
        )}
        {data.itemId == null ? (
          <p>분석 항목이 없는 이전 피드백은 재작업 이유를 확인할 수 없습니다.</p>
        ) : (
          <>
            <Field label="재작업 이유">
              <select
                value={selectedRework}
                onChange={(e) => setReworkType(e.target.value as (typeof reworkOptions)[number][0])}
              >
                {reworkOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="이유 메모 · 선택">
              <textarea
                maxLength={500}
                value={reworkNote}
                onChange={(e) => setReworkNote(e.target.value)}
                placeholder="본인만 볼 수 있는 메모입니다."
              />
            </Field>
            <Button disabled={saveRework.isPending} onClick={() => saveRework.mutate()}>
              재작업 이유 저장
            </Button>
            {reworkMessage && <Notice>{reworkMessage}</Notice>}
            <ErrorMessage error={saveRework.error} />
          </>
        )}
        <p>실제 사용 여부와 대화 삭제는 준비 중입니다.</p>
      </div>
      {original !== null && (
        <OriginalConversation
          id={original}
          feedbackId={feedbackId}
          onClose={() => setOriginal(null)}
        />
      )}
      {preview && (
        <Modal
          title="공유 미리보기"
          onClose={() => {
            if (!approveShare.isPending) setPreview(null)
          }}
        >
          <p>개인정보가 가려진 내용입니다. 이 내용으로 승인하면 팀에 공유됩니다.</p>
          <h3>{preview.content.title}</h3>
          <p>{preview.content.type}</p>
          <h3>문제</h3>
          <p className="pre-wrap">{preview.content.problem}</p>
          <h3>개선</h3>
          <p className="pre-wrap">{preview.content.improvement}</p>
          <h3>개선 전</h3>
          <p className="pre-wrap">{preview.content.example.before}</p>
          <h3>개선 후</h3>
          <p className="pre-wrap">{preview.content.example.after}</p>
          <p className="muted">만료 {preview.expiresAt}</p>
          {previewExpired && (
            <Notice tone="error">
              미리보기가 만료됐습니다. 닫은 뒤 새 미리보기를 만들어주세요.
            </Notice>
          )}
          <ErrorMessage error={approveShare.error} />
          <Button
            disabled={approveShare.isPending || previewExpired}
            onClick={() => approveShare.mutate()}
          >
            {approveShare.isPending ? '승인 중…' : '이 내용으로 공유'}
          </Button>
        </Modal>
      )}
      {revoke && (
        <Modal
          title="기존 공유를 철회할까요?"
          onClose={() => {
            if (!share.isPending) setRevoke(false)
          }}
        >
          <p>철회하면 공유 사례와 개선 가이드에서 제외됩니다.</p>
          <ErrorMessage error={share.error} />
          <Button variant="danger" disabled={share.isPending} onClick={() => share.mutate()}>
            {share.isPending ? '철회 중…' : '공유 철회'}
          </Button>
        </Modal>
      )}
    </>
  )
}
