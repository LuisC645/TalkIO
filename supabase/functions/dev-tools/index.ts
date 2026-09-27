import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@4'
import { HttpError, json, serve } from '../_shared/http.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'

/**
 * Herramientas de prueba (panel "Pruebas" del dashboard). Solo actúa sobre los datos de quien
 * llama y solo si el secreto DEV_TOOLS_ENABLED=true está configurado (apagado = 403).
 */
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('stats') }),
  z.object({ action: z.literal('add_xp'), amount: z.number().int().min(1).max(500) }),
  z.object({ action: z.literal('simulate_streak'), days: z.number().int().min(1).max(60) }),
  z.object({ action: z.literal('make_cards_due'), count: z.number().int().min(1).max(100) }),
  z.object({ action: z.literal('discard_active_lesson') }),
  z.object({ action: z.literal('reset_progress') }),
  z.object({ action: z.literal('reset_reviews') }),
  z.object({ action: z.literal('reset_patterns') }),
  z.object({ action: z.literal('unlock_exams') }),
])

serve(async (req) => {
  if (Deno.env.get('DEV_TOOLS_ENABLED') !== 'true') throw new HttpError(403, 'Las herramientas de prueba están desactivadas.')
  const admin = adminClient()
  const user = await requireUser(req, admin)
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) throw new HttpError(400, 'Acción inválida.')
  const body = parsed.data
  const uid = user.id

  switch (body.action) {
    case 'stats':
      return json({ stats: await stats(admin, uid) })

    case 'add_xp': {
      await rpc(admin, 'award_xp', { p_user_id: uid, p_amount: body.amount, p_source: 'adjustment', p_ref_id: null })
      return json({ message: `+${body.amount} XP agregados.` })
    }

    case 'simulate_streak': {
      const today = await localToday(admin, uid)
      const { data: profile } = await admin.from('profiles').select('daily_goal_xp').eq('id', uid).single()
      const goal = profile?.daily_goal_xp ?? 50
      const { data: activity } = await admin.from('daily_activity').select('local_date, xp').eq('user_id', uid)
      const xpByDay = new Map((activity ?? []).map((a) => [a.local_date, a.xp]))
      // Del día más antiguo al más reciente, completando la meta de los días que falten
      const rows = []
      for (let i = body.days; i >= 1; i--) {
        const date = addDays(today, -i)
        const missing = goal - (xpByDay.get(date) ?? 0)
        if (missing > 0) rows.push({ user_id: uid, amount: missing, source: 'adjustment', local_date: date })
      }
      if (rows.length) {
        const { error } = await admin.from('xp_events').insert(rows)
        if (error) throw error
      }
      await recomputeStreak(admin, uid, today)
      return json({ message: `Racha simulada: ${body.days} días anteriores con la meta cumplida.` })
    }

    case 'make_cards_due': {
      const { data: cards } = await admin
        .from('srs_cards')
        .select('id')
        .eq('user_id', uid)
        .gt('state', 0)
        .gt('due', new Date().toISOString())
        .order('due')
        .limit(body.count)
      const ids = (cards ?? []).map((c) => c.id)
      if (ids.length) {
        const { error } = await admin.from('srs_cards').update({ due: new Date(Date.now() - 60_000).toISOString() }).in('id', ids)
        if (error) throw error
      }
      return json({
        message: ids.length
          ? `${ids.length} tarjetas ahora están vencidas.`
          : 'No hay tarjetas ya estudiadas para adelantar. Repasa algunas primero.',
      })
    }

    case 'discard_active_lesson': {
      const { data, error } = await admin
        .from('lessons')
        .delete()
        .eq('user_id', uid)
        .in('status', ['ready', 'in_progress', 'generating'])
        .select('id')
      if (error) throw error
      return json({ message: data?.length ? 'Lección activa descartada. Puedes generar otra.' : 'No había lección activa.' })
    }

    case 'reset_progress': {
      await must(admin.from('xp_events').delete().eq('user_id', uid))
      await must(admin.from('daily_activity').delete().eq('user_id', uid))
      await must(
        admin
          .from('user_progress')
          .update({ total_xp: 0, level: 1, current_streak: 0, longest_streak: 0, last_goal_date: null, streak_freezes: 0 })
          .eq('user_id', uid),
      )
      return json({ message: 'XP, nivel, racha y actividad reiniciados.' })
    }

    case 'reset_reviews': {
      await must(admin.from('srs_review_logs').delete().eq('user_id', uid))
      await must(
        admin
          .from('srs_cards')
          .update({
            due: new Date().toISOString(),
            stability: 0,
            difficulty: 0,
            elapsed_days: 0,
            scheduled_days: 0,
            learning_steps: 0,
            reps: 0,
            lapses: 0,
            state: 0,
            last_review: null,
          })
          .eq('user_id', uid),
      )
      return json({ message: 'Todas las tarjetas volvieron a "sin estudiar".' })
    }

    case 'unlock_exams': {
      const { data: p } = await admin.from('profiles').select('learner_context').eq('id', uid).single()
      const lc = { ...((p?.learner_context as Record<string, unknown>) ?? {}), dev_unlock_exams: true }
      await must(admin.from('profiles').update({ learner_context: lc }).eq('id', uid))
      return json({ message: 'Desbloqueado: tu próximo examen (semanal o de nivel) se puede crear sin requisitos.' })
    }

    case 'reset_patterns': {
      await must(
        admin
          .from('error_patterns')
          .update({ correct_streak: 0, status: 'active', mastered_at: null })
          .eq('user_id', uid)
          .eq('status', 'mastered'),
      )
      return json({ message: 'Los errores dominados volvieron a estar activos (racha 0 de 3).' })
    }
  }
})

