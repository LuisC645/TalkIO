import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { AIError } from '../ai/provider.ts'
import { HttpError } from '../http.ts'
import { pastExercisesForReview } from '../lesson/fallback.ts'
import { levelGuidePrompt, loadLevelGuide } from '../lesson/levels.ts'
import { buildExercise, LessonOutput, lessonJsonSchema, type BuiltExercise } from '../lesson/schema.ts'
import { callAI } from '../usage.ts'
import { EXAM_PROMPT_VERSION, levelExamPrompt, weeklyExamPrompt } from './prompt.ts'
import { examStatus, LEVEL_PASS, localDate, WEEKLY_PASS } from './rules.ts'

export const FUNCTION = 'exams'
export const MAX_PER_DAY = 6

type ExamStatus = Awaited<ReturnType<typeof examStatus>>

/** Sin IA: examen semanal con ejercicios de las lecciones de esta semana (sin pistas) */
async function weeklyExamWithoutAI(admin: SupabaseClient, userId: string, lessonIds: string[], meta: Record<string, unknown>, cefr: string, devUnlock: boolean) {
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

/**
 * Crea el examen semanal o de nivel (IA; el semanal tiene alternativa sin IA). Quien llama ya
 * comprobó que está disponible. La usan la app (exams) y la preparación en segundo plano.
 */
export async function createExam(
  admin: SupabaseClient,
  userId: string,
  kindArg: 'weekly' | 'level',
  status: ExamStatus,
  // Sin IA → examen semanal con ejercicios de la semana. La preparación en segundo plano lo desactiva
  { allowFallback = true }: { allowFallback?: boolean } = {},
): Promise<{ lesson_id: string; reused: boolean; fallback?: boolean }> {
  const body = { kind: kindArg }
  const kind = kindArg === 'weekly' ? 'weekly_exam' : 'level_exam'
  const { data: profile } = await admin.from('profiles').select('interests, cefr_level, cefr_plus, timezone').eq('id', userId).single()
  const cefr = `${profile?.cefr_level ?? 'A2'}${profile?.cefr_plus ? '+' : ''}`
  const interests = (profile?.interests as string[]) ?? []

  // Contexto
  let system: string
  let input: string
  let meta: Record<string, unknown>
  let title: string
  let weekLessonIds: string[] = []
  if (body.kind === 'weekly') {
    const weekStart = status.weekly.week_start as string
    const tz = profile?.timezone ?? 'UTC'
    const { data: lessons } = await admin
      .from('lessons')
      .select('id, title, content, focus_pattern_ids, completed_at')
      .eq('user_id', userId)
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
        .eq('user_id', userId)
        .gte('occurred_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
        .neq('corrected_text', '—')
        .limit(12),
    ])
    system = weeklyExamPrompt({ cefr, interests, levelGuide: levelGuidePrompt(cefr, await loadLevelGuide(admin, cefr)) })
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
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('priority', { ascending: false })
      .limit(6)
    system = levelExamPrompt({ cefr, interests, target, levelGuide: levelGuidePrompt(target, await loadLevelGuide(admin, target)) })
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
      res = await callAI(admin, { userId: userId, functionName: FUNCTION }, {
        tier: 'standard',
        system,
        input,
        responseSchema: lessonJsonSchema as unknown as Record<string, unknown>,
        temperature: 0.7,
        maxOutputTokens: 14000,
        thinking: 'low',
      })
    } catch (err) {
      if (!(err instanceof AIError) || !allowFallback) throw err
      if (body.kind === 'level') {
        throw new HttpError(503, 'El examen de nivel necesita la IA, que no está disponible ahora. Inténtalo más tarde.', 'ai_busy')
      }
      return await weeklyExamWithoutAI(admin, userId, weekLessonIds, meta, profile?.cefr_level ?? 'A2', status.dev_unlock)
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
      user_id: userId,
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

  const { data: codes } = await admin.from('error_patterns').select('id, code').eq('user_id', userId)
  const byCode = new Map((codes ?? []).map((c) => [c.code, c.id]))
  const ordered = [...built].sort((a, b) => (a.phase === 'free' ? 1 : 0) - (b.phase === 'free' ? 1 : 0))
  const { error: exError } = await admin.from('exercises').insert(
    ordered.map((e, i) => ({
      lesson_id: exam.id,
      user_id: userId,
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
    const { data: p } = await admin.from('profiles').select('learner_context').eq('id', userId).single()
    const lc = { ...((p?.learner_context as Record<string, unknown>) ?? {}) }
    delete lc.dev_unlock_exams
    await admin.from('profiles').update({ learner_context: lc }).eq('id', userId)
  }

  return { lesson_id: exam.id, reused: false }
}
