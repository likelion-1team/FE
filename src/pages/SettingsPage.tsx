import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/service'
import type { Settings, SettingsInput } from '../api/types'
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
} from '../components/ui'

function EditSettings({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const { teamId } = useWorkspace(),
    client = useQueryClient()
  const [name, setName] = useState(settings.taskTypes[0]?.name || '')
  const [success, setSuccess] = useState(settings.taskTypes[0]?.successDefinition || '')
  const [from, setFrom] = useState(settings.targetFrom || ''),
    [to, setTo] = useState(settings.targetTo || ''),
    [onboarding, setOnboarding] = useState(settings.onboardingStartDate || ''),
    [count, setCount] = useState(settings.targetCount?.toString() || '')
  const [validation, setValidation] = useState('')
  const mutation = useMutation({
    mutationFn: (input: SettingsInput) => api.saveSettings(teamId, input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['team', teamId] })
      onClose()
    },
  })
  function submit(e: FormEvent) {
    e.preventDefault()
    if (from > to || onboarding < from || onboarding > to) {
      setValidation('기간과 온보딩 시작일을 확인해주세요. 시작일은 대상 기간 안이어야 합니다.')
      return
    }
    if (
      count &&
      (!Number.isSafeInteger(Number(count)) || Number(count) < 1 || Number(count) > 2147483647)
    ) {
      setValidation('대상 건수는 1~2,147,483,647 사이의 정수로 입력해주세요.')
      return
    }
    setValidation('')
    mutation.mutate({
      taskTypes: [{ name: name.trim(), successDefinition: success.trim() }],
      targetFrom: from,
      targetTo: to,
      onboardingStartDate: onboarding,
      targetCount: count ? Number(count) : null,
    })
  }
  return (
    <Modal
      title="분석 대상 수정"
      onClose={() => {
        if (!mutation.isPending) onClose()
      }}
    >
      <form onSubmit={submit}>
        <Field label="업무 유형 · 1개">
          <input required maxLength={50} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="업무 성공 정의">
          <textarea
            required
            maxLength={500}
            value={success}
            onChange={(e) => setSuccess(e.target.value)}
          />
        </Field>
        <div className="two-col">
          <Field label="대상 시작일">
            <input type="date" required value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="대상 종료일">
            <input
              type="date"
              min={from}
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
        </div>
        <Field label="온보딩 시작일">
          <input
            type="date"
            min={from}
            max={to}
            required
            value={onboarding}
            onChange={(e) => setOnboarding(e.target.value)}
          />
        </Field>
        <Field label="예상 대상 건수 · 선택">
          <input
            type="number"
            min="1"
            max="2147483647"
            step="1"
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </Field>
        {validation && <Notice tone="error">{validation}</Notice>}
        <ErrorMessage error={mutation.error} />
        <Button
          type="submit"
          variant="primary"
          disabled={mutation.isPending || !name.trim() || !success.trim()}
        >
          {mutation.isPending ? '저장 중…' : '설정 저장'}
        </Button>
      </form>
    </Modal>
  )
}

