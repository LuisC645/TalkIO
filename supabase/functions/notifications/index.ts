import { z } from 'npm:zod@4'
import { examStatus, localDate } from '../_shared/exams/rules.ts'
import { HttpError, json, serve } from '../_shared/http.ts'
import { emailPendingReports } from '../_shared/email/scheduled.ts'
import { inBackground, prepareToday } from '../_shared/prep.ts'
import { ensureWeeklyReport } from '../_shared/reports/weekly.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'

const Body = z.object({ action: z.literal('sync') })
const STREAK_RISK_HOUR = 18

/**
 * Sincroniza las notificaciones del usuario (la app lo llama al abrir y cada cierto tiempo):
 *  - reporte semanal de la semana anterior (se genera si falta)
 *  - racha en riesgo (desde las 18:00 locales, si hay racha y la meta de hoy no está cumplida)
 *  - examen semanal / de nivel disponible
 * Cada una tiene dedupe_key: nunca se repite la misma.
 * Además, en segundo plano, deja preparada la lección del día (y los exámenes desbloqueados)
 * si la tarea programada aún no lo hizo.
 */
serve(async (req) => {
  const admin = adminClient()
  const user = await requireUser(req, admin)
  if (!Body.safeParse(await req.json().catch(() => null)).success) throw new HttpError(400, 'Acción inválida.')
  const uid = user.id
  const toInsert: Record<string, unknown>[] = []

  await ensureWeeklyReport(admin, uid).catch((err) => console.error('reporte semanal:', err))
  // Si el reporte se acaba de generar y el usuario activó los correos, se envía (una vez)
  inBackground(emailPendingReports(admin, uid))

  const [{ data: profile }, { data: progress }] = await Promise.all([
    admin.from('profiles').select('timezone, onboarding_completed').eq('id', uid).single(),
    admin.from('user_progress_view').select('current_streak, today_goal_met, today_xp, daily_goal_xp').eq('user_id', uid).maybeSingle(),
  ])
  if (!profile?.onboarding_completed) return json({ created: 0 })
  inBackground(prepareToday(admin, uid, 'app'))
  const tz = profile.timezone ?? 'UTC'
  const today = localDate(tz)
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(new Date()))

  if (progress && (progress.current_streak ?? 0) > 0 && !progress.today_goal_met && hour >= STREAK_RISK_HOUR) {
    const missing = Math.max(0, (progress.daily_goal_xp ?? 50) - (progress.today_xp ?? 0))
    toInsert.push({
      user_id: uid,
      kind: 'streak_risk',
      title: `Tu racha de ${progress.current_streak} ${progress.current_streak === 1 ? 'día' : 'días'} está en riesgo`,
      body: `Te faltan ${missing} XP para la meta de hoy. Un repaso corto basta para empezar.`,
      link: '/review',
      dedupe_key: `streak:${today}`,
    })
  }

  const exams = await examStatus(admin, uid)
  if (exams.weekly.available) {
    toInsert.push({
      user_id: uid,
      kind: 'exam_available',
      title: 'Tu examen semanal está disponible',
      body: '10 preguntas sobre lo que practicaste esta semana.',
      link: '/lessons',
      dedupe_key: `weekly:${exams.weekly.week_start}`,
    })
  }
  if (exams.level.available && exams.level.target && !exams.dev_unlock) {
    toInsert.push({
      user_id: uid,
      kind: 'exam_available',
      title: `Ya puedes presentar el examen para ${exams.level.target}`,
      body: `Con ${exams.level.pass_threshold}% o más subes de nivel.`,
      link: '/lessons',
      dedupe_key: `levelexam:${exams.level.target}:${exams.level.last?.id ?? 'first'}`,
    })
  }

  let created = 0
  for (const n of toInsert) {
    const { error } = await admin.from('notifications').insert(n)
    if (!error) created++
    else if (error.code !== '23505') throw error // 23505 = ya existía (dedupe)
  }
  return json({ created })
})
