import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'
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
  const [name, setName] = useState(settings.taskType?.name || '')
  const [success, setSuccess] = useState(settings.taskType?.successConditions.join('\n') || '')
  const [failure, setFailure] = useState(settings.taskType?.failureConditions.join('\n') || '')
  const [unknown, setUnknown] = useState(settings.taskType?.unknownConditions.join('\n') || '')
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
    if (from > to || (onboarding && (onboarding < from || onboarding > to))) {
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
    const conditions = [success, failure, unknown].map((value) =>
      value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    )
    if (
      conditions.some(
        (lines) => lines.length < 1 || lines.length > 10 || lines.some((line) => line.length > 500),
      )
    ) {
      setValidation('성공·실패·판정 불가 조건을 각각 1~10줄, 줄당 500자 이하로 입력해주세요.')
      return
    }
    setValidation('')
    mutation.mutate({
      expectedVersion: settings.version,
      taskType: {
        name: name.trim(),
        successConditions: conditions[0],
        failureConditions: conditions[1],
        unknownConditions: conditions[2],
      },
      targetFrom: from,
      targetTo: to,
      onboardingStartDate: onboarding || null,
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
          <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="성공 조건 · 줄마다 1개">
          <textarea
            required
            maxLength={5010}
            value={success}
            onChange={(e) => setSuccess(e.target.value)}
          />
        </Field>
        <Field label="실패 조건 · 줄마다 1개">
          <textarea
            required
            maxLength={5010}
            value={failure}
            onChange={(e) => setFailure(e.target.value)}
          />
        </Field>
        <Field label="판정 불가 조건 · 줄마다 1개">
          <textarea
            required
            maxLength={5010}
            value={unknown}
            onChange={(e) => setUnknown(e.target.value)}
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
        <Field label="온보딩 시작일 · 선택">
          <input
            type="date"
            min={from}
            max={to}
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
        {mutation.error instanceof ApiError && mutation.error.status === 409 && (
          <Notice tone="error">
            다른 변경이 먼저 저장됐습니다. 입력을 확인한 뒤 닫고 최신 기준을 다시 불러와주세요.
            <Button
              onClick={() => {
                void client.invalidateQueries({ queryKey: ['team', teamId, 'settings'] })
                onClose()
              }}
            >
              최신 기준 불러오기
            </Button>
          </Notice>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={
            mutation.isPending ||
            (mutation.error instanceof ApiError && mutation.error.status === 409) ||
            !name.trim() ||
            !success.trim() ||
            !failure.trim() ||
            !unknown.trim()
          }
        >
          {mutation.isPending ? '저장 중…' : '설정 저장'}
        </Button>
      </form>
    </Modal>
  )
}

export function SettingsPage() {
  const { teamId, leader, team } = useWorkspace(),
    client = useQueryClient()
  const settings = useQuery({
    queryKey: ['team', teamId, 'settings'],
    queryFn: ({ signal }) => api.settings(teamId, signal),
  })
  const canEdit = leader && team.capabilities?.canEditSettings === true
  const canManageMembers = leader && team.capabilities?.canManageMembers === true
  const members = useQuery({
    queryKey: ['team', teamId, 'members'],
    queryFn: ({ signal }) => api.members(teamId, signal),
    enabled: canManageMembers,
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
              {settings.data.taskType ? (
                <>
                  <Field label="허용 업무 유형 · MVP 1개">
                    <input readOnly value={settings.data.taskType.name} />
                  </Field>
                  {(
                    [
                      ['성공 조건', settings.data.taskType.successConditions],
                      ['실패 조건', settings.data.taskType.failureConditions],
                      ['판정 불가 조건', settings.data.taskType.unknownConditions],
                    ] as const
                  ).map(([label, lines]) => (
                    <Field key={label} label={label}>
                      <textarea readOnly value={lines.join('\n')} />
                    </Field>
                  ))}
                </>
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
              {canEdit && (
                <Button variant="primary" onClick={() => setEdit(true)}>
                  분석 대상 수정
                </Button>
              )}
            </Card>
            <Card>
              <h2>평가 기준 · 조회 전용</h2>
              <p>현재 서버에 저장된 성공·실패·판정 불가 조건으로 분석합니다.</p>
              <p>측정되지 않은 지표는 미측정으로 표시합니다.</p>
              <p>
                기준 버전 {settings.data.version} · 한 번에 최대{' '}
                {settings.data.policies.maxSelectionsPerRequest}건 선택
              </p>
              <p>업로드 선택 가능 시간 {settings.data.policies.uploadRetentionMinutes}분</p>
              <FeaturePending title="실제 업무 결과 확인 화면">
                서버 API가 추가됐으며 화면 연결은 후속 작업입니다.
              </FeaturePending>
            </Card>
          </div>
          {edit && canEdit && (
            <EditSettings settings={settings.data} onClose={() => setEdit(false)} />
          )}
        </>
      )}
      {canManageMembers && (
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
      {add && canManageMembers && (
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
