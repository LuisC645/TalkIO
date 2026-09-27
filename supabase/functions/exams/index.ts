import { z } from 'npm:zod@4'
import { AIError } from '../_shared/ai/provider.ts'
import { EXAM_PROMPT_VERSION, levelExamPrompt, weeklyExamPrompt } from '../_shared/exams/prompt.ts'
import { pastExercisesForReview } from '../_shared/lesson/fallback.ts'
import { examStatus, LEVEL_PASS, localDate, WEEKLY_PASS } from '../_shared/exams/rules.ts'
import { HttpError, json, serve } from '../_shared/http.ts'
import { buildExercise, LessonOutput, lessonJsonSchema, type BuiltExercise } from '../_shared/lesson/schema.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'
import { assertDailyLimit, callAI } from '../_shared/usage.ts'

const FUNCTION = 'exams'
const MAX_PER_DAY = 6

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('status') }),
  z.object({ action: z.literal('create'), kind: z.enum(['weekly', 'level']) }),
])

/**
 * Exámenes: status (desbloqueo y resultados) y create (genera el examen con IA).
 * Un examen es una lección con kind = weekly_exam | level_exam: se juega en el mismo
 * reproductor, en modo examen (sin pistas ni retroalimentación hasta el final).
 */
/** Sin IA: examen semanal con ejercicios de las lecciones de esta semana (sin pistas) */
async function weeklyExamWithoutAI(userId: string, lessonIds: string[], meta: Record<string, unknown>, cefr: string, devUnlock: boolean) {
  const admin = adminClient()
  // Con el desbloqueo de pruebas puede no haber lecciones esta semana: se usan las más recientes
  const rows = await pastExercisesForReview(admin, userId, { limit: 10, lessonIds: lessonIds.length || !devUnlock ? lessonIds : undefined })
  if (rows.length < 6) {
    throw new HttpError(503, 'La IA no está disponible y no hay suficientes ejercicios de esta semana para armar el examen. Inténtalo más tarde.', 'ai_busy')
  }
  const { data: exam, error } = await admin
    .from('lessons')
    .insert({
      user_id: userId,
      kind: 'weekly_exam',
      title: 'Examen de la semana',
      cefr_level: cefr,
      status: 'ready',
      content: { rule: null, covers: 'Lo que practicaste esta semana', summary: 'Preguntas de tus lecciones de esta semana, empezando por las que fallaste.' },
      meta: { ...meta, fallback: true },
      model: 'sin-ia',
      prompt_version: 'fallback.v1',
    })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'Ya tienes el examen de esta semana.', 'exists')
    throw error
  }
  const { error: exError } = await admin.from('exercises').insert(
    rows.map((r, i) => ({ ...r, phase: 'drill', payload: { ...r.payload, hint: null }, lesson_id: exam.id, user_id: userId, position: i + 1 })),
  )
  if (exError) {
    await admin.from('lessons').delete().eq('id', exam.id)
    throw exError
  }
  return { lesson_id: exam.id, reused: false, fallback: true }
}

