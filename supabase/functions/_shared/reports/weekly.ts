import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@4'
import { AIError } from '../ai/provider.ts'
import { addDays, localDate, mondayOf } from '../exams/rules.ts'
import { callAI } from '../usage.ts'

export type WeeklyStats = {
  week_start: string
  week_end: string
  totals: { xp: number; active_minutes: number; exercises: number; lessons: number; reviews: number; days_active: number; days_goal_met: number }
  previous_week_xp: number
  attempts: { total: number; correct: number; accuracy: number | null }
  top_errors: { code: string; title: string; occurrences: number }[]
  mastered_patterns: { code: string; title: string }[]
  active_patterns: number
  streak: { current: number; longest: number } | null
  level: { level: number; total_xp: number } | null
}

const ReportOut = z.object({ report_md: z.string().min(40) })
const reportSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['report_md'],
  properties: { report_md: { type: 'string', description: 'Markdown en español, 120–200 palabras' } },
}
const SYSTEM = `You write a short weekly progress report for a Spanish-speaking adult learning English, IN SPANISH (second person, tú), in Markdown.
Structure: a one-line headline; "**Tu semana**" (2–3 sentences with the key numbers); "**Lo que mejoró**" (1–3 bullets); "**En qué enfocarte**" (1–3 bullets, concrete, based on the top errors); a closing sentence with one specific goal for next week.
Use ONLY the numbers provided; never invent data. If there was little or no activity, be kind and propose a small, realistic plan. 120–200 words. No emojis.`

/** Reporte con plantilla (sin IA), solo con los datos reales de la semana */
export function templateReport(s: WeeklyStats, name: string | null): string {
  const t = s.totals
  const acc = s.attempts.accuracy != null ? `${Math.round(s.attempts.accuracy * 100)}%` : null
  const delta = t.xp - (s.previous_week_xp ?? 0)
  const lines: string[] = []
  lines.push(t.days_active ? `### ${name ? `${name}, ` : ''}así fue tu semana` : '### Una semana tranquila')
  lines.push('')
  lines.push('**Tu semana**')
  if (t.days_active) {
    lines.push(
      `Practicaste ${t.days_active} de 7 días (${t.active_minutes} min), cumpliste tu meta ${t.days_goal_met} ${t.days_goal_met === 1 ? 'día' : 'días'} y sumaste ${t.xp} XP` +
        (s.previous_week_xp ? ` (${delta >= 0 ? '+' : ''}${delta} frente a la semana anterior).` : '.') +
        ` Completaste ${t.lessons} ${t.lessons === 1 ? 'lección' : 'lecciones'} y ${t.reviews} repasos` +
        (acc ? `, con ${acc} de aciertos en los ejercicios.` : '.'),
    )
  } else {
    lines.push('Esta semana no registraste actividad. No pasa nada: lo importante es retomar con sesiones cortas.')
  }
  lines.push('')
  lines.push('**Lo que mejoró**')
  if (s.mastered_patterns.length) for (const m of s.mastered_patterns) lines.push(`- Dominaste **${m.title}** (3 aciertos seguidos).`)
  else if (t.days_active) lines.push(`- Mantuviste la constancia${s.streak?.current ? `: tu racha va en ${s.streak.current} días` : ''}.`)
  else lines.push('- Tus errores activos siguen registrados: tu próxima lección los retoma.')
  lines.push('')
  lines.push('**En qué enfocarte**')
  if (s.top_errors.length) for (const e of s.top_errors.slice(0, 3)) lines.push(`- **${e.title}** (${e.occurrences} ${e.occurrences === 1 ? 'vez' : 'veces'} esta semana).`)
  else lines.push(`- Tienes ${s.active_patterns} errores en tu registro; una lección diaria los irá cerrando.`)
  lines.push('')
  lines.push(
    t.days_active >= 5
      ? 'Meta para la próxima semana: mantener el ritmo y cerrar uno de tus errores más frecuentes.'
      : `Meta para la próxima semana: practicar al menos ${Math.min(7, Math.max(3, t.days_active + 2))} días, aunque sean sesiones cortas.`,
  )
  return lines.join('\n')
}

/**
 * Asegura el reporte de la semana anterior (lunes a domingo, hora local del usuario).
 * Redacta con IA si hubo actividad y la IA está disponible; si no, usa la plantilla con los datos reales.
 * Devuelve el reporte creado o null si ya existía / no corresponde.
 */
export async function ensureWeeklyReport(admin: SupabaseClient, userId: string) {
  const { data: profile } = await admin.from('profiles').select('timezone, display_name, interests, created_at').eq('id', userId).single()
  if (!profile) return null
  const today = localDate(profile.timezone ?? 'UTC')
  const weekStart = addDays(mondayOf(today), -7)
  const weekEnd = addDays(weekStart, 6)
  // La cuenta tiene que haber existido durante esa semana
  if (localDate(profile.timezone ?? 'UTC', new Date(profile.created_at)) > weekEnd) return null

  const { data: existing } = await admin.from('weekly_reports').select('id').eq('user_id', userId).eq('week_start', weekStart).maybeSingle()
  if (existing) return null

  const { data: statsRaw, error } = await admin.rpc('get_weekly_stats', { p_user_id: userId, p_week_start: weekStart })
  if (error) throw error
  const stats = statsRaw as WeeklyStats
  const firstName = profile.display_name?.split(' ')[0] ?? null

  let content = templateReport(stats, firstName)
  let model = 'plantilla'
  // Semana sin actividad: la plantilla basta (no se gasta una petición de IA en "no hubo actividad")
  if (stats.totals.days_active > 0) try {
    const res = await callAI(admin, { userId, functionName: 'weekly-report' }, {
      tier: 'standard',
      system: SYSTEM,
      input: JSON.stringify({ learner_name: firstName, interests: profile.interests ?? [], week: stats }),
      responseSchema: reportSchema,
      temperature: 0.5,
      maxOutputTokens: 1500,
      thinking: 'low',
    })
    content = ReportOut.parse(res.data).report_md
    model = res.model
  } catch (err) {
    if (!(err instanceof AIError) && !(err instanceof z.ZodError)) throw err
  }

  const { data: report, error: insErr } = await admin
    .from('weekly_reports')
    .insert({ user_id: userId, week_start: weekStart, week_end: weekEnd, stats, content_md: content, model, email_status: 'pending' })
    .select('id, week_start')
    .single()
  if (insErr) {
    if (insErr.code === '23505') return null
    throw insErr
  }
  await admin.from('notifications').insert({
    user_id: userId,
    kind: 'report_ready',
    title: 'Tu reporte semanal está listo',
    body: `Resumen de tu semana del ${weekStart} al ${weekEnd}.`,
    link: `/settings/reports/${report.id}`,
    dedupe_key: `report:${weekStart}`,
  })
  return report
}
