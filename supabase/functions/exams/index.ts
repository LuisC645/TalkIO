import { z } from 'npm:zod@4'
import { createExam, FUNCTION, MAX_PER_DAY } from '../_shared/exams/create.ts'
import { examStatus } from '../_shared/exams/rules.ts'
import { HttpError, json, serve } from '../_shared/http.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'
import { assertDailyLimit } from '../_shared/usage.ts'

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('status') }),
  z.object({ action: z.literal('create'), kind: z.enum(['weekly', 'level']) }),
])

/**
 * Exámenes: status (desbloqueo y resultados) y create. Un examen es una lección con
 * kind = weekly_exam | level_exam: se juega en el mismo reproductor, en modo examen.
 * Cuando se desbloquea, la preparación en segundo plano ya lo deja creado: create lo devuelve
 * al instante (reused) sin llamar a la IA.
 */
serve(async (req) => {
  const admin = adminClient()
  const user = await requireUser(req, admin)
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) throw new HttpError(400, 'Acción inválida.')
  const body = parsed.data

  const status = await examStatus(admin, user.id)
  if (body.action === 'status') return json(status)

  const gate = body.kind === 'weekly' ? status.weekly : status.level
  if (gate.exam && gate.exam.status !== 'completed') return json({ lesson_id: gate.exam.id, reused: true })
  if (!gate.available) throw new HttpError(403, 'Este examen aún no está disponible.', 'locked')
  if (!(await assertDailyLimit(admin, user.id, FUNCTION, MAX_PER_DAY))) {
    throw new HttpError(429, 'Ya generaste varios exámenes hoy. Vuelve mañana.', 'daily_limit')
  }
  return json(await createExam(admin, user.id, body.kind, status))
})
