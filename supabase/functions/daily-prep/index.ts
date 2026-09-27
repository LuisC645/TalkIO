import { HttpError, json, serve } from '../_shared/http.ts'
import { runScheduledEmails } from '../_shared/email/scheduled.ts'
import { inBackground, prepareToday } from '../_shared/prep.ts'
import { adminClient } from '../_shared/supabase.ts'

// Presupuesto de tiempo por ejecución (el límite de una Edge Function es mayor); lo que no
// alcance se prepara en la hora siguiente o cuando el usuario abra la app
const BUDGET_MS = 110_000
const BATCH = 20

/**
 * POST /daily-prep (tarea programada, cada hora vía pg_cron). No la llama la app: exige el
 * secreto de Vault en la cabecera x-prep-secret. Responde al instante y, en segundo plano,
 * prepara la lección del día (y los exámenes desbloqueados) de los usuarios pendientes y envía
 * los correos programados.
 */
serve(async (req) => {
  const admin = adminClient()
  const secret = req.headers.get('x-prep-secret') ?? ''
  const { data: ok } = secret ? await admin.rpc('verify_prep_secret', { p_secret: secret }) : { data: false }
  if (!ok) throw new HttpError(401, 'No autorizado.')

  const { data: users, error } = await admin.rpc('due_prep_users', { p_limit: BATCH })
  if (error) throw error
  const ids = ((users ?? []) as { user_id: string }[]).map((u) => u.user_id)

  inBackground(
    (async () => {
      const deadline = Date.now() + BUDGET_MS
      for (const id of ids) {
        if (Date.now() > deadline) break
        await prepareToday(admin, id, 'cron')
      }
      // Correos programados (reporte semanal, racha en riesgo) de quienes los activaron
      const { sent } = await runScheduledEmails(admin, deadline)
      if (sent) console.log(`correos enviados: ${sent}`)
    })(),
  )
  return json({ queued: ids.length }, 202)
})
