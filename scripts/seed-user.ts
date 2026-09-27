/**
 * Carga el perfil inicial del usuario desde docs/user_seed.json.
 *
 *   npm run seed:user              → aplica
 *   npm run seed:user -- --dry-run → solo muestra qué haría
 *
 * Idempotente: solo inserta lo que falta. Nunca sobrescribe progreso existente
 * (rachas de patrones, estado FSRS de cartas, etc.). El perfil sí se actualiza.
 * Requiere en .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_USER_EMAIL.
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database, Json } from '../src/types/database.types.ts'

const DRY_RUN = process.argv.includes('--dry-run')
const SEED_PATH = new URL('../docs/user_seed.json', import.meta.url)

// ─── Esquema del seed ────────────────────────────────────────────────────────
const cefr = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const SeedSchema = z.object({
  version: z.literal(1),
  profile: z.object({
    display_name: z.string().min(1),
    timezone: z.string().min(1),
    native_language: z.string().min(2),
    cefr_level: cefr,
    cefr_plus: z.boolean(),
    daily_goal_xp: z.number().int().min(10).max(1000),
    daily_goal_minutes: z.number().int().min(5).max(240),
    onboarding_completed: z.boolean(),
    interests: z.array(z.string()),
    learner_context: z.record(z.string(), z.unknown()),
  }),
  assessment: z.object({
    source: z.literal('seed'),
    overall_cefr: cefr,
    overall_plus: z.boolean(),
    skills: z.record(z.string(), z.string()),
    notes: z.string().optional(),
  }),
  topics: z.array(
    z.object({
      slug: z.string().regex(/^[a-z0-9-]+$/),
      name: z.string(),
      category: z.string(),
      description: z.string().optional(),
      status: z.enum(['pending', 'practiced']),
      times_practiced: z.number().int().min(0).optional(),
      last_practiced_at: isoDate.optional(),
    }),
  ),
  error_patterns: z.array(
    z.object({
      code: z.string().regex(/^[a-z0-9_]+$/),
      title: z.string(),
      rule: z.string(),
      category: z.string(),
      skill: z.enum(['speaking', 'writing', 'both']),
      priority: z.number().int().min(1).max(5),
      correct_streak: z.number().int().min(0),
      status: z.enum(['active', 'mastered']),
      mastered_at: isoDate.optional(),
      occurrences: z.number().int().min(0),
      last_seen_at: isoDate.nullable(),
      examples: z.array(
        z.object({
          wrong: z.string(),
          correct: z.string(),
          context: z.string().optional(),
          date: isoDate,
        }),
      ),
    }),
  ),
  vocab: z.array(
    z.object({
      term: z.string(),
      wrong_form: z.string().optional(),
      translation: z.string().optional(),
      kind: z.enum(['word', 'collocation', 'false_friend', 'phrasal_verb', 'expression', 'structure']),
      topic: z.string().optional(),
      example: z.string().optional(),
      notes: z.string().optional(),
    }),
  ),
})

type Seed = z.infer<typeof SeedSchema>

// Las fechas del seed son días locales. Mediodía UTC cae en ese mismo día local
// para cualquier zona entre UTC-11 y UTC+11.
function dayToTimestamp(day: string): string {
  return `${day}T12:00:00Z`
}

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Falta ${name} en .env`)
  return value
}

async function main() {
  const seed: Seed = SeedSchema.parse(JSON.parse(readFileSync(SEED_PATH, 'utf8')))
  const topicSlugs = new Set(seed.topics.map((t) => t.slug))
  for (const v of seed.vocab) {
    if (v.topic && !topicSlugs.has(v.topic)) throw new Error(`Vocab "${v.term}" usa un topic inexistente: ${v.topic}`)
  }

  const supabase = createClient<Database>(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ─── Usuario ───────────────────────────────────────────────────────────────
  const email = env('SEED_USER_EMAIL').toLowerCase()
  let userId: string | undefined
  for (let page = 1; !userId; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id
    if (data.users.length < 200) break
  }
  if (!userId) throw new Error(`No existe un usuario con email ${email} en Supabase Auth`)

  const log = (msg: string) => console.log(`${DRY_RUN ? '[dry-run] ' : ''}${msg}`)
  log(`Usuario: ${email} (${userId})`)

  const must = <T>(res: { data: T | null; error: unknown }): T => {
    if (res.error) throw res.error
    return res.data as T
  }

  // ─── Perfil ────────────────────────────────────────────────────────────────
  log('Perfil: se actualiza (nivel, zona horaria, metas, intereses, contexto).')
  if (!DRY_RUN) {
    must(await supabase.from('profiles').update({ ...seed.profile, learner_context: seed.profile.learner_context as Json }).eq('id', userId))
  }

  // ─── Evaluación de nivel ───────────────────────────────────────────────────
  const existingAssessment = must(
    await supabase.from('level_assessments').select('id').eq('user_id', userId).eq('source', 'seed').limit(1),
  )
  if (existingAssessment.length) {
    log('Evaluación de nivel (seed): ya existe, se omite.')
  } else {
    log(`Evaluación de nivel: ${seed.assessment.overall_cefr}${seed.assessment.overall_plus ? '+' : ''}.`)
    if (!DRY_RUN) must(await supabase.from('level_assessments').insert({ user_id: userId, ...seed.assessment }))
  }

  // ─── Temas (catálogo global) + estado del usuario ──────────────────────────
  log(`Temas: upsert de ${seed.topics.length} en el catálogo.`)
  let topicIdBySlug = new Map<string, string>()
  if (!DRY_RUN) {
    const rows = must(
      await supabase
        .from('topics')
        .upsert(
          seed.topics.map(({ slug, name, category, description }) => ({ slug, name, category, description })),
          { onConflict: 'slug' },
        )
        .select('id, slug'),
    )
    topicIdBySlug = new Map(rows.map((r) => [r.slug, r.id]))

    const existingUserTopics = new Set(
      must(await supabase.from('user_topics').select('topic_id').eq('user_id', userId)).map((r) => r.topic_id),
    )
    const newUserTopics = seed.topics
      .map((t) => ({ t, topicId: topicIdBySlug.get(t.slug)! }))
      .filter(({ topicId }) => !existingUserTopics.has(topicId))
      .map(({ t, topicId }) => ({
        user_id: userId!,
        topic_id: topicId,
        status: t.status,
        times_practiced: t.times_practiced ?? 0,
        last_practiced_at: t.last_practiced_at ? dayToTimestamp(t.last_practiced_at) : null,
      }))
    log(`Temas del usuario: ${newUserTopics.length} nuevos.`)
    if (newUserTopics.length) must(await supabase.from('user_topics').insert(newUserTopics))
  }

  // ─── Patrones de error + ocurrencias ───────────────────────────────────────
  const existingPatterns = new Map(
    must(await supabase.from('error_patterns').select('id, code').eq('user_id', userId)).map((r) => [r.code, r.id]),
  )
  const newPatterns = seed.error_patterns.filter((p) => !existingPatterns.has(p.code))
  log(`Patrones de error: ${newPatterns.length} nuevos, ${seed.error_patterns.length - newPatterns.length} ya existían.`)
  const patternIdByCode = new Map(existingPatterns)
  if (!DRY_RUN && newPatterns.length) {
    const inserted = must(
      await supabase
        .from('error_patterns')
        .insert(
          newPatterns.map((p) => ({
            user_id: userId!,
            code: p.code,
            title: p.title,
            rule: p.rule,
            category: p.category,
            skill: p.skill,
            priority: p.priority,
            correct_streak: p.correct_streak,
            status: p.status,
            occurrences: p.occurrences,
            last_seen_at: p.last_seen_at ? dayToTimestamp(p.last_seen_at) : null,
            mastered_at: p.mastered_at ? dayToTimestamp(p.mastered_at) : null,
          })),
        )
        .select('id, code'),
    )
    for (const r of inserted) patternIdByCode.set(r.code, r.id)

    // Ocurrencias solo para patrones recién creados (evita duplicarlas al re-ejecutar)
    const occurrences = newPatterns.flatMap((p) =>
      p.examples.map((e) => ({
        user_id: userId!,
        pattern_id: patternIdByCode.get(p.code)!,
        wrong_text: e.wrong,
        corrected_text: e.correct,
        context: e.context ?? null,
        source: 'seed',
        occurred_at: dayToTimestamp(e.date),
      })),
    )
    log(`Ocurrencias de error: ${occurrences.length}.`)
    if (occurrences.length) must(await supabase.from('error_occurrences').insert(occurrences))
  } else if (DRY_RUN) {
    log(`Ocurrencias de error: ${newPatterns.reduce((n, p) => n + p.examples.length, 0)}.`)
  }

  // ─── Vocabulario ───────────────────────────────────────────────────────────
  const existingVocab = new Map(
    must(await supabase.from('vocab_items').select('id, term').eq('user_id', userId)).map((r) => [r.term.toLowerCase(), r.id]),
  )
  const newVocab = seed.vocab.filter((v) => !existingVocab.has(v.term.toLowerCase()))
  log(`Vocabulario: ${newVocab.length} nuevos, ${seed.vocab.length - newVocab.length} ya existían.`)
  const vocabIds = [...existingVocab.values()]
  if (!DRY_RUN && newVocab.length) {
    const inserted = must(
      await supabase
        .from('vocab_items')
        .insert(
          newVocab.map((v) => ({
            user_id: userId!,
            term: v.term,
            wrong_form: v.wrong_form ?? null,
            translation: v.translation ?? null,
            kind: v.kind,
            topic_id: v.topic ? (topicIdBySlug.get(v.topic) ?? null) : null,
            example: v.example ?? null,
            notes: v.notes ?? null,
          })),
        )
        .select('id'),
    )
    vocabIds.push(...inserted.map((r) => r.id))
  }

  // ─── Cartas SRS: todo el vocabulario + patrones activos ────────────────────
  const existingCards = must(await supabase.from('srs_cards').select('vocab_id, pattern_id').eq('user_id', userId))
  const vocabWithCard = new Set(existingCards.map((c) => c.vocab_id).filter(Boolean))
  const patternsWithCard = new Set(existingCards.map((c) => c.pattern_id).filter(Boolean))
  const activeCodes = new Set(seed.error_patterns.filter((p) => p.status === 'active').map((p) => p.code))

  const now = new Date().toISOString()
  const newCards = [
    ...vocabIds
      .filter((id) => !vocabWithCard.has(id))
      .map((id) => ({ user_id: userId!, item_type: 'vocab', vocab_id: id, due: now })),
    ...[...patternIdByCode.entries()]
      .filter(([code, id]) => activeCodes.has(code) && !patternsWithCard.has(id))
      .map(([, id]) => ({ user_id: userId!, item_type: 'pattern', pattern_id: id, due: now })),
  ]
  const expectedNewCards = DRY_RUN
    ? newVocab.length + seed.error_patterns.filter((p) => p.status === 'active' && !existingPatterns.has(p.code)).length
    : newCards.length
  log(`Cartas SRS: ${expectedNewCards} nuevas (estado New, vencen hoy).`)
  if (!DRY_RUN && newCards.length) must(await supabase.from('srs_cards').insert(newCards))

  log(DRY_RUN ? 'Dry-run terminado: no se escribió nada.' : 'Seed aplicado.')
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
