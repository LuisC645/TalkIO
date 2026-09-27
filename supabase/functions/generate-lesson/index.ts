import { HttpError, json, serve } from '../_shared/http.ts'
import { createLesson, findPendingLesson, FUNCTION, MAX_PER_DAY } from '../_shared/lesson/generate.ts'
import { waitForPrep } from '../_shared/prep.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'
import { assertDailyLimit } from '../_shared/usage.ts'

/**
 * POST /generate-lesson → { lesson_id, reused }
 * Normalmente la lección ya está preparada en segundo plano (tarea programada o al abrir la app):
 * se devuelve al instante sin llamar a la IA. Si la preparación está en curso, se espera a que
 * termine; solo si no hay nada, se genera aquí.
 */
serve(async (req) => {
  const admin = adminClient()
  const user = await requireUser(req, admin)

  // 1) Lección pendiente (preparada o sin terminar)
  const pending = (await findPendingLesson(admin, user.id)) ?? (await waitForPrep(admin, user.id))
  if (pending) return json({ lesson_id: pending.id, reused: true })

  if (!(await assertDailyLimit(admin, user.id, FUNCTION, MAX_PER_DAY))) {
    throw new HttpError(429, 'Ya generaste varias lecciones hoy. Vuelve mañana para una nueva.', 'daily_limit')
  }

  // 2) Generar ahora (solo si no hubo preparación)
  return json(await createLesson(admin, user.id))
})
