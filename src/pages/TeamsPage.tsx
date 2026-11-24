import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/service'
import { Topbar, teamPath } from '../components/Workspace'
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

export function TeamsPage() {
  const navigate = useNavigate(),
    client = useQueryClient()
  const query = useQuery({ queryKey: ['teams'], queryFn: ({ signal }) => api.teams(signal) })
  const [open, setOpen] = useState(false),
    [name, setName] = useState(''),
    [description, setDescription] = useState('')
  const create = useMutation({
    mutationFn: () => api.createTeam(name.trim(), description.trim()),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['teams'] })
      setOpen(false)
      setName('')
      setDescription('')
    },
  })
  function submit(e: FormEvent) {
    e.preventDefault()
    create.mutate()
  }
  return (
    <>
      <Topbar />
      <main className="teams-page">
        <PageTitle
          title="내 팀 목록"
          description="한 계정으로 여러 팀에 참여하며, 선택한 팀에서 역할이 정해집니다."
        />
        <Notice>역할은 팀마다 정해집니다. 새 팀을 만들면 해당 팀의 팀장이 됩니다.</Notice>
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ) : !query.data.length ? (
          <Empty title="아직 참여한 팀이 없습니다">
            새 팀을 만들거나 가입한 이메일을 팀장에게 전달해주세요.
          </Empty>
        ) : (
          <div className="team-grid">
            {query.data.map((team) => (
              <Card key={team.teamId}>
                <h2>{team.name}</h2>
                {team.description && <p>{team.description}</p>}
                <p>
                  내 역할: {team.myRole === 'LEADER' ? '팀장 LEADER' : '팀원 MEMBER'}
                  {team.memberCount != null && ` · ${team.memberCount}명`}
                </p>
                <Button
                  variant="primary"
                  onClick={async () => {
                    await client.cancelQueries()
                    client.removeQueries({ predicate: (q) => q.queryKey[0] === 'team' })
                    navigate(`${teamPath(team)}/dashboard`)
                  }}
                >
                  이 팀 선택 · {team.myRole === 'LEADER' ? '팀장' : '팀원'}
                </Button>
              </Card>
            ))}
          </div>
        )}
        <Card>
          <p>팀에 추가되지 않았다면 가입한 이메일을 팀장에게 전달하세요.</p>
        </Card>
        <Button
          onClick={() => {
            create.reset()
            setOpen(true)
          }}
        >
          새 팀 만들기
        </Button>
        {open && (
          <Modal
            title="새 팀 만들기"
            onClose={() => {
              if (!create.isPending) setOpen(false)
            }}
          >
            <form onSubmit={submit}>
              <Field label="팀 이름">
                <input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="팀 설명 · 선택">
                <textarea
                  maxLength={500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
              <ErrorMessage error={create.error} />
              <Button type="submit" variant="primary" disabled={create.isPending || !name.trim()}>
                {create.isPending ? '만드는 중…' : '팀 만들기'}
              </Button>
            </form>
          </Modal>
        )}
      </main>
    </>
  )
}
