import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { localDate, mondayOf } from '../exams/rules.ts'
import { composeWeeklyReport, ensureWeeklyReport } from '../reports/weekly.ts'
import { sendEmail, unsubscribeUrl } from './resend.ts'
import { streakReminderEmail, weeklyReportEmail } from './templates.ts'

const STREAK_FROM_HOUR = 19
const STREAK_TO_HOUR = 21
const REPORT_FROM_HOUR = 8

type Kind = 'weekly_report' | 'streak_reminder'

/**
 * Reserva el envío en email_log (único por usuario + clave): si ya existe, otro proceso lo
 * envió o lo está enviando → false. Así nunca sale el mismo correo dos veces.
 */
async function claim(admin: SupabaseClient, userId: string, kind: Kind, dedupeKey: string) {
  const { error } = await admin.from('email_log').insert({ user_id: userId, kind, dedupe_key: dedupeKey, status: 'sent' })
  if (!error) return true
  if (error.code === '23505') return false
  throw error
}

type Delivery = { ok: boolean; to?: string; id?: string; error?: string }

async function deliver(
  admin: SupabaseClient,
  userId: string,
  kind: Kind,
  dedupeKey: string,
  build: (unsub: string) => { subject: string; html: string; text: string },
): Promise<Delivery> {
  const { data: auth } = await admin.auth.admin.getUserById(userId)
  const to = auth.user?.email
  if (!to) return { ok: false, error: 'La cuenta no tiene email' }
  if (!(await claim(admin, userId, kind, dedupeKey))) return { ok: false, to, error: 'Ya enviado' }
  try {
    const unsub = await unsubscribeUrl(userId)
    const { id, deliveredTo } = await sendEmail({ to, ...build(unsub), unsubscribeUrl: unsub })
    await admin.from('email_log').update({ provider_id: id }).eq('user_id', userId).eq('dedupe_key', dedupeKey)
    return { ok: true, to: deliveredTo, id }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await admin.from('email_log').update({ status: 'failed', error: message.slice(0, 500) }).eq('user_id', userId).eq('dedupe_key', dedupeKey)
    console.error(`correo ${kind} ${userId} falló:`, message)
    return { ok: false, to, error: message }
  }
}

/**
 * Envía por correo el reporte semanal más reciente (creado hace ≤ 3 días) si el usuario lo
 * activó; si no, lo marca como omitido. Los reportes viejos no se envían al activar los correos.
 */