async function must<T extends { error: unknown }>(p: PromiseLike<T>): Promise<T> {
  const res = await p
  if (res.error) throw res.error
  return res
}

async function rpc(admin: SupabaseClient, fn: string, args: Record<string, unknown>) {
  const { error } = await admin.rpc(fn, args)
  if (error) throw error
}

async function localToday(admin: SupabaseClient, uid: string): Promise<string> {
  const { data, error } = await admin.rpc('user_local_date', { p_user_id: uid })
  if (error) throw error
  return data as string
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Racha = días consecutivos con meta cumplida que terminan hoy o ayer */
async function recomputeStreak(admin: SupabaseClient, uid: string, today: string) {
  const { data } = await admin.from('daily_activity').select('local_date').eq('user_id', uid).eq('goal_met', true)
  const met = new Set((data ?? []).map((d) => d.local_date as string))
  let end = met.has(today) ? today : met.has(addDays(today, -1)) ? addDays(today, -1) : null
  let current = 0
  const last = end
  while (end && met.has(end)) {
    current++
    end = addDays(end, -1)
  }
  // Racha más larga en todo el historial
  const sorted = [...met].sort()
  let longest = 0
  let run = 0
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && addDays(sorted[i - 1], 1) === sorted[i] ? run + 1 : 1
    longest = Math.max(longest, run)
  }
  await must(
    admin.from('user_progress').update({ current_streak: current, longest_streak: longest, last_goal_date: last }).eq('user_id', uid),
  )
}

async function stats(admin: SupabaseClient, uid: string) {
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString()
  const [usage, cards, lessons] = await Promise.all([
    admin.from('ai_usage').select('function_name, input_tokens, output_tokens, success').eq('user_id', uid).gte('created_at', since),
    admin.from('srs_cards').select('state').eq('user_id', uid),
    admin.from('lessons').select('status').eq('user_id', uid),
  ])
  const u = usage.data ?? []
  return {
    ai_calls_24h: u.length,
    ai_failures_24h: u.filter((r) => !r.success).length,
    tokens_in_24h: u.reduce((s, r) => s + r.input_tokens, 0),
    tokens_out_24h: u.reduce((s, r) => s + r.output_tokens, 0),
    cards_new: (cards.data ?? []).filter((c) => c.state === 0).length,
    cards_studied: (cards.data ?? []).filter((c) => c.state > 0).length,
    lessons_completed: (lessons.data ?? []).filter((l) => l.status === 'completed').length,
    lessons_active: (lessons.data ?? []).filter((l) => l.status !== 'completed' && l.status !== 'failed').length,
  }
}
