// Prueba temporal: exámenes (semanal y de nivel), repetir lección e intereses. Usuario de prueba, se borra al final.
import 'dotenv/config'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'

const SCRATCH = process.argv[2]
const require = createRequire(`${SCRATCH}/pgtest/package.json`)
const puppeteer = require('puppeteer-core')
const url = process.env.SUPABASE_URL!
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const APP = 'http://localhost:5199'
const email = `talkio-exam-${Date.now()}@example.com`
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const { data: created, error: e0 } = await admin.auth.admin.createUser({ email, email_confirm: true })
if (e0) throw e0
const userId = created.user.id
let browser: any
try {
  execSync('npx tsx scripts/seed-user.ts', { env: { ...process.env, SEED_USER_EMAIL: email }, stdio: 'pipe' })
  await admin.from('profiles').update({ display_name: 'Juan Prueba' }).eq('id', userId)
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const anon = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data: s } = await anon.auth.verifyOtp({ email, token: link!.properties.email_otp, type: 'magiclink' })
  const token = s.session!.access_token
  const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`
  const call = async (fn: string, body: unknown) => {
    const r = await fetch(`${url}/functions/v1/${fn}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, apikey: anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { status: r.status, json: await r.json() }
  }

  browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--hide-scrollbars'] })
  const page = await browser.newPage()
  page.on('pageerror', (err: Error) => console.log('ERROR DE PÁGINA:', err.message))
  page.on('console', (m: any) => m.type() === 'error' && console.log('consola:', m.text()))
  const shot = async (name: string, full = false) => {
    await sleep(800)
    await page.screenshot({ path: `${SCRATCH}/v4-${name}.png`, fullPage: full })
    console.log('captura', name)
  }
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  await page.setViewport({ width: 1280, height: 900 })
  await page.goto(APP, { waitUntil: 'networkidle0' })
  await page.evaluate((k: string, v: string) => localStorage.setItem(k, v), storageKey, JSON.stringify(s.session))

  // Responde el ejercicio actual en la UI (correcto salvo `wrong`)
  async function answerCurrent(ex: any, wrong: boolean) {
    const key = ex.answer_key as any
    const p = ex.payload as any
    const ready: Record<string, string> = {
      multiple_choice: '[aria-label="Opciones"] button', fill_blank: 'input[aria-label="Tu respuesta"]', tense_contrast: 'input[aria-label="Tu respuesta"]',
      reorder: '[aria-label="Palabras disponibles"] button', transform: 'input[aria-label="Tu versión"]', error_detection: 'textarea', free_writing: 'textarea[aria-label="Tu respuesta"]',
    }
    await page.waitForSelector(ready[ex.type], { timeout: 20_000 })
    await sleep(300)
    switch (ex.type) {
      case 'multiple_choice': {
        const opts = await page.$$('[aria-label="Opciones"] button')
        await opts[wrong ? (key.correct_index + 1) % opts.length : key.correct_index].click()
        break
      }
      case 'fill_blank':
      case 'tense_contrast':
        await page.type('input[aria-label="Tu respuesta"]', wrong ? 'xyz' : key.accepted[0])
        break
      case 'reorder': {
        let rest: string = key.answer
        const pool: string[] = [...p.tokens]
        const words: string[] = []
        if (wrong) words.push(...p.tokens)
        else
          while (rest.length && pool.length) {
            const i = pool.findIndex((t) => rest.startsWith(t))
            if (i < 0) break
            words.push(pool[i]); rest = rest.slice(pool[i].length).trimStart(); pool.splice(i, 1)
          }
        for (const w of words) {
          for (const b of await page.$$('[aria-label="Palabras disponibles"] button')) {
            if ((await b.evaluate((el: HTMLElement) => el.textContent)) === w) { await b.click(); break }
          }
        }
        break
      }
      case 'transform':
        await page.type('input[aria-label="Tu versión"]', wrong ? p.sentence : key.model_answer)
        break
      case 'error_detection': {
        await (await page.$('textarea')).click()
        await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control')
        await page.keyboard.type(wrong ? p.sentence + ' ' : key.model_answer)
        break
      }
      case 'free_writing':
        await page.type('textarea[aria-label="Tu respuesta"]',
          key.model_answer ?? 'In my opinion, technology has improved our lives because it helps us communicate with people around the world. For example, I use video calls every week to talk with my family, who live in another country. However, we should use it responsibly, so I try to limit my screen time at night. That is why I believe technology is a useful tool when we use it with balance.', { delay: 0 })
        break
    }
  }

  const RETAKE_ONLY = process.argv[3] === 'retake'
  if (!RETAKE_ONLY) {
  // ── 1) Examen semanal (desbloqueado con el panel de pruebas) ──
  console.log('desbloqueo:', (await call('dev-tools', { action: 'unlock_exams' })).json.message)
  await page.goto(`${APP}/lessons`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('button::-p-text(Empezar examen)')
  await shot('01-lessons-exams-section', true)
  await page.locator('button::-p-text(Empezar examen)').click()
  await page.waitForFunction(() => /\/lessons\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: 150_000 })
  const weeklyId = page.url().split('/').pop()
  await page.waitForSelector('button::-p-text(Empezar examen)')
  await shot('02-weekly-intro')
  await page.locator('button::-p-text(Empezar examen)').click()
  const { data: wEx } = await admin.from('exercises').select('*').eq('lesson_id', weeklyId).order('position')
  console.log('semanal:', wEx!.length, 'preguntas ·', wEx!.map((e) => e.type).join(', '), '· pistas:', wEx!.filter((e) => (e.payload as any).hint).length)
  for (const ex of wEx!) {
    await answerCurrent(ex, ex.position % 4 === 0)
    if (ex.position === 2) await shot('03-weekly-question')
    await page.locator('button::-p-text(Siguiente), button::-p-text(Terminar examen)').click()
    await sleep(ex.grading === 'ai' ? 2500 : 900)
  }
  await page.waitForFunction(() => document.body.innerText.includes('Revisión'), { timeout: 60_000 })
  await shot('04-weekly-results')
  await shot('04b-weekly-results-full', true)
  const { data: wDone } = await admin.from('lessons').select('status, score, meta').eq('id', weeklyId).single()
  console.log('semanal final:', wDone)

  // ── 2) Examen de nivel (todo bien → debe subir de A2+ a B1) ──
  await call('dev-tools', { action: 'unlock_exams' })
  await page.goto(`${APP}/lessons`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('button::-p-text(Empezar examen de nivel)')
  await page.locator('button::-p-text(Empezar examen de nivel)').click()
  await page.waitForFunction(() => /\/lessons\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: 150_000 })
  const levelId = page.url().split('/').pop()
  await page.waitForSelector('button::-p-text(Empezar examen)')
  await shot('05-level-intro')
  await page.locator('button::-p-text(Empezar examen)').click()
  const { data: lEx } = await admin.from('exercises').select('*').eq('lesson_id', levelId).order('position')
  console.log('nivel:', lEx!.length, 'preguntas ·', lEx!.map((e) => e.type).join(', '))
  for (const ex of lEx!) {
    await answerCurrent(ex, false)
    await page.locator('button::-p-text(Siguiente), button::-p-text(Terminar examen)').click()
    await sleep(ex.grading === 'ai' ? 3000 : 900)
  }
  await page.waitForFunction(() => document.body.innerText.includes('Revisión'), { timeout: 90_000 })
  await shot('06-level-results')
  const { data: lDone } = await admin.from('lessons').select('score, meta').eq('id', levelId).single()
  const { data: prof } = await admin.from('profiles').select('cefr_level, cefr_plus').eq('id', userId).single()
  console.log('nivel final:', lDone, '→ perfil:', prof)

  }
  // ── 3) Repetir lección ──
  let gen = await call('generate-lesson', {})
  for (let i = 0; i < 3 && gen.status !== 200; i++) {
    console.log('generate-lesson', gen.status, gen.json.error, '→ reintento')
    await sleep(5000)
    gen = await call('generate-lesson', {})
  }
  const lessonId = gen.json.lesson_id
  const { data: lsEx } = await admin.from('exercises').select('*').eq('lesson_id', lessonId).order('position')
  for (const ex of lsEx!) {
    const key = ex.answer_key as any
    const p = ex.payload as any
    const response =
      ex.type === 'multiple_choice' ? { choice: key.correct_index }
      : ex.type === 'reorder' ? { tokens: [key.answer] }
      : ex.type === 'free_writing' ? { text: 'I think learning English is important because it opens doors at work. For example, I read technical documents every day. So I practice a little every day.' }
      : { text: (key.accepted?.[0] ?? key.model_answer) as string }
    let r = await call('grade-attempt', { exercise_id: ex.id, response })
    for (let i = 0; i < 4 && r.status === 503; i++) {
      await sleep(8000)
      r = await call('grade-attempt', { exercise_id: ex.id, response })
    }
    if (r.status !== 200) console.log('grade-attempt', ex.type, r.status, r.json, JSON.stringify(response).slice(0, 120))
  }
  const { data: r1 } = await admin.from('lessons').select('status, score, round').eq('id', lessonId).single()
  console.log('lección ronda 1:', r1)
  await page.goto(`${APP}/lessons/${lessonId}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('button::-p-text(Repetir lección)')
  await shot('07-lesson-completed-retake')
  await page.locator('button::-p-text(Repetir lección)').click()
  await sleep(2500)
  await shot('07b-after-retake-click')
  console.log('tras repetir:', (await admin.from('lessons').select('status, round').eq('id', lessonId).single()).data)
  // Ronda 2 por API (Gemini saturado vuelve lenta la UI): primeras 3 mal → nota más baja
  for (const ex of lsEx!) {
    const key = ex.answer_key as any
    const wrong = ex.position <= 3
    const response =
      ex.type === 'multiple_choice' ? { choice: wrong ? (key.correct_index + 1) % (ex.payload as any).options.length : key.correct_index }
      : ex.type === 'reorder' ? { tokens: wrong ? [...(ex.payload as any).tokens] : [key.answer] }
      : ex.type === 'free_writing' ? { text: 'I think learning English is important because it opens doors at work. For example, I read technical documents every day. So I practice a little every day.' }
      : { text: wrong ? 'xyz' : ((key.accepted?.[0] ?? key.model_answer) as string) }
    let r = await call('grade-attempt', { exercise_id: ex.id, response })
    for (let i = 0; i < 5 && r.status === 503; i++) { await sleep(8000); r = await call('grade-attempt', { exercise_id: ex.id, response }) }
    if (r.status !== 200) console.log('ronda 2', ex.type, r.status, r.json)
  }
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('button::-p-text(Repetir lección)', { timeout: 30_000 })
  await shot('08-lesson-round2-completed')
  const { data: r2 } = await admin.from('lessons').select('status, score, round').eq('id', lessonId).single()
  const { count: attempts } = await admin.from('exercise_attempts').select('id', { count: 'exact', head: true }).eq('lesson_id', lessonId)
  console.log('lección ronda 2:', r2, '· intentos guardados (2 rondas):', attempts)

  // ── 4) Intereses propios en Ajustes ──
  await page.setViewport({ width: 390, height: 844 })
  await page.goto(`${APP}/settings`, { waitUntil: 'networkidle0' })
  await page.type('#custom-interest', 'fotografía')
  await page.keyboard.press('Enter')
  await sleep(1500)
  await shot('09-settings-interests')
  const { data: pi } = await admin.from('profiles').select('interests').eq('id', userId).single()
  console.log('intereses:', pi)
  await page.goto(`${APP}/lessons`, { waitUntil: 'networkidle0' })
  await shot('10-lessons-mobile', true)
} finally {
  await browser?.close()
  await admin.auth.admin.deleteUser(userId)
  console.log('usuario de prueba borrado')
}