serve(async (req) => {
  const admin = adminClient()
  const user = await requireUser(req, admin)
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) throw new HttpError(400, 'Acción inválida.')
  const body = parsed.data

  const status = await examStatus(admin, user.id)
  if (body.action === 'status') return json(status)

  const kind = body.kind === 'weekly' ? 'weekly_exam' : 'level_exam'
  const gate = body.kind === 'weekly' ? status.weekly : status.level
  if (gate.exam && gate.exam.status !== 'completed') return json({ lesson_id: gate.exam.id, reused: true })
  if (!gate.available) throw new HttpError(403, 'Este examen aún no está disponible.', 'locked')
  if (!(await assertDailyLimit(admin, user.id, FUNCTION, MAX_PER_DAY))) {
    throw new HttpError(429, 'Ya generaste varios exámenes hoy. Vuelve mañana.', 'daily_limit')
  }

  const { data: profile } = await admin.from('profiles').select('interests, cefr_level, cefr_plus, timezone').eq('id', user.id).single()
  const cefr = `${profile?.cefr_level ?? 'A2'}${profile?.cefr_plus ? '+' : ''}`
  const interests = (profile?.interests as string[]) ?? []

  // Contexto
  let system: string
  let input: string
  let meta: Record<string, unknown>
  let title: string
  let weekLessonIds: string[] = []
  if (body.kind === 'weekly') {
    const weekStart = status.weekly.week_start
    const tz = profile?.timezone ?? 'UTC'
    const { data: lessons } = await admin
      .from('lessons')
      .select('id, title, content, focus_pattern_ids, completed_at')
      .eq('user_id', user.id)
      .eq('kind', 'lesson')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(20)
    const week = (lessons ?? []).filter((l) => l.completed_at && localDate(tz, new Date(l.completed_at)) >= weekStart)
    weekLessonIds = week.map((l) => l.id)
    const patternIds = [...new Set(week.flatMap((l) => (l.focus_pattern_ids as string[]) ?? []))]
    const [{ data: patterns }, { data: mistakes }] = await Promise.all([
      patternIds.length ? admin.from('error_patterns').select('code, title, rule').in('id', patternIds) : Promise.resolve({ data: [] }),
      admin
        .from('error_occurrences')
        .select('wrong_text, corrected_text')
        .eq('user_id', user.id)
        .gte('occurred_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
        .neq('corrected_text', '—')
        .limit(12),
    ])
    system = weeklyExamPrompt({ cefr, interests })
    input = JSON.stringify({
      lessons_this_week: week.map((l) => ({ title: l.title, rule: (l.content as { rule?: { title: string } })?.rule?.title })),
      focus_errors: patterns ?? [],
      recent_mistakes: (mistakes ?? []).map((m) => ({ wrong: m.wrong_text, right: m.corrected_text })),
    })
    meta = { week_start: weekStart, pass_threshold: WEEKLY_PASS }
    title = 'Examen de la semana'
  } else {
    const target = status.level.target!
    const { data: patterns } = await admin
      .from('error_patterns')
      .select('code, title')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('priority', { ascending: false })
      .limit(6)
    system = levelExamPrompt({ cefr, interests, target })
    input = JSON.stringify({ current_level: cefr, target_level: target, learner_active_errors: patterns ?? [] })
    meta = { target_level: target, from_level: cefr, pass_threshold: LEVEL_PASS }
    title = `Examen de nivel ${target}`
  }

  // IA (1 reintento si no valida)
  let output: LessonOutput | null = null
  let built: BuiltExercise[] = []
  let model: string | null = null
  for (let attempt = 0; attempt < 2 && !output; attempt++) {
    let res: { data: unknown; model: string }
    try {
      res = await callAI(admin, { userId: user.id, functionName: FUNCTION }, {
        tier: 'standard',
        system,
        input,
        responseSchema: lessonJsonSchema as unknown as Record<string, unknown>,
        temperature: 0.7,
        maxOutputTokens: 14000,
        thinking: 'low',
      })
    } catch (err) {
      if (!(err instanceof AIError)) throw err
      if (body.kind === 'level') {
        throw new HttpError(503, 'El examen de nivel necesita la IA, que no está disponible ahora. Inténtalo más tarde.', 'ai_busy')
      }
      return json(await weeklyExamWithoutAI(user.id, weekLessonIds, meta, profile?.cefr_level ?? 'A2', status.dev_unlock))
    }
    model = res.model
    const parsedOut = LessonOutput.safeParse(res.data)
    if (!parsedOut.success) {
      input += `\n\nYour previous output was invalid: ${parsedOut.error.message.slice(0, 500)}. Fix it.`
      continue
    }
    built = parsedOut.data.exercises.map(buildExercise).filter((r): r is BuiltExercise => typeof r !== 'string')
    if (built.length >= 8) output = parsedOut.data
    else input += '\n\nToo many invalid exercises; follow the field requirements exactly.'
  }
  if (!output) throw new HttpError(502, 'No se pudo generar el examen. Vuelve a intentarlo.', 'generation_failed')

  const { data: exam, error } = await admin
    .from('lessons')
    .insert({
      user_id: user.id,
      kind,
      title,
      cefr_level: profile?.cefr_level ?? 'A2',
      status: 'ready',
      content: { rule: null, covers: output.rule.title, summary: output.rule.explanation },
      meta,
      model,
      prompt_version: EXAM_PROMPT_VERSION,
    })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'Ya tienes el examen de esta semana.', 'exists')
    throw error
  }

  const { data: codes } = await admin.from('error_patterns').select('id, code').eq('user_id', user.id)
  const byCode = new Map((codes ?? []).map((c) => [c.code, c.id]))
  const ordered = [...built].sort((a, b) => (a.phase === 'free' ? 1 : 0) - (b.phase === 'free' ? 1 : 0))
  const { error: exError } = await admin.from('exercises').insert(
    ordered.map((e, i) => ({
      lesson_id: exam.id,
      user_id: user.id,
      position: i + 1,
      phase: e.phase,
      type: e.type,
      payload: { ...e.payload, hint: null }, // sin pistas en exámenes
      answer_key: e.answer_key,
      grading: e.grading,
      target_pattern_id: e.target_code ? (byCode.get(e.target_code) ?? null) : null,
    })),
  )
  if (exError) {
    await admin.from('lessons').delete().eq('id', exam.id)
    throw exError
  }

  // El desbloqueo de pruebas se consume al crear un examen
  if (status.dev_unlock) {
    const { data: p } = await admin.from('profiles').select('learner_context').eq('id', user.id).single()
    const lc = { ...((p?.learner_context as Record<string, unknown>) ?? {}) }
    delete lc.dev_unlock_exams
    await admin.from('profiles').update({ learner_context: lc }).eq('id', user.id)
  }

  return json({ lesson_id: exam.id, reused: false })
})