export async function emailPendingReports(admin: SupabaseClient, userId: string) {
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString()
  const [{ data: profile }, { data: report }] = await Promise.all([
    admin.from('profiles').select('email_opt_in, display_name').eq('id', userId).single(),
    admin
      .from('weekly_reports')
      .select('id, week_start, content_md, stats')
      .eq('user_id', userId)
      .eq('email_status', 'pending')
      .gte('created_at', since)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (!report) return false
  if (!profile?.email_opt_in) {
    await admin.from('weekly_reports').update({ email_status: 'skipped' }).eq('id', report.id)
    return false
  }
  const xp = (report.stats as { totals?: { xp?: number } })?.totals?.xp ?? 0
  const name = profile.display_name?.split(' ')[0] ?? null
  const { ok: sent } = await deliver(admin, userId, 'weekly_report', `weekly:${report.week_start}`, (unsub) =>
    weeklyReportEmail({ name, contentMd: report.content_md, xp, unsubscribeUrl: unsub, reportId: report.id }),
  )
  const { data: log } = await admin.from('email_log').select('status').eq('user_id', userId).eq('dedupe_key', `weekly:${report.week_start}`).maybeSingle()
  if (log) await admin.from('weekly_reports').update({ email_status: log.status === 'sent' ? 'sent' : 'failed' }).eq('id', report.id)
  return sent
}

async function streakReminder(admin: SupabaseClient, userId: string, name: string | null, today: string) {
  const { data: p } = await admin
    .from('user_progress_view')
    .select('current_streak, today_goal_met, today_xp, daily_goal_xp')
    .eq('user_id', userId)
    .maybeSingle()
  if (!p || (p.current_streak ?? 0) < 1 || p.today_goal_met) return false
  const missingXp = Math.max(0, (p.daily_goal_xp ?? 50) - (p.today_xp ?? 0))
  const { ok } = await deliver(admin, userId, 'streak_reminder', `streak:${today}`, (unsub) =>
    streakReminderEmail({ name, streak: p.current_streak ?? 0, missingXp, unsubscribeUrl: unsub }),
  )
  return ok
}

/**
 * Correos programados (la tarea de cada hora): para quienes activaron los correos,
 *  - desde las 8:00 locales: asegura el reporte de la semana anterior y lo envía (una vez);
 *  - de 19:00 a 21:59 locales: recordatorio si la racha está en riesgo (una vez al día).
 */
export async function runScheduledEmails(admin: SupabaseClient, deadline: number) {
  if (!Deno.env.get('RESEND_API_KEY') && !Deno.env.get('BREVO_API_KEY')) return { sent: 0 }
  const { data: users } = await admin
    .from('profiles')
    .select('id, display_name, timezone')
    .eq('email_opt_in', true)
    .eq('onboarding_completed', true)
    .limit(500)
  let sent = 0
  for (const u of users ?? []) {
    if (Date.now() > deadline) break
    const tz = u.timezone ?? 'UTC'
    const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(new Date()))
    const name = u.display_name?.split(' ')[0] ?? null
    try {
      if (hour >= REPORT_FROM_HOUR) {
        await ensureWeeklyReport(admin, u.id)
        if (await emailPendingReports(admin, u.id)) sent++
      }
      if (hour >= STREAK_FROM_HOUR && hour <= STREAK_TO_HOUR && (await streakReminder(admin, u.id, name, localDate(tz)))) sent++
    } catch (err) {
      console.error(`correos programados ${u.id}:`, err)
    }
  }
  return { sent }
}

/**
 * Prueba desde el panel de administración: envía ya el reporte semanal (con la actividad de
 * esta semana, redactado igual que el real) o el recordatorio de racha, al email de la cuenta.
 * Asunto con "[Prueba]"; no guarda reportes (no bloquea el real del lunes) ni pide el
 * consentimiento de correos. Devuelve el resultado de Resend, incluido el motivo si falla.
 */
export async function sendTestEmail(admin: SupabaseClient, userId: string, kind: Kind): Promise<Delivery & { model?: string }> {
  const { data: profile } = await admin.from('profiles').select('display_name, interests, timezone').eq('id', userId).single()
  const name = profile?.display_name?.split(' ')[0] ?? null
  const key = `test:${kind}:${Date.now()}`
  if (kind === 'weekly_report') {
    const weekStart = mondayOf(localDate(profile?.timezone ?? 'UTC'))
    const { stats, content, model } = await composeWeeklyReport(
      admin,
      userId,
      { display_name: profile?.display_name ?? null, interests: profile?.interests ?? [] },
      weekStart,
    )
    const res = await deliver(admin, userId, kind, key, (unsub) =>
      weeklyReportEmail({ name, contentMd: content, xp: stats.totals.xp, unsubscribeUrl: unsub, reportId: null, test: true }),
    )
    return { ...res, model }
  }
  const { data: p } = await admin.from('user_progress_view').select('current_streak, today_xp, daily_goal_xp').eq('user_id', userId).maybeSingle()
  const missingXp = Math.max(0, (p?.daily_goal_xp ?? 50) - (p?.today_xp ?? 0))
  return deliver(admin, userId, kind, key, (unsub) =>
    streakReminderEmail({ name, streak: Math.max(1, p?.current_streak ?? 0), missingXp, unsubscribeUrl: unsub, test: true }),
  )
}
