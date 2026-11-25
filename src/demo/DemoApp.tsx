import { useEffect, useRef, useState } from 'react'
import { Button, Card, Field, Modal, Notice } from '../components/ui'
import { cases, completedIds, demoFile, teamSample, type DemoCaseId, type Scenario } from './data'
import './demo.css'

type Screen = 'upload' | 'analysis' | 'feedback' | 'team' | 'guides'
const screens: [Screen, string][] = [
  ['upload', '1. 대화 업로드'],
  ['analysis', '2. 분석 진행'],
  ['feedback', '3. 내 피드백'],
  ['team', '4. 팀 성과'],
  ['guides', '5. 개선 가이드'],
]

export default function DemoApp() {
  const [screen, setScreen] = useState<Screen>('upload')
  const [role, setRole] = useState('member')
  const [loaded, setLoaded] = useState(false)
  const [selected, setSelected] = useState<DemoCaseId[]>([])
  const [scenario, setScenario] = useState<Scenario>('success')
  const [run, setRun] = useState<{ ids: DemoCaseId[]; scenario: Scenario } | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<DemoCaseId | null>(null)
  const [original, setOriginal] = useState(false)
  const [reactions, setReactions] = useState<Record<string, string>>({})
  const [guide, setGuide] = useState(true)
  const [guideMessage, setGuideMessage] = useState('')
  const [privacy, setPrivacy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const reading = useRef(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const running = !!run && progress < 100
  const successful = run && progress === 100 ? completedIds(run.ids, run.scenario) : []
  const current = cases.find((item) => item.id === detail)

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [screen])

  useEffect(() => {
    if (!run || progress >= 100) return
    const timer = window.setTimeout(() => setProgress((value) => Math.min(100, value + 20)), 500)
    return () => window.clearTimeout(timer)
  }, [run, progress])
  useEffect(
    () => () => {
      reading.current++
    },
    [],
  )

  function reset() {
    reading.current++
    setLoaded(false)
    setSelected([])
    setRun(null)
    setProgress(0)
    setError('')
    setReactions({})
    setDetail(null)
    setOriginal(false)
    setGuide(true)
    setGuideMessage('')
    setPrivacy(false)
    setRole('member')
    setScenario('success')
    setScreen('upload')
    if (fileInput.current) fileInput.current.value = ''
  }
  async function readFile(file?: File) {
    if (!file) return
    const generation = ++reading.current
    setError('')
    setLoaded(false)
    setSelected([])
    try {
      if (file.size > 10000) throw new Error('다운로드한 작은 데모 JSON 파일만 사용해주세요.')
      const parsed: unknown = JSON.parse(await file.text())
      if (generation !== reading.current) return
      if (JSON.stringify(parsed) !== JSON.stringify(demoFile))
        throw new Error('이 화면은 제공된 데모 파일만 읽습니다. 실제 대화 파일은 사용하지 마세요.')
      setLoaded(true)
    } catch (cause) {
      if (generation === reading.current)
        setError(
          cause instanceof SyntaxError
            ? 'JSON 형식을 확인해주세요. 제공된 데모 파일을 이용하세요.'
            : cause instanceof Error
              ? cause.message
              : '파일을 읽지 못했습니다.',
        )
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(demoFile, null, 2)], { type: 'application/json' }),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'toki-demo-conversations.json'
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="demo-app">
      <a className="skip-link" href="#main">
        본문으로 이동
      </a>
      <header className="demo-header">
        <strong>
          AI 업무 온보딩 <span className="demo-badge">DEMO</span>
        </strong>
        <div className="demo-actions">
          <label>
            시연 역할{' '}
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="member">팀원</option>
              <option value="leader">팀장</option>
            </select>
          </label>
          <Button onClick={reset}>데모 초기화</Button>
          <a href="/login">실제 서비스 로그인</a>
        </div>
      </header>
      <div className="demo-banner" role="note">
        합성 데이터 전용 데모 · 서버 요청·운영 데이터 저장 없음 · 새로고침하면 초기화됩니다.
      </div>
      <div className="demo-layout">
        <nav className="demo-nav" aria-label="데모 메뉴">
          {screens.map(([id, name]) => (
            <Button
              key={id}
              variant={screen === id ? 'primary' : 'ghost'}
              aria-current={screen === id ? 'page' : undefined}
              onClick={() => {
                setDetail(null)
                setScreen(id)
              }}
            >
              {name}
            </Button>
          ))}
        </nav>
        <main id="main" className="demo-main">
          <h1 ref={heading} tabIndex={-1}>
            {screens.find(([id]) => screen === id)?.[1].slice(3)}
          </h1>
          {screen === 'upload' && (
            <>
              <Card>
                <h2>시연용 분석 기준 · 버전 1</h2>
                <p>업무: 영업 제안 이메일 · 대상 기간: 2026.11.01–11.30</p>
                <p>성공 조건: 고객·가격·체험 조건을 유지하고 제목과 본문을 제공합니다.</p>
                <small>대화만으로 실제 발송 결과는 확정하지 않습니다.</small>
              </Card>
              <Card>
                <h2>합성 파일 준비</h2>
                <p>
                  가상 대화 3건을 제공합니다. 데모 JSON은 합성 대화를 선택하는 표식만 포함하며 실제
                  대화 파일을 받지 않습니다.
                </p>
                <div className="demo-actions">
                  <Button onClick={download}>데모 파일 다운로드</Button>
                  <Button
                    onClick={() => {
                      reading.current++
                      setLoaded(true)
                      setSelected([])
                      setError('')
                    }}
                    disabled={running}
                  >
                    내장 합성 파일 불러오기
                  </Button>
                </div>
                <Field label="데모 JSON 파일 선택">
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".json,application/json"
                    disabled={running}
                    onChange={(event) => void readFile(event.target.files?.[0])}
                  />
                </Field>
                {error && <Notice tone="error">{error}</Notice>}
                {loaded && (
                  <>
                    <h3>분석할 합성 대화 선택</h3>
                    {cases.map((item) => (
                      <label className="demo-candidate" key={item.id}>
                        <input
                          type="checkbox"
                          checked={selected.includes(item.id)}
                          disabled={running}
                          onChange={(event) =>
                            setSelected(
                              event.target.checked
                                ? [...selected, item.id]
                                : selected.filter((id) => id !== item.id),
                            )
                          }
                        />
                        {item.title}
                        <small>{item.type} · 합성 대화</small>
                      </label>
                    ))}
                  </>
                )}
                <Field label="분석 시나리오">
                  <select
                    value={scenario}
                    disabled={running}
                    onChange={(event) => setScenario(event.target.value as Scenario)}
                  >
                    <option value="success">모두 성공</option>
                    <option value="partial">부분 성공 (2건 이상 선택)</option>
                    <option value="failure">서버 모델 설정 실패</option>
                  </select>
                </Field>
                <Button
                  variant="primary"
                  disabled={
                    !loaded ||
                    !selected.length ||
                    running ||
                    (scenario === 'partial' && selected.length < 2)
                  }
                  onClick={() => {
                    setRun({ ids: [...selected], scenario })
                    setProgress(0)
                    setDetail(null)
                    setScreen('analysis')
                  }}
                >
                  {selected.length}건 분석 시작
                </Button>
              </Card>
            </>
          )}
          {screen === 'analysis' && (
            <Card>
              {!run ? (
                <>
                  <h2>아직 분석을 시작하지 않았습니다</h2>
                  <Button onClick={() => setScreen('upload')}>합성 대화 선택하기</Button>
                </>
              ) : (
                <>
                  <h2>
                    {running
                      ? '합성 대화 분석 중'
                      : run.scenario === 'failure'
                        ? '분석 실패'
                        : run.scenario === 'partial'
                          ? '일부 분석 완료'
                          : '분석 완료'}
                  </h2>
                  <progress max={100} value={progress} aria-label="데모 분석 진행률" />
                  <p role="status">
                    {progress}% · 선택 {run.ids.length}건
                    {!running &&
                      ` · 성공 ${successful.length}건 · 실패 ${run.ids.length - successful.length}건`}
                  </p>
                  {running ? (
                    <p>
                      {progress < 60
                        ? '선택한 대화를 평가하고 있습니다.'
                        : '개선 피드백을 생성하고 있습니다.'}
                    </p>
                  ) : (
                    <>
                      {run.ids.map((id) => (
                        <div className="demo-result" key={id}>
                          <strong>{cases.find((item) => item.id === id)?.title}</strong>
                          <p>
                            {successful.includes(id)
                              ? '분석 완료 · 피드백 1건'
                              : run.scenario === 'failure'
                                ? '서버의 AI 분석 설정이 필요합니다. 관리자에게 문의해주세요. (MODEL_NOT_CONFIGURED · 시뮬레이션)'
                                : '응답 시간이 초과됐습니다. (MODEL_TIMEOUT · 시뮬레이션)'}
                          </p>
                        </div>
                      ))}
                      {!!successful.length && (
                        <Button variant="primary" onClick={() => setScreen('feedback')}>
                          생성된 피드백 보기
                        </Button>
                      )}
                      <Button onClick={() => setScreen('upload')}>다른 시나리오 시도</Button>
                      <small>
                        LLM을 호출하지 않는 시뮬레이션입니다. 분석 완료는 실제 업무 성공을 의미하지
                        않습니다.
                      </small>
                    </>
                  )}
                </>
              )}
            </Card>
          )}
          {screen === 'feedback' && (
            <>
              <p>
                시연 팀원 본인의 합성 대화만 표시합니다. 팀장 역할로 전환해도 같은 시연 계정의 개인
                화면입니다.
              </p>
              {!successful.length && (
                <Card>
                  <p>생성된 피드백이 없습니다. 업로드에서 분석을 완료해주세요.</p>
                  <Button onClick={() => setScreen('upload')}>대화 업로드</Button>
                </Card>
              )}
              {cases
                .filter((item) => successful.includes(item.id))
                .map((item) => (
                  <Card key={item.id}>
                    <h2>{item.type}</h2>
                    <p>{item.title}</p>
                    <p>{item.problem}</p>
                    <Button
                      onClick={() => {
                        setDetail(item.id)
                        setOriginal(false)
                      }}
                    >
                      피드백 상세 보기 · {item.type}
                    </Button>
                  </Card>
                ))}
            </>
          )}
          {screen === 'team' && (
            <>
              <Notice>
                별도로 준비한 과거 합성 집계입니다. 방금 실행한 분석 결과나 실제 팀의 성과가
                아닙니다.
              </Notice>
              <label className="demo-candidate">
                <input
                  type="checkbox"
                  checked={privacy}
                  onChange={(event) => setPrivacy(event.target.checked)}
                />
                기여자 4명인 비공개 상태 보기
              </label>
              <Card>
                <h2>완료된 주간 · 2026.11.16–11.22</h2>
                <p>
                  {privacy
                    ? '기여 인원 공개 기준 미충족'
                    : `기여자 ${teamSample.contributors}명 · 본인 확인 ${teamSample.confirmed}건 · 성공 ${teamSample.successes}건 · 오류 수정 재작업 ${teamSample.rework}건`}
                </p>
                <small>
                  비율 지표는 본인 확인 건수를 분모로 합니다. 표본 20건·기여자 5명 미만인 경우
                  수치를 공개하지 않는 합성 예시입니다.
                </small>
              </Card>
              <div className="demo-metrics">
                {[
                  [
                    '성공 업무당 토큰',
                    `${(teamSample.tokens / teamSample.successes).toLocaleString()} 토큰`,
                  ],
                  ['본인 확인 성공률', `${(teamSample.successes / teamSample.confirmed) * 100}%`],
                  ['오류 수정 재작업률', `${(teamSample.rework / teamSample.confirmed) * 100}%`],
                ].map(([label, value]) => (
                  <Card key={label}>
                    <h2>{label}</h2>
                    <p className="demo-value">{privacy ? '비공개' : value}</p>
                  </Card>
                ))}
              </div>
              <Card>
                <h2>성공 업무당 토큰 추이 · 합성 예시</h2>
                {privacy ? (
                  <p>기여 인원·공개 정책에 따라 수치를 숨깁니다.</p>
                ) : (
                  teamSample.weeks.map((week) => (
                    <div className="demo-trend" key={week.label}>
                      <span>{week.label}</span>
                      <meter
                        min={0}
                        max={3000}
                        value={week.value}
                        aria-label={`${week.label} 토큰`}
                      />
                      <span>{week.value.toLocaleString()} 토큰</span>
                    </div>
                  ))
                )}
              </Card>
            </>
          )}
          {screen === 'guides' && (
            <>
              <Notice>
                공유 승인을 마친 별도 합성 사례입니다. 개인 피드백을 자동으로 공개하지 않습니다.
              </Notice>
              {role === 'leader' && (
                <Card>
                  <h2>팀장 · 공유 사례 관리</h2>
                  <p>합성 공유 사례: 고객과 제안 조건을 먼저 정리하기</p>
                  <Button
                    onClick={() => {
                      setGuide(!guide)
                      setGuideMessage(
                        guide
                          ? '합성 사례를 가이드에서 뺐습니다. 팀원 화면에서도 숨겨집니다.'
                          : '합성 사례를 가이드에 추가했습니다. 팀원도 읽을 수 있습니다.',
                      )
                    }}
                  >
                    {guide ? '가이드에서 빼기' : '가이드에 추가'}
                  </Button>
                </Card>
              )}
              {guideMessage && <Notice>{guideMessage} 데모 메모리에만 반영됩니다.</Notice>}
              {guide ? (
                <Card>
                  <h2>고객과 제안 조건을 먼저 정리하기</h2>
                  <p>
                    고객 유형, 가격, 체험 기간과 출력 형식을 한 번에 전달하면 불필요한 재요청을
                    줄이는 데 도움이 됩니다.
                  </p>
                  <blockquote>{cases[0].after}</blockquote>
                  <small>비식별 합성 사례 · 작성자·개인 원문 없음</small>
                </Card>
              ) : (
                <Card>
                  <h2>등록된 가이드가 없습니다</h2>
                  <p>
                    {role === 'leader'
                      ? '위 공유 사례의 ‘가이드에 추가’ 버튼으로 다시 지정할 수 있습니다.'
                      : '팀장이 사례를 지정하면 이곳에서 읽을 수 있습니다. 상단 시연 역할을 팀장으로 바꾸면 지정 과정을 체험할 수 있습니다.'}
                  </p>
                </Card>
              )}
            </>
          )}
        </main>
      </div>
      {current && (
        <Modal title={`${current.type} · 합성 피드백`} onClose={() => setDetail(null)}>
          <p>{current.problem}</p>
          <h3>개선 전</h3>
          <blockquote>{current.before}</blockquote>
          <h3>개선 프롬프트</h3>
          <blockquote>{current.after}</blockquote>
          <small>합성 권고이며 실제 절감량이나 업무 성과를 보장하지 않습니다.</small>
          <div className="demo-actions">
            {['도움됨', '해당 없음'].map((reaction) => (
              <Button
                key={reaction}
                aria-pressed={reactions[current.id] === reaction}
                onClick={() =>
                  setReactions({
                    ...reactions,
                    [current.id]: reactions[current.id] === reaction ? '' : reaction,
                  })
                }
              >
                {reaction}
              </Button>
            ))}
            <Button onClick={() => setOriginal(!original)}>
              {original ? '근거 대화 숨기기' : '근거 대화 보기'}
            </Button>
          </div>
          {original && (
            <section aria-label="합성 근거 대화">
              {current.messages.map((message, index) => (
                <p className={index === current.evidence ? 'demo-evidence' : ''} key={index}>
                  {index % 2 === 0 ? '사용자' : 'AI'}: {message}
                  {index === current.evidence && <strong> · 문제 근거</strong>}
                </p>
              ))}
            </section>
          )}
          <p role="status">
            {reactions[current.id]
              ? `${reactions[current.id]} 반응이 데모 메모리에 반영됐습니다.`
              : '반응을 선택할 수 있습니다.'}
          </p>
        </Modal>
      )}
    </div>
  )
}
