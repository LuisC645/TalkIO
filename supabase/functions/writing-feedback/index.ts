import { z } from 'npm:zod@4'
import { wordCount } from '../_shared/grading/checklist.ts'
import { gradeWriting } from '../_shared/grading/writing.ts'
import { HttpError, json, serve } from '../_shared/http.ts'
import { codesForPrompt } from '../_shared/patterns/catalog.ts'
import { recordDetectedErrors } from '../_shared/patterns/record.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'
import { assertDailyLimit } from '../_shared/usage.ts'

const FUNCTION = 'writing-feedback'
const MAX_PER_DAY = 40
const XP_ENTRIES_PER_DAY = 5
const MIN_WORDS = 5

const Body = z.object({
  text: z.string().trim().min(1).max(4000),
  prompt: z.string().trim().max(300).nullish(),
})

/**
 * POST /writing-feedback { text, prompt? } → corrección del texto libre del usuario.
 * Guarda el historial (writing_entries), registra los errores (y crea patrones nuevos del
 * catálogo) y da XP en las primeras entradas del día.
 */
serve(async (req) => {
  const admin = adminClient()
  const user = await requireUser(req, admin)
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) throw new HttpError(400, 'Escribe un texto en inglés (máximo 4000 caracteres).')
  const { text, prompt } = parsed.data
  if (wordCount(text) < MIN_WORDS) throw new HttpError(400, `Escribe al menos ${MIN_WORDS} palabras.`)

  // Antes de la IA, en paralelo: límite diario, patrones del usuario y XP de escritura de hoy
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString()
  const [allowed, { data: patterns }, { count: xpToday }] = await Promise.all([
    assertDailyLimit(admin, user.id, FUNCTION, MAX_PER_DAY),
    admin.from('error_patterns').select('code, title').eq('user_id', user.id),
    admin.from('xp_events').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('source', 'writing').gte('created_at', since),
  ])
  if (!allowed) throw new HttpError(429, 'Llegaste al límite diario de correcciones. Vuelve mañana.', 'daily_limit')

  const w = await gradeWriting(admin, { userId: user.id, functionName: FUNCTION }, { text, prompt }, codesForPrompt(patterns ?? []))

  const feedback = {
    fallback: !!w.fallback,
    explanation: w.feedback,
    corrected: w.corrected,
    errors: w.errors,
    checklist: w.checklist,
    words: w.words,
  }
  const { data: entry, error } = await admin
    .from('writing_entries')
    .insert({ user_id: user.id, prompt: prompt ?? null, text, score: w.score, feedback, model: w.model })
    .select('id, created_at')
    .single()
  if (error) throw error

  // XP solo en las primeras entradas del día (evita "farmear" XP); ~2 XP por minuto (un texto
  // ≈ 3-4 min); revisión básica sin IA: XP mínimo
  const xp = (xpToday ?? 0) < XP_ENTRIES_PER_DAY ? (w.fallback ? 2 : Math.round(2 + 6 * w.score)) : 0

  // Después de la IA, a la vez: registrar los errores y dar el XP
  const [{ created }] = await Promise.all([
    recordDetectedErrors(
      admin,
      user.id,
      [
        ...w.errors.map((e) => ({ code: e.code, wrong: e.fragment, right: e.correction, context: 'writing' })),
        ...w.checklist.map((c) => ({ code: c.code, wrong: c.examples[0] ?? c.label, right: '', context: 'writing' })),
      ],
      { source: 'writing' },
    ),
    xp ? admin.rpc('award_xp', { p_user_id: user.id, p_amount: xp, p_source: 'writing', p_ref_id: entry.id }) : null,
  ])

  return json({
    id: entry.id,
    created_at: entry.created_at,
    score: w.score,
    feedback,
    xp_awarded: xp,
    new_patterns: created,
  })
})
