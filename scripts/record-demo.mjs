/* global document, scrollTo */
import { performance } from 'node:perf_hooks'
import { setTimeout } from 'node:timers'
import { URL } from 'node:url'
import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile, copyFile } from 'node:fs/promises'
import path from 'node:path'

const output = path.resolve('../output/presentation-demo')
await mkdir(output, { recursive: true })
const base = process.env.DEMO_VIDEO_URL || 'http://127.0.0.1:5175/demo'
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  locale: 'ko-KR',
  recordVideo: { dir: path.join(output, 'raw'), size: { width: 1600, height: 900 } },
})
const created = performance.now()
const page = await context.newPage()
const errors = [],
  apiRequests = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('request', (request) => {
  if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url())
})
await page.goto(base, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await expect(page.getByRole('note')).toContainText('샘플 데이터')
await page.addStyleTag({
  content: `
  body { padding-bottom: 118px; }
  .demo-main h1:focus { outline: none; }
  dialog { max-height: calc(100dvh - 165px); margin-top: 24px; }
  #video-caption { position: fixed; inset: auto 24px 20px; width: auto; max-width: none; margin: 0;
    background: #152c45f5; color: white; border: 1px solid #557490; border-radius: 12px;
    padding: 15px 25px; font: 500 23px/1.5 'IBM Plex Sans KR', sans-serif; pointer-events: none;
    box-shadow: 0 8px 30px #14294230; }
  #video-caption small { display: block; color: #bcd7f3; font-size: 14px; margin-bottom: 4px; }
`,
})
await page.evaluate(() => {
  const el = document.createElement('div')
  el.id = 'video-caption'
  el.setAttribute('popover', 'manual')
  el.append(document.createElement('small'), document.createElement('span'))
  document.body.append(el)
})
const prerollSeconds = (performance.now() - created) / 1000
const started = performance.now()
const captions = []
async function at(second) {
  await new Promise((resolve) =>
    setTimeout(resolve, Math.max(0, second * 1000 - (performance.now() - started))),
  )
}
async function caption(second, title, text) {
  await at(second)
  captions.push({ second, title, text })
  await page.evaluate(
    ({ title, text }) => {
      const el = document.getElementById('video-caption')
      el.children[0].textContent = title
      el.children[1].textContent = text
      if (el.matches(':popover-open')) el.hidePopover()
      el.showPopover()
    },
    { title, text },
  )
  console.log(`${second}s ${title}`)
}
async function click(locator) {
  await locator.scrollIntoViewIfNeeded()
  const rect = await locator.boundingBox()
  if (rect) await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2, { steps: 12 })
  await locator.click({ delay: 100 })
}
const button = (name) => page.getByRole('button', { name, exact: true })
await caption(
  0,
  '01 / 서비스 소개',
  'AI 대화의 개선점을 찾아, 팀의 업무 효율과 가이드로 연결합니다.',
)
await caption(7, '02 / 대화 선택', '합성 대화 3건을 불러오고 분석할 대화를 직접 선택합니다.')
await click(button('샘플 대화 불러오기'))
for (const name of [/신규 고객/, /반복 수정/, /짧은 안내/]) {
  await page.getByRole('checkbox', { name }).check()
  await page.waitForTimeout(500)
}
await at(17)
await click(button('3건 분석 시작'))
await caption(
  18,
  '03 / 분석 진행',
  '선택한 대화의 진행 상태와 분석 결과를 확인합니다. 분석은 모의 실행입니다.',
)
await expect(page.getByRole('heading', { name: '분석 완료', exact: true })).toBeVisible()
await at(25)
await click(button('생성된 피드백 보기'))
await caption(
  26,
  '04 / 개선 피드백',
  '맥락 누락, 긴 대화, 과한 모델 사용을 나누어 개선 방법을 제안합니다.',
)
await at(34)
await click(button('피드백 상세 보기 · 맥락 누락'))
await caption(
  35,
  '05 / 개선 전후 비교',
  '고객과 조건이 빠진 질문을, 대상·가격·기간·출력 형식이 있는 질문으로 바꿉니다.',
)
await at(46)
await click(button('근거 대화 보기'))
await page.getByRole('region', { name: '근거 대화' }).scrollIntoViewIfNeeded()
await caption(
  47,
  '06 / 근거 확인',
  '샘플 대화에서 개선점이 나온 위치를 확인하고, 도움이 된 피드백에 반응을 남깁니다.',
)
await at(52)
await click(button('도움됨'))
await at(55)
await click(button('맥락 누락 · 피드백 닫기'))
await click(button('4. 팀 성과'))
await caption(
  56,
  '07 / 팀 성과',
  '과거 주간 합성 집계로 성공 업무당 토큰, 성공률과 오류 수정 재작업률을 봅니다.',
)
await at(64)
await click(button('5. 개선 가이드'))
await page.getByLabel('시연 역할').selectOption('leader')
await caption(
  65,
  '08 / 팀 가이드',
  '공유 승인이 끝난 사례를 팀장이 가이드로 관리하고, 팀원은 다음 업무에 활용합니다.',
)
await at(68)
await click(button('가이드에서 빼기'))
await page.waitForTimeout(700)
await click(button('가이드에 추가'))
await at(73)
await click(button('6. 비용 · ROI'))
await caption(
  74,
  '09 / 비용 비교',
  '토큰·가정 단가·환율·업무량으로 비용을 비교합니다. 예시의 지출 감소 추정은 35,000원입니다.',
)
await at(82)
await page.getByRole('heading', { name: '토큰과 단가', exact: true }).scrollIntoViewIfNeeded()
await caption(
  83,
  '10 / 계산 근거',
  '입력·출력 토큰을 구분하고, 반복 전송한 맥락도 입력량에 포함합니다. 실제 청구액은 아닙니다.',
)
await at(90)
await page.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' }))
await page.waitForTimeout(600)
await click(button('2. ROI 계산'))
await caption(
  91,
  '11 / ROI 분리',
  'AI 지출만 반영하면 −93%, 절약한 시간의 가치까지 포함하면 207%입니다. 두 효과를 구분합니다.',
)
await at(102)
const time = page.getByLabel('개선 후 검토·재작업 분 / 건', { exact: true })
await time.scrollIntoViewIfNeeded()
await time.fill('4')
await caption(
  103,
  '12 / 가정 변경',
  '업무당 시간을 3분에서 4분으로 바꾸면 ROI도 달라집니다. 입력한 가정에 따른 시나리오입니다.',
)
await at(108)
await page.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' }))
await expect(page.getByText('107%', { exact: true })).toBeVisible()
await caption(
  113,
  '13 / 마무리',
  '대화 분석 → 개선 피드백 → 팀 활용 → 비용과 ROI 비교. 합성 데이터로 전체 흐름을 시연했습니다.',
)
await at(120)
await page.screenshot({ path: path.join(output, 'poster.png') })
await at(121)
const video = page.video()
await context.close()
const source = await video.path()
await copyFile(source, path.join(output, 'demo-2min-raw.webm'))
await browser.close()
const timestamp = (second) => {
  const ms = Math.round(second * 1000)
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`
}
await writeFile(
  path.join(output, 'narration.srt'),
  captions
    .map(
      (c, i) =>
        `${i + 1}\n${timestamp(c.second)} --> ${timestamp(captions[i + 1]?.second ?? 120)}\n${c.text}\n`,
    )
    .join('\n'),
  'utf8',
)
await writeFile(
  path.join(output, '시연 대본.txt'),
  captions.map((c) => `${timestamp(c.second).slice(3, 8)}  ${c.title}\n${c.text}`).join('\n\n'),
  'utf8',
)
await writeFile(
  path.join(output, 'recording.json'),
  JSON.stringify(
    {
      url: base,
      prerollSeconds,
      duration: 120,
      viewport: { width: 1600, height: 900 },
      errors,
      apiRequests,
      captions,
    },
    null,
    2,
  ),
)
if (errors.length || apiRequests.length)
  throw new Error('Recording had errors or unexpected API traffic')
console.log(`Saved recording: ${output}`)