export function SettingsPage() {
  const { teamId, leader } = useWorkspace(),
    client = useQueryClient()
  const settings = useQuery({
    queryKey: ['team', teamId, 'settings'],
    queryFn: ({ signal }) => api.settings(teamId, signal),
  })
  const members = useQuery({
    queryKey: ['team', teamId, 'members'],
    queryFn: ({ signal }) => api.members(teamId, signal),
    enabled: leader,
  })
  const [edit, setEdit] = useState(false),
    [add, setAdd] = useState(false),
    [email, setEmail] = useState('')
  const addMember = useMutation({
    mutationFn: () => api.addMember(teamId, email.trim()),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['team', teamId, 'members'] })
      await client.invalidateQueries({ queryKey: ['teams'] })
      setAdd(false)
      setEmail('')
    },
  })
  return (
    <>
      <PageTitle
        title={leader ? '팀 설정 · 분석 기준' : '분석 대상 · 기준'}
        description={
          leader
            ? '팀의 업무와 분석 기간을 설정하고 팀원을 관리합니다.'
            : '팀장이 설정한 업무와 분석 기준을 확인합니다. 수정은 팀장만 할 수 있습니다.'
        }
      />
      {settings.isPending ? (
        <Loading />
      ) : settings.isError ? (
        <ErrorState error={settings.error} retry={() => void settings.refetch()} />
      ) : (
        <>
          <div className="two-col">
            <Card>
              <h2>분석할 업무와 기간</h2>
              {settings.data.taskTypes.length ? (
                settings.data.taskTypes.map((t, i) => (
                  <div key={i}>
                    <Field label="허용 업무 유형 · MVP 1개">
                      <input readOnly value={t.name} />
                    </Field>
                    <Field label="업무 성공 정의">
                      <textarea readOnly value={t.successDefinition} />
                    </Field>
                  </div>
                ))
              ) : (
                <p>분석 기준이 아직 설정되지 않았습니다.</p>
              )}
              <div className="two-col">
                <Field label="대상 기간">
                  <input
                    readOnly
                    value={`${formatDate(settings.data.targetFrom)} – ${formatDate(settings.data.targetTo)}`}
                  />
                </Field>
                <Field label="온보딩 시작일">
                  <input readOnly value={formatDate(settings.data.onboardingStartDate)} />
                </Field>
              </div>
              <p>예상 대상 건수 {settings.data.targetCount ?? '미설정'}</p>
              {leader && (
                <Button variant="primary" onClick={() => setEdit(true)}>
                  분석 대상 수정
                </Button>
              )}
            </Card>
            <Card>
              <h2>평가 기준 · 조회 전용</h2>
              <p>현재 서버에 저장된 업무 성공 정의로 분석합니다.</p>
              <p>측정되지 않은 지표는 미측정으로 표시합니다.</p>
              <FeaturePending title="결과 확인 기준 확장">
                성공·실패·판정 불가 조건과 실제 업무 결과 확인은 준비 중입니다.
              </FeaturePending>
            </Card>
          </div>
          {edit && leader && (
            <EditSettings settings={settings.data} onClose={() => setEdit(false)} />
          )}
        </>
      )}
      {leader && (
        <Card>
          <div className="row">
            <h2>팀원{members.data && ` · ${members.data.length}명`}</h2>
            <Button
              onClick={() => {
                addMember.reset()
                setAdd(true)
              }}
            >
              이메일로 팀원 추가
            </Button>
          </div>
          {members.isPending ? (
            <Loading />
          ) : members.isError ? (
            <ErrorState error={members.error} retry={() => void members.refetch()} />
          ) : members.data.length ? (
            <div className="list">
              {members.data.map((m) => (
                <div className="list-row" key={m.userId}>
                  <strong>
                    {m.name} · {m.email}
                  </strong>
                  <span>
                    {m.role === 'LEADER' ? '팀장' : '팀원'} · {m.submitted ? '제출 완료' : '미제출'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="등록된 팀원이 없습니다" />
          )}
          <small>
            이름·이메일·역할·제출 여부만 제공합니다. 개인별 지표·원문은 표시하지 않습니다.
          </small>
        </Card>
      )}
      {add && leader && (
        <Modal
          title="이메일로 팀원 추가"
          onClose={() => {
            if (!addMember.isPending) setAdd(false)
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              addMember.mutate()
            }}
          >
            <Field label="가입된 이메일">
              <input
                type="email"
                required
                maxLength={255}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <p className="muted">가입된 계정만 팀원으로 추가할 수 있습니다.</p>
            <ErrorMessage error={addMember.error} />
            <Button type="submit" variant="primary" disabled={addMember.isPending}>
              {addMember.isPending ? '추가 중…' : '팀원 추가'}
            </Button>
          </form>
        </Modal>
      )}
    </>
  )
}
