import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/service'
import type { FeedbackItem, FeedbackList, Id, Reaction } from '../api/types'
import { useWorkspace } from '../components/Workspace'
import {
  Button,
  Card,
  Empty,
  ErrorMessage,
  ErrorState,
  FeaturePending,
  Field,
  formatDate,
  Loading,
  Modal,
  Notice,
  PageTitle,
  today,
} from '../components/ui'

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
    queryKey: ['team', teamId, 'conversation', id, feedbackId],
    queryFn: ({ signal }) => api.conversation(id, feedbackId, signal),
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
    [copyError, setCopyError] = useState(false)
  const currentReaction = reactionOverride === undefined ? item?.myReaction : reactionOverride
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
  const share = useMutation({
    mutationFn: () => api.revokeShare(feedbackId),
    onSuccess: async () => {
      setRevoked(true)
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
            key={`${e.conversationId}-${i}`}
            variant="ghost"
            onClick={() => setOriginal(e.conversationId)}
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
          <h3>원인 후보</h3>
          {data.causes.map((c, i) => (
            <p key={i}>{c}</p>
          ))}
          <h3>개선 방안</h3>
          <p className="pre-wrap">{data.improvement}</p>
        </Card>
        <Card>
          <h3>예상 절감량</h3>
          <strong className="success">미측정</strong>
          <p>검증된 절감 근거가 없습니다.</p>
          <FeaturePending title="공유본 미리보기">
            공유본을 확인하고 승인하는 기능은 준비 중입니다. 새 공유 승인은 아직 지원하지 않습니다.
          </FeaturePending>
          {!revoked && item?.isShared !== false && (
            <Button
              onClick={() => {
                share.reset()
                setRevoke(true)
              }}
            >
              기존 공유 철회
            </Button>
          )}
          {revoked && <Notice>공유를 철회했습니다.</Notice>}
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
        <h2>AI 추정과 실제 결과를 구분해주세요</h2>
        <p>업무 결과·재작업 유형·실제 사용 여부 확인과 대화 삭제는 준비 중입니다.</p>
        <div className="row">
          {['업무 결과 확인', '재작업 유형 확인', '실제로 사용했어요', '대화 삭제'].map((label) => (
            <Button key={label} disabled title="기능 준비 중">
              {label}
            </Button>
          ))}
        </div>
      </div>
      {original !== null && (
        <OriginalConversation
          id={original}
          feedbackId={feedbackId}
          onClose={() => setOriginal(null)}
        />
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
