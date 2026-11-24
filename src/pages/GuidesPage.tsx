import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/service'
import type { Example, SharedCase } from '../api/types'
import { useWorkspace } from '../components/Workspace'
import {
  Button,
  Card,
  Empty,
  ErrorMessage,
  ErrorState,
  Field,
  Loading,
  Modal,
  Notice,
  PageTitle,
} from '../components/ui'
import { feedbackTypes } from './FeedbackPage'

function Examples({ example }: { example: Example }) {
  return (
    <div className="two-col">
      <div className="example">
        <h3>개선 전</h3>
        <p className="pre-wrap">{example.before}</p>
      </div>
      <div className="example">
        <h3>개선 후</h3>
        <p className="pre-wrap">{example.after}</p>
      </div>
    </div>
  )
}
function CopyButton({ text }: { text: string }) {
  const [message, setMessage] = useState('')
  return (
    <>
      <Button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text)
            setMessage('프롬프트를 복사했습니다.')
          } catch {
            setMessage('복사하지 못했습니다. 텍스트를 직접 선택해 복사해주세요.')
          }
        }}
      >
        가이드 프롬프트 복사
      </Button>
      {message && <Notice>{message}</Notice>}
    </>
  )
}

export function GuidesPage() {
  const { teamId, base } = useWorkspace(),
    [type, setType] = useState('')
  const query = useQuery({
    queryKey: ['team', teamId, 'guides', type],
    queryFn: ({ signal }) => api.guides(teamId, type, signal),
  })
  return (
    <>
      <PageTitle title="팀 개선 가이드" />
      <Notice>
        팀장이 지정한 공유 사례를 다음 업무에 활용하세요. 개인 원문은 포함되지 않습니다.
      </Notice>
      <Field label="피드백 유형">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {feedbackTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.groups.some((g) => g.guides.length) ? (
        <Empty title="등록된 개선 가이드가 없습니다">
          팀장이 공유 사례를 가이드로 지정하면 이곳에서 볼 수 있습니다.
        </Empty>
      ) : (
        query.data.groups.map((g) => (
          <section className="stack" key={g.type}>
            <span className="type-label">{g.type}</span>
            {g.guides.map((guide) => (
              <Card key={guide.feedbackId}>
                <h2>{guide.title}</h2>
                <p>{guide.problem}</p>
                <h3>개선 방법</h3>
                <p>{guide.improvement}</p>
                <Examples example={guide.example} />
                <CopyButton text={guide.example.after} />
              </Card>
            ))}
          </section>
        ))
      )}
      <Link className="button primary" to={`${base}/upload`}>
        내 대화 업로드
      </Link>
    </>
  )
}

export function SharedCasesPage() {
  const { teamId, leader, base } = useWorkspace(),
    client = useQueryClient(),
    [type, setType] = useState(''),
    [selected, setSelected] = useState<SharedCase | null>(null)
  const query = useQuery({
    queryKey: ['team', teamId, 'shared', type],
    queryFn: ({ signal }) => api.sharedCases(teamId, type, signal),
    enabled: leader,
  })
  const mutation = useMutation({
    mutationFn: (item: SharedCase) => api.guide(item.feedbackId, !item.isGuide),
    onSuccess: async () => {
      setSelected(null)
      await client.invalidateQueries({ queryKey: ['team', teamId, 'shared'] })
      await client.invalidateQueries({ queryKey: ['team', teamId, 'guides'] })
    },
  })
  if (!leader)
    return <ErrorState error={new Error('공유 사례 관리는 팀장만 이용할 수 있습니다.')} />
  return (
    <>
      <PageTitle
        title="공유 사례 · 가이드 관리"
        description="직원이 공유를 허용한 사례를 확인하고 팀 개선 가이드를 관리합니다."
      />
      <Notice>
        작성자 이름과 개인 원문은 제공하지 않습니다. 가이드 지정 전 공유 내용에 식별 정보가 없는지
        확인해주세요.
      </Notice>
      <Field label="피드백 유형">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {feedbackTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.items.length ? (
        <Empty title="공유된 사례가 없습니다">직원이 공유를 허용한 사례만 표시됩니다.</Empty>
      ) : (
        query.data.items.map((item) => (
          <Card key={item.feedbackId}>
            <div className="row spread">
              <h2>{item.title}</h2>
              <Button
                variant={item.isGuide ? 'secondary' : 'primary'}
                onClick={() => {
                  mutation.reset()
                  setSelected(item)
                }}
              >
                {item.isGuide ? '가이드 지정 해제' : '개선 가이드로 지정'}
              </Button>
            </div>
            <small>
              {item.taskType} · {item.type}
            </small>
            <p>관찰 · {item.problem}</p>
            <p>개선 방안 · {item.improvement}</p>
            <Examples example={item.example} />
            <small>공유 철회 시 사례와 가이드에서 제외됩니다.</small>
          </Card>
        ))
      )}
      <Link className="button secondary" to={`${base}/guides`}>
        팀 개선 가이드 보기
      </Link>
      {selected && (
        <Modal
          title={selected.isGuide ? '가이드 지정을 해제할까요?' : '개선 가이드로 지정할까요?'}
          onClose={() => {
            if (!mutation.isPending) setSelected(null)
          }}
        >
          <p>{selected.title}</p>
          <p>
            {selected.isGuide
              ? '공유 사례는 유지되며 가이드에서만 제외됩니다.'
              : '팀원 전체가 열람할 수 있습니다. 공유 내용에 개인·기밀 정보가 없는지 확인해주세요.'}
          </p>
          <ErrorMessage error={mutation.error} />
          <Button
            variant="primary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(selected)}
          >
            {mutation.isPending ? '처리 중…' : selected.isGuide ? '지정 해제' : '가이드로 지정'}
          </Button>
        </Modal>
      )}
    </>
  )
}
