import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { api } from '../api/service'
import { Button, ErrorMessage, Field, Loading, Notice } from '../components/ui'

export function AuthPage({ signup = false }: { signup?: boolean }) {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [checkedEmail, setCheckedEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  if (loading) return <Loading />
  if (user) return <Navigate to="/teams" replace />
  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage('')
    if (signup && password !== confirmation) {
      setError(new Error('비밀번호가 일치하지 않습니다.'))
      return
    }
    if (signup && checkedEmail !== email.trim().toLowerCase()) {
      setError(new Error('현재 이메일의 중복 확인을 진행해주세요.'))
      return
    }
    setBusy(true)
    try {
      if (signup) {
        await api.signup(name.trim(), email.trim(), password)
        navigate('/login?joined=1')
      } else {
        await login(email, password)
        navigate('/teams', { replace: true })
      }
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  async function checkEmail() {
    setBusy(true)
    setError(null)
    setMessage('')
    try {
      const data = await api.emailCheck(email.trim())
      setCheckedEmail(data.available ? email.trim().toLowerCase() : '')
      setMessage(data.available ? '사용할 수 있는 이메일입니다.' : '이미 가입된 이메일입니다.')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-brand">
        <strong>AI 업무 온보딩</strong>
        <h1>
          더 나은 AI 활용을
          <br />
          실제 대화에서 시작하세요.
        </h1>
        <p>
          내 대화에서 개선점을 찾고,
          <br />
          팀의 학습으로 연결합니다.
        </p>
        <small>개인 원문은 본인만 · 사례 공유는 내가 결정</small>
      </aside>
      <main className="auth-main">
        <form onSubmit={submit} className="auth-form">
          <h2>{signup ? '회원가입' : '로그인'}</h2>
          <p>
            {signup ? '개인 계정을 만들고 팀에 참여하세요.' : '이메일로 업무 공간에 접속하세요.'}
          </p>
          {!signup && new URLSearchParams(location.search).has('joined') && (
            <Notice>가입이 완료됐습니다. 로그인해주세요.</Notice>
          )}
          {signup && (
            <Field label="이름">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={50}
                autoComplete="name"
              />
            </Field>
          )}
          <Field label="이메일">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setCheckedEmail('')
                setMessage('')
              }}
              required
              maxLength={255}
              autoComplete="email"
            />
          </Field>
          {signup && (
            <Button
              disabled={busy || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
              onClick={checkEmail}
            >
              이메일 중복 확인
            </Button>
          )}
          {message && <Notice>{message}</Notice>}
          <Field
            label="비밀번호"
            hint={signup ? '영문·숫자를 포함해 8~128자로 입력해주세요.' : undefined}
          >
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={signup ? 8 : undefined}
              maxLength={128}
              pattern={signup ? '(?=.*[A-Za-z])(?=.*[0-9]).{8,128}' : undefined}
              autoComplete={signup ? 'new-password' : 'current-password'}
            />
          </Field>
          {signup && (
            <Field label="비밀번호 확인">
              <input
                type="password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                required
                maxLength={128}
                autoComplete="new-password"
              />
            </Field>
          )}
          <ErrorMessage error={error} />
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? '처리 중…' : signup ? '가입하기' : '로그인'}
          </Button>
          <Link className="button ghost" to={signup ? '/login' : '/signup'}>
            {signup ? '로그인으로' : '회원가입'}
          </Link>
          <small>
            로그인 후 내 팀 목록에서 팀을 선택합니다.
            <br />
            선택한 팀에서의 역할이 적용됩니다.
          </small>
        </form>
      </main>
    </div>
  )
}
