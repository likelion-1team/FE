import { useState } from 'react'
import { Button, Card, Field } from '../components/ui'
import {
  calculateScenario,
  emptyScenario,
  sampleScenario,
  type NumericField,
  type Scenario,
} from './calculator'
import './cost-roi.css'

const money = (n: number) => `${n.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}원`
const percent = (n: number | null) =>
  n == null ? '계산 불가' : `${n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%`
export function CostRoi({ demo = false }: { demo?: boolean }) {
  const [scenario, setScenario] = useState<Scenario>(() => ({
    ...(demo ? sampleScenario : emptyScenario),
  }))
  const [tab, setTab] = useState<'cost' | 'roi'>('cost')
  const result = calculateScenario(scenario)
  const data = 'error' in result ? null : result
  const set = (key: keyof Scenario, value: string | boolean) =>
    setScenario((s) => ({ ...s, [key]: value }))
  const number = (key: NumericField, label: string) => (
    <Field key={key} label={label}>
      <input
        type="number"
        min="0"
        max="1000000000000"
        step="any"
        value={scenario[key]}
        onChange={(event) => set(key, event.target.value)}
      />
    </Field>
  )
  const metric = (label: string, value: string, meta: string) => (
    <Card key={label} className="roi-metric">
      <h2>{label}</h2>
      <p className="roi-value">{value}</p>
      <small>{meta}</small>
    </Card>
  )
  return (
    <div className="cost-roi">
      <p className="roi-disclosure">
        동일한 업무량·품질을 가정한 시나리오입니다. 실제 청구액이나 검증된 성과가 아닙니다.
      </p>
      <div className="roi-tabs" aria-label="비용과 ROI 화면 선택">
        <Button
          variant={tab === 'cost' ? 'primary' : 'secondary'}
          aria-pressed={tab === 'cost'}
          onClick={() => setTab('cost')}
        >
          1. 비용 비교
        </Button>
        <Button
          variant={tab === 'roi' ? 'primary' : 'secondary'}
          aria-pressed={tab === 'roi'}
          onClick={() => setTab('roi')}
        >
          2. ROI 계산
        </Button>
        <Button onClick={() => setScenario({ ...emptyScenario })}>입력 초기화</Button>
        {demo && <Button onClick={() => setScenario({ ...sampleScenario })}>합성 예시 복원</Button>}
      </div>
      {data ? (
        <section className="roi-results" aria-label="시나리오 계산 결과" aria-live="polite">
          <div className="roi-grid">
            {tab === 'cost' ? (
              <>
                {metric('개선 전 AI 비용', money(data.beforeCost), '가정 단가 · 기간 내 전체 업무')}
                {metric('개선 후 AI 비용', money(data.afterCost), '같은 단가·환율로 비교')}
                {metric('AI 지출 감소 추정', money(data.spendingSaving), '음수이면 지출 증가')}
              </>
            ) : (
              <>
                {metric('AI 지출 감소 추정', money(data.spendingSaving), '실제 현금 절감액 아님')}
                {metric(
                  '시간 절감 가치',
                  money(data.timeValue),
                  `${data.hoursSaved.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}시간 · 입력한 인건비 적용`,
                )}
                {metric('도입 총비용', money(data.investment), '설정·교육·이용료·운영 비용')}
              </>
            )}
          </div>
          {tab === 'roi' && (
            <>
              <div className="roi-grid roi-two">
                {metric(
                  'AI 지출만 반영한 ROI',
                  percent(data.spendingRoi),
                  '(AI 지출 감소 − 도입비) ÷ 도입비',
                )}
                {metric(
                  '시간 가치 포함 ROI',
                  percent(data.economicRoi),
                  '(AI 지출 감소 + 시간 가치 − 도입비) ÷ 도입비',
                )}
              </div>
              <p className="roi-result-note">
                {data.investment === 0
                  ? '도입 총비용이 0원이므로 ROI를 계산할 수 없습니다.'
                  : `시간 가치를 포함한 순편익 ${money(data.netBenefit)} · 실제 지출 감소와 시간 가치는 별도로 판단하세요.`}
              </p>
            </>
          )}
        </section>
      ) : (
        <p role="status" className="roi-disclosure">
          계산 대기 · {result.error}
        </p>
      )}
      <Card>
        <h2>비교 기간과 계산 근거</h2>
        <div className="roi-grid">
          <Field label="시작일">
            <input
              type="date"
              value={scenario.from}
              onChange={(event) => set('from', event.target.value)}
            />
          </Field>
          <Field label="종료일">
            <input
              type="date"
              value={scenario.to}
              onChange={(event) => set('to', event.target.value)}
            />
          </Field>
          {number('jobs', '기간 내 업무 수')}
        </div>
        <Field label="가정·단가 출처">
          <input
            value={scenario.source}
            maxLength={300}
            placeholder="모델·가격 기준일·토큰과 시간의 측정 또는 추정 출처"
            onChange={(event) => set('source', event.target.value)}
          />
        </Field>
        <label className="roi-check">
          <input
            type="checkbox"
            checked={scenario.comparable}
            onChange={(event) => set('comparable', event.target.checked)}
          />
          같은 업무량·품질을 가정합니다
        </label>
        <small>
          입력은 현재 화면에서만 계산하며 서버에 저장하지 않습니다. 업무 공간을 나가면 초기화됩니다.
        </small>
      </Card>
      {tab === 'cost' ? (
        <Card>
          <h2>토큰과 단가</h2>
          <p>
            업무 1건의 전체 요청을 합산하세요. 반복 전송한 맥락도 입력 토큰에 포함합니다. 단가는 USD
            / 100만 토큰입니다.
          </p>
          <div className="roi-grid">
            {number('beforeInput', '개선 전 입력 토큰 / 건')}
            {number('beforeOutput', '개선 전 출력 토큰 / 건')}
            {number('inputRate', '입력 단가 USD / 100만 토큰')}
            {number('afterInput', '개선 후 입력 토큰 / 건')}
            {number('afterOutput', '개선 후 출력 토큰 / 건')}
            {number('outputRate', '출력 단가 USD / 100만 토큰')}
            {number('exchangeRate', '환율 KRW / USD')}
          </div>
          <small>
            동일 모델 단가를 가정합니다. 캐시·추론·세금·정액 구독 요금은 이 토큰 산식으로 재현하지
            않습니다.
          </small>
          <Button
            onClick={() => {
              setTab('roi')
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            시간과 도입 비용 입력하기
          </Button>
        </Card>
      ) : (
        <Card>
          <h2>시간과 도입 비용</h2>
          <div className="roi-grid">
            {number('beforeMinutes', '개선 전 검토·재작업 분 / 건')}
            {number('afterMinutes', '개선 후 검토·재작업 분 / 건')}
            {number('hourlyWage', '시간당 인건비 KRW')}
            {number('setup', '초기 설정비 KRW')}
            {number('training', '교육비 KRW')}
            {number('subscription', '서비스 이용료 KRW')}
            {number('operations', '업로드·확인·오판 대응비 KRW')}
          </div>
          <small>
            모든 비용은 선택한 기간에 해당하는 금액으로 입력하세요. 도입비 항목에 같은 비용을
            중복해서 넣지 마세요. 시간이 늘어난 경우 시간 가치도 음수로 반영합니다.
          </small>
          <Button onClick={() => setTab('cost')}>토큰과 단가 확인하기</Button>
        </Card>
      )}
      <Card>
        <details>
          <summary>계산식과 가정 확인</summary>
          <p>
            AI 비용 = (입력 토큰 × 입력 단가 + 출력 토큰 × 출력 단가) ÷ 1,000,000 × 환율 × 업무 수
          </p>
          <p>시간 가치 = (개선 전 분 − 개선 후 분) ÷ 60 × 업무 수 × 시간당 인건비</p>
          <p>ROI = (기간 내 편익 − 도입 총비용) ÷ 도입 총비용 × 100%</p>
          <p>
            현재 가정·단가 출처: {scenario.source || '미입력'} · 통화: KRW · 기간:{' '}
            {scenario.from || '미입력'} ~ {scenario.to || '미입력'}
          </p>
          <p>
            업로드 분석 결과와 자동 연결된 수치가 아닙니다. 절감 예상은 품질 유지나 교육의
            인과효과를 입증하지 않습니다.
          </p>
        </details>
      </Card>
    </div>
  )
}
