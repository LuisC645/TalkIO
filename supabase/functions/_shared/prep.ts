import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { AIError } from './ai/provider.ts'
import { inBackground } from './background.ts'
import { createExam, FUNCTION as EXAMS_FUNCTION, MAX_PER_DAY as EXAMS_MAX_PER_DAY } from './exams/create.ts'
import { examStatus, localDate } from './exams/rules.ts'
import { HttpError } from './http.ts'
import { createLesson, findPendingLesson, FUNCTION as LESSON_FUNCTION, MAX_PER_DAY as LESSON_MAX_PER_DAY } from './lesson/generate.ts'
import { assertDailyLimit } from './usage.ts'

export { inBackground }

export type PrepTrigger = 'cron' | 'app' | 'after_lesson'

/** Una lección lista y sin empezar se conserva si tiene menos de esto; si no, se reemplaza */
const FRESH_HOURS = 20

/**
 * Deja listo lo que el usuario va a estudiar hoy, sin que tenga que esperar a la IA:
 *  - la lección del día: se genera si no hay una pendiente; si hay una lista pero vieja y sin
 *    empezar, se reemplaza (sobrescribe) por una con sus errores más recientes;
 *  - los exámenes (semanal / de nivel) en cuanto se desbloquean.
 * Una sola ejecución por usuario y día (daily_prep), salvo al terminar una lección, que deja
 * lista la siguiente. Nunca lanza: registra el resultado o el error en daily_prep.
 */
export async function prepareToday(admin: SupabaseClient, userId: string, trigger: PrepTrigger) {
  const { data: profile } = await admin.from('profiles').select('timezone, onboarding_completed').eq('id', userId).single()
  if (!profile?.onboarding_completed) return { skipped: 'onboarding' as const }
  const today = localDate(profile.timezone ?? 'UTC')

  const { data: claimed, error: claimError } = await admin.rpc('claim_daily_prep', {
    p_user: userId,
    p_date: today,
    p_trigger: trigger,
    p_force: trigger === 'after_lesson',
  })
  if (claimError) throw claimError
  if (!claimed) return { skipped: 'already' as const }

  const started = Date.now()
  try {
    const lessonId = await prepareLesson(admin, userId, today)
    const examIds = await prepareExams(admin, userId)
    await admin
      .from('daily_prep')
      .update({ status: 'done', finished_at: new Date().toISOString(), lesson_id: lessonId, exam_ids: examIds })
      .eq('user_id', userId)
      .eq('local_date', today)
    console.log(`prep ${trigger} ${userId}: lección ${lessonId ?? '—'}, exámenes ${examIds.length}, ${Date.now() - started} ms`)
    return { lesson_id: lessonId, exam_ids: examIds }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await admin
      .from('daily_prep')
      .update({ status: 'failed', finished_at: new Date().toISOString(), error: message.slice(0, 500) })
      .eq('user_id', userId)
      .eq('local_date', today)
    console.error(`prep ${trigger} ${userId} falló:`, message)
    return { error: message }
  }
}

async function prepareLesson(admin: SupabaseClient, userId: string, today: string): Promise<string | null> {
  const pending = await findPendingLesson(admin, userId)
  if (pending) {
    // Ya empezada: no se toca
    if (pending.status === 'in_progress') return pending.id
    const ageHours = (Date.now() - Date.parse(pending.generated_at)) / 3_600_000
    const { count } = await admin.from('exercise_attempts').select('id', { count: 'exact', head: true }).eq('lesson_id', pending.id)
    if (ageHours < FRESH_HOURS || (count ?? 0) > 0) {
      // Reciente (p. ej. preparada al terminar la de anoche): se asigna a hoy sin gastar IA
      if (pending.meta?.prepared_for !== today) {
        await admin.from('lessons').update({ meta: { ...(pending.meta ?? {}), prepared_for: today } }).eq('id', pending.id)
      }
      return pending.id
    }
    // Vieja y sin empezar: se reemplaza por una con los errores de hoy
    await admin.from('lessons').delete().eq('id', pending.id).eq('status', 'ready')
  }
  if (!(await assertDailyLimit(admin, userId, LESSON_FUNCTION, LESSON_MAX_PER_DAY))) return null
  const created = await createLesson(admin, userId, { prepared_for: today, prepared: true }, { allowFallback: false })
  return created.lesson_id
}

async function prepareExams(admin: SupabaseClient, userId: string): Promise<string[]> {
  const status = await examStatus(admin, userId)
  // El desbloqueo del panel de pruebas se usa a mano
  if (status.dev_unlock) return []
  const ids: string[] = []
  for (const kind of ['weekly', 'level'] as const) {
    const gate = kind === 'weekly' ? status.weekly : status.level
    if (!gate.available || gate.exam) continue
    if (!(await assertDailyLimit(admin, userId, EXAMS_FUNCTION, EXAMS_MAX_PER_DAY))) break
    try {
      const exam = await createExam(admin, userId, kind, status, { allowFallback: false })
      ids.push(exam.lesson_id)
    } catch (err) {
      // IA no disponible o examen ya creado: se reintenta en la próxima preparación
      if (!(err instanceof AIError) && !(err instanceof HttpError)) throw err
    }
  }
  return ids
}

/**
 * Si hay una preparación en curso (empezada hace < 3 min), espera a que la lección aparezca
 * (hasta ~25 s) en lugar de generar otra en paralelo.
 */
export async function waitForPrep(admin: SupabaseClient, userId: string) {
  const since = new Date(Date.now() - 3 * 60_000).toISOString()
  const { data: running } = await admin
    .from('daily_prep')
    .select('local_date')
    .eq('user_id', userId)
    .eq('status', 'running')
    .gte('started_at', since)
    .limit(1)
    .maybeSingle()
  if (!running) return null
  for (let i = 0; i < 17; i++) {
    await new Promise((r) => setTimeout(r, 1500))
    const pending = await findPendingLesson(admin, userId)
    if (pending) return pending
    const { data: row } = await admin.from('daily_prep').select('status').eq('user_id', userId).eq('local_date', running.local_date).maybeSingle()
    if (row?.status !== 'running') return findPendingLesson(admin, userId)
  }
  return null
}
