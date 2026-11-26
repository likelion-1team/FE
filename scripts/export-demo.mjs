/* global document */
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rename, rm, rmdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { chromium } from '@playwright/test'

const output = fileURLToPath(new URL('../../output/presentation-demo/', import.meta.url))
const raw = path.join(output, 'demo-2min-raw.webm')
const recording = JSON.parse(await readFile(path.join(output, 'recording.json'), 'utf8'))
const { duration, prerollSeconds, viewport } = recording
if (duration !== 120 || !Number.isFinite(prerollSeconds) || prerollSeconds < 0) {
  throw new Error(
    'Expected a two-minute recording with a valid preroll. Run record-demo.mjs first.',
  )
}
if (viewport?.width !== 1600 || viewport?.height !== 900) {
  throw new Error('The presentation overlays require a 1600 by 900 recording.')
}

const [logo, mascotImage, font] = await Promise.all([
  readFile(new URL('../src/assets/brand/toki-logo.png', import.meta.url)),
  readFile(new URL('../src/assets/brand/toki-mascot.png', import.meta.url)),
  readFile(
    new URL(
      import.meta
        .resolve('@fontsource/ibm-plex-sans-kr/files/ibm-plex-sans-kr-latin-600-normal.woff2'),
    ),
  ),
])
const logoUrl = `data:image/png;base64,${logo.toString('base64')}`
const mascotUrl = `data:image/png;base64,${mascotImage.toString('base64')}`
const fontUrl = `data:font/woff2;base64,${font.toString('base64')}`
const temp = await mkdtemp(path.join(output, '.export-'))
const card = path.join(temp, 'card.png')
const mascot = path.join(temp, 'mascot.png')
const staged = path.join(temp, 'presentation.mp4')
const destination = path.join(output, 'TOKI_2분_시연.mp4')

try {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport })
    await page.setContent(`
      <style>
        @font-face {
          font-family: "IBM Plex Sans KR"; font-weight: 600;
          src: url("${fontUrl}") format("woff2");
        }
        [hidden] { display: none !important; }
        body { margin: 0; }
        #card {
          width: 1600px; height: 777px; box-sizing: border-box; text-align: center;
          padding-top: 146px; border-bottom: 1px solid #d6e3f2;
          background: linear-gradient(#fcfdff, #e2ecf8); color: #223654;
          font: 600 40px "IBM Plex Sans KR", sans-serif;
        }
        #card img { display: block; width: 865px; margin: 0 auto; }
        #card p { margin: 54px 0 0; }
        #mascot {
          position: absolute; top: 0; left: 0; width: 120px; height: 120px;
          display: grid; place-items: center; border-radius: 50%;
          background: #ffffffed; box-shadow: inset 0 0 0 1px #c9d9ec;
        }
        #mascot img { width: 100px; display: block; }
      </style>
      <section id="card">
        <img src="${logoUrl}" alt="TOKI" />
        <p>Make Every Token Count.</p>
      </section>
      <div id="mascot" hidden><img src="${mascotUrl}" alt="TOKI 캐릭터" /></div>
    `)
    const cardLayer = page.locator('#card')
    const mascotLayer = page.locator('#mascot')
    const fontLoaded = await page.evaluate(async () => {
      const faces = await document.fonts.load('600 40px "IBM Plex Sans KR"')
      return faces.some((face) => face.status === 'loaded')
    })
    if (!fontLoaded) throw new Error('The title card font could not be loaded.')
    await cardLayer.screenshot({ path: card, omitBackground: true })
    await cardLayer.evaluate((element) => element.setAttribute('hidden', ''))
    await mascotLayer.evaluate((element) => element.removeAttribute('hidden'))
    await mascotLayer.screenshot({ path: mascot, omitBackground: true })
  } finally {
    await browser.close()
  }

  const filters = [
    '[0:v]fps=30[demo]',
    "[demo][1:v]overlay=0:0:enable='lt(t,4.8)+gte(t,114.5)'[branded]",
    "[branded][2:v]overlay=W-w-24:H-h-124:enable='gte(t,4.8)*lt(t,114.5)',format=yuv420p[v]",
  ].join(';')
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-ss',
    prerollSeconds.toFixed(3),
    '-i',
    raw,
    '-i',
    card,
    '-i',
    mascot,
    '-filter_complex',
    filters,
    '-map',
    '[v]',
    '-frames:v',
    String(duration * 30),
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '18',
    '-movflags',
    '+faststart',
    '-progress',
    'pipe:1',
    staged,
  ]
  const result = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', args, { encoding: 'utf8' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr || 'FFmpeg could not encode the video.')
  const frames = Array.from(result.stdout.matchAll(/^frame=[ \t]*(\d+)\r?$/gm)).at(-1)?.[1]
  if (Number(frames) !== duration * 30) throw new Error('The exported video was not two minutes.')
  await rename(staged, destination)
  console.log(`Saved two-minute presentation: ${destination}`)
} finally {
  await Promise.all([card, mascot, staged].map((file) => rm(file, { force: true })))
  await rmdir(temp)
}
