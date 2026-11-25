// Deliberately separate from production API types, accounts, and identifiers.
export const demoFile = {
  format: 'toki-synthetic-demo-v1',
  conversationKeys: ['context', 'length', 'model'],
}
export const cases = [
  {
    id: 'context',
    title: '신규 고객에게 제안 메일 작성',
    type: '맥락 누락',
    code: 'MISSING_CONTEXT',
    problem: '고객과 제안 조건이 빠져 다시 요청했습니다.',
    before: '우리 서비스를 소개하는 영업 메일 써줘.',
    after:
      '가상의 카페 운영자에게 예약 관리 도구를 제안하는 메일을 작성해줘. 월 3만 원, 14일 체험 조건을 포함하고 제목과 5문장 이내 본문을 제공해줘. 확인되지 않은 효과는 쓰지 마.',
    messages: [
      '우리 서비스를 소개하는 영업 메일 써줘.',
      '어떤 고객과 조건인지 알려주시면 구체적으로 작성할 수 있습니다.',
      '가상의 카페 운영자 대상이야. 월 3만 원, 14일 체험이고 제목과 본문을 줘.',
    ],
    evidence: 0,
  },
  {
    id: 'length',
    title: '반복 수정한 제안서 요약',
    type: '긴 대화',
    code: 'LONG_CONVERSATION',
    problem: '여러 수정 조건이 대화에 흩어져 있습니다. 최종 조건을 한 번에 정리해보세요.',
    before: '다시 줄여줘. 아까 조건도 넣어줘.',
    after:
      '아래 합성 제안서를 3개 항목으로 요약해줘. 대상은 카페 운영자이며 가격과 체험 기간을 유지하고 중복 문장을 제거해줘. [합성 제안서]',
    messages: [
      '합성 제안서를 요약해줘.',
      '예약 관리 기능과 체험 조건을 정리했습니다.',
      '다시 줄여줘. 아까 조건도 넣어줘.',
    ],
    evidence: 2,
  },
  {
    id: 'model',
    title: '짧은 안내 문장의 표현 수정',
    type: '과한 모델',
    code: 'OVERSPEC_MODEL',
    problem: '단순한 문장 다듬기는 가벼운 모델로도 요구 품질을 만족하는지 비교할 수 있습니다.',
    before: '다음 합성 안내 문장을 정중하게 바꿔줘: 내일 다시 연락 주세요.',
    after:
      '가벼운 모델로 다음 합성 안내 문장을 정중한 한 문장으로 바꿔줘. 의미와 일정은 유지해줘: 내일 다시 연락 주세요.',
    messages: [
      '다음 합성 안내 문장을 정중하게 바꿔줘: 내일 다시 연락 주세요.',
      '내일 다시 연락해 주시면 감사하겠습니다.',
    ],
    evidence: 0,
  },
] as const
export type DemoCaseId = (typeof cases)[number]['id']
export type Scenario = 'success' | 'partial' | 'failure'
export function completedIds(selected: DemoCaseId[], scenario: Scenario) {
  return scenario === 'failure' ? [] : scenario === 'partial' ? selected.slice(0, -1) : selected
}
export const teamSample = {
  contributors: 6,
  confirmed: 48,
  successes: 36,
  rework: 12,
  tokens: 72000,
  weeks: [
    { label: '11/02 주', value: 2600 },
    { label: '11/09 주', value: 2300 },
    { label: '11/16 주', value: 2000 },
  ],
}
