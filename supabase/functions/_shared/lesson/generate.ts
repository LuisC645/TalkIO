import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { AIError } from '../ai/provider.ts'
import { HttpError } from '../http.ts'
import { CATALOG_BY_CODE, suggestedFocus, type CatalogPattern } from '../patterns/catalog.ts'
import { callAI } from '../usage.ts'
import { FALLBACK_PROMPT_VERSION, pastExercisesForReview } from './fallback.ts'
import { LESSON_PROMPT_VERSION, lessonInput, lessonSystemPrompt, type LessonContext } from './prompt.ts'
import { levelGuidePrompt, loadLevelGuide } from './levels.ts'
import { buildExercise, LessonOutput, lessonJsonSchema, type BuiltExercise } from './schema.ts'

export const FUNCTION = 'generate-lesson'
export const MAX_PER_DAY = 6
const FOCUS_COUNT = 3

export type CreatedLesson = { lesson_id: string; reused: boolean; fallback?: boolean }

/**
 * Lección sin terminar (lista o en curso), la más reciente. Si el usuario cambió de nivel desde
 * que se preparó y aún no la empezó, se descarta para generar una acorde al nivel nuevo.
 */
export async function findPendingLesson(admin: SupabaseClient, userId: string) {
  const [{ data }, { data: profile }] = await Promise.all([
    admin
      .from('lessons')
      .select('id, status, generated_at, meta, cefr_level')
      .eq('user_id', userId)
      .eq('kind', 'lesson')
      .in('status', ['ready', 'in_progress'])
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from('profiles').select('cefr_level, cefr_plus').eq('id', userId).single(),
  ])
  const lesson = data as { id: string; status: string; generated_at: string; meta: Record<string, unknown> | null; cefr_level: string | null } | null
  if (lesson?.status === 'ready' && profile?.cefr_level) {
    const current = `${profile.cefr_level}${profile.cefr_plus ? '+' : ''}`
    // Las lecciones anteriores a meta.cefr solo guardan el nivel base
    const stale = typeof lesson.meta?.cefr === 'string' ? lesson.meta.cefr !== current : lesson.cefr_level !== profile.cefr_level
    if (stale) {
      const { count } = await admin.from('exercise_attempts').select('id', { count: 'exact', head: true }).eq('lesson_id', lesson.id)
      if (!count) {
        await admin.from('lessons').delete().eq('id', lesson.id).eq('status', 'ready')
        return null
      }
    }
  }
  return lesson
}

/**
 * Genera una lección nueva con los errores activos del usuario, su vocabulario pendiente y sus
 * temas (IA con 1 reintento si la salida no valida; sin IA → lección de repaso). La usan la app
 * (generate-lesson) y la preparación en segundo plano (_shared/prep.ts). `meta` se guarda en la
 * lección (p. ej. { prepared_for: '2026-09-28' }).
 */
export async function createLesson(
  admin: SupabaseClient,
  userId: string,
  meta: Record<string, unknown> = {},
  // Sin IA → lección de repaso. La preparación en segundo plano lo desactiva: prefiere reintentar
  { allowFallback = true }: { allowFallback?: boolean } = {},
): Promise<CreatedLesson> {
  // 2) Contexto
  const ctx = await loadContext(admin, userId)

  // 3) IA (1 reintento si la salida no valida)
  const system = lessonSystemPrompt(ctx.profile)
  let input = lessonInput(ctx)
  let output: LessonOutput | null = null
  let built: BuiltExercise[] = []
  let usedModel: string | null = null
  for (let attempt = 0; attempt < 2 && !output; attempt++) {
    let ai: { data: unknown; model: string }
    try {
      ai = await callAI(admin, { userId: userId, functionName: FUNCTION }, {
        tier: 'standard',
        system,
        input,
        responseSchema: lessonJsonSchema as unknown as Record<string, unknown>,
        temperature: 0.8,
        maxOutputTokens: 16000,
        thinking: 'low',
      })
    } catch (err) {
      if (err instanceof AIError) {
        if (!allowFallback) throw err
        return await reviewLessonWithoutAI(admin, userId, ctx.profile.cefr, meta)
      }
      throw err
    }
    const { data: raw, model } = ai
    usedModel = model
    const parsed = LessonOutput.safeParse(raw)
    if (!parsed.success) {
      input += `\n\nYour previous output was invalid: ${parsed.error.message.slice(0, 600)}. Fix it.`
      continue
    }
    const results = parsed.data.exercises.map(buildExercise)
    built = results.filter((r): r is BuiltExercise => typeof r !== 'string')
    const problems = results.filter((r): r is string => typeof r === 'string')
    if (built.length >= 6) output = parsed.data
    else input += `\n\nYour previous output had invalid exercises: ${problems.join('; ')}. Fix them.`
  }
  if (!output) throw new HttpError(502, 'No se pudo generar una lección válida. Vuelve a intentarlo.', 'generation_failed')

  // 4) Guardar
  const codes = new Map(ctx.allPatterns.map((p) => [p.code, p.id]))
  const topicId = ctx.topicIds.get(output.topic_slug) ?? null
  const focusIds = output.focus_codes.map((c) => codes.get(c)).filter((x): x is string => !!x)

  const { data: lesson, error: lessonError } = await admin
    .from('lessons')
    .insert({
      user_id: userId,
      title: output.title,
      cefr_level: ctx.cefrBase,
      focus_pattern_ids: focusIds.length ? focusIds : ctx.focus.map((f) => codes.get(f.code)!).filter(Boolean),
      topic_id: topicId,
      status: 'ready',
      content: { rule: output.rule, new_vocabulary: output.new_vocabulary, topic_slug: output.topic_slug, focus_codes: output.focus_codes },
      model: usedModel,
      prompt_version: LESSON_PROMPT_VERSION,
      meta: { ...meta, cefr: ctx.profile.cefr },
    })
    .select('id')
    .single()
  if (lessonError) throw lessonError

  const vocabIds = new Map(ctx.vocabRows.map((v) => [v.term.toLowerCase(), v.id]))
  for (const [term, id] of await saveNewVocabulary(admin, userId, output.new_vocabulary, topicId)) vocabIds.set(term, id)
  const ordered = [...built].sort((a, b) => phaseOrder(a.phase) - phaseOrder(b.phase))
  const { error: exError } = await admin.from('exercises').insert(
    ordered.map((e, i) => ({
      lesson_id: lesson.id,
      user_id: userId,
      position: i + 1,
      phase: e.phase,
      type: e.type,
      payload: e.payload,
      answer_key: e.answer_key,
      grading: e.grading,
      target_pattern_id: e.target_code ? (codes.get(e.target_code) ?? null) : null,
      target_vocab_id: e.target_term ? (vocabIds.get(e.target_term.toLowerCase()) ?? null) : null,
    })),
  )
  if (exError) {
    await admin.from('lessons').delete().eq('id', lesson.id)
    throw exError
  }

  return { lesson_id: lesson.id, reused: false }
}

const phaseOrder = (p: string) => ({ warmup: 0, drill: 1, free: 2 })[p] ?? 1

/**
 * Palabras nuevas de la lección → vocab_items del usuario con su tarjeta de repaso (SRS).
 * Las que ya tenía se reutilizan. Devuelve término (minúsculas) → id para enlazar los ejercicios.
 */
async function saveNewVocabulary(
  admin: SupabaseClient,
  userId: string,
  words: LessonOutput['new_vocabulary'],
  topicId: string | null,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>()
  const unique = [...new Map(words.map((w) => [w.term.toLowerCase(), w])).values()]
  if (!unique.length) return ids
  const { data: existing } = await admin.from('vocab_items').select('id, term').eq('user_id', userId)
  for (const v of existing ?? []) ids.set(v.term.toLowerCase(), v.id)
  const fresh = unique.filter((w) => !ids.has(w.term.toLowerCase()))
  if (!fresh.length) return ids
  const { data: inserted, error } = await admin
    .from('vocab_items')
    .insert(
      fresh.map((w) => ({
        user_id: userId,
        term: w.term,
        translation: w.translation,
        example: w.example || null,
        kind: w.term.includes(' ') ? 'expression' : 'word',
        topic_id: topicId,
        notes: 'Vocabulario nuevo de una lección',
      })),
    )
    .select('id, term')
  // Sin vocabulario nuevo la lección sigue siendo válida
  if (error) {
    console.error('vocabulario nuevo:', error.message)
    return ids
  }
  for (const v of inserted ?? []) ids.set(v.term.toLowerCase(), v.id)
  if (inserted?.length) {
    await admin.from('srs_cards').insert(inserted.map((v) => ({ user_id: userId, item_type: 'vocab', vocab_id: v.id })))
  }
  return ids
}

/**
 * Sin IA: lección de repaso con ejercicios anteriores (primero los fallados). Si el usuario aún no
 * tiene historial suficiente, se informa que la IA no está disponible.
 */
async function reviewLessonWithoutAI(admin: SupabaseClient, userId: string, cefr: string, meta: Record<string, unknown>) {
  const rows = await pastExercisesForReview(admin, userId, { limit: 8 })
  if (rows.length < 4) {
    throw new HttpError(
      503,
      'La IA no está disponible ahora y todavía no tienes ejercicios anteriores para una lección de repaso. Vuelve a intentarlo en un rato.',
      'ai_busy',
    )
  }
  const focus = [...new Set(rows.map((r) => r.target_pattern_id).filter((x): x is string => !!x))].slice(0, 3)
  const { data: lesson, error } = await admin
    .from('lessons')
    .insert({
      user_id: userId,
      title: 'Repaso de tus errores',
      cefr_level: cefr.replace('+', ''),
      focus_pattern_ids: focus,
      status: 'ready',
      content: { rule: null, fallback: true, covers: 'Ejercicios anteriores, empezando por los que fallaste' },
      model: 'sin-ia',
      prompt_version: FALLBACK_PROMPT_VERSION,
      meta: { ...meta, cefr },
    })
    .select('id')
    .single()
  if (error) throw error
  const { error: exError } = await admin
    .from('exercises')
    .insert(rows.map((r, i) => ({ ...r, lesson_id: lesson.id, user_id: userId, position: i + 1 })))
  if (exError) {
    await admin.from('lessons').delete().eq('id', lesson.id)
    throw exError
  }
  return { lesson_id: lesson.id, reused: false, fallback: true }
}

async function loadContext(admin: SupabaseClient, userId: string) {
  const [profileRes, assessmentRes, patternsRes, topicsRes, userTopicsRes, recentRes, cardsRes] = await Promise.all([
    admin.from('profiles').select('display_name, cefr_level, cefr_plus, interests, learner_context').eq('id', userId).single(),
    admin.from('level_assessments').select('skills').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('error_patterns').select('id, code, title, rule, skill, priority, correct_streak, occurrences, status').eq('user_id', userId),
    admin.from('topics').select('id, slug, name'),
    admin.from('user_topics').select('topic_id, status, times_practiced').eq('user_id', userId),
    admin.from('lessons').select('title, focus_pattern_ids').eq('user_id', userId).eq('kind', 'lesson').order('generated_at', { ascending: false }).limit(5),
    admin
      .from('srs_cards')
      .select('vocab_id, due')
      .eq('user_id', userId)
      .eq('item_type', 'vocab')
      .lte('due', new Date().toISOString())
      .order('due')
      .limit(8),
  ])
  if (profileRes.error) throw profileRes.error

  const profile = profileRes.data
  const allPatterns = patternsRes.data ?? []
  const active = allPatterns.filter((p) => p.status === 'active')
  const lastFocus = new Set<string>((recentRes.data?.[0]?.focus_pattern_ids as string[] | undefined) ?? [])

  const cefrBase = profile.cefr_level ?? 'A2'
  const cefr = `${cefrBase}${profile.cefr_plus ? '+' : ''}`
  const guide = await loadLevelGuide(admin, cefr)
  // Errores de estructuras por encima del nivel (p. ej. pasado para un A1) no son foco todavía
  const blocked = new Set(guide?.blocked_patterns ?? [])

  // Prioridad alta y poco dominado primero; se rota lo que fue foco de la última lección
  const scored = active
    .filter((p) => !blocked.has(p.code))
    .map((p) => ({ p, score: p.priority * 10 - p.correct_streak * 4 + Math.min(p.occurrences, 8) - (lastFocus.has(p.id) ? 12 : 0) }))
    .sort((a, b) => b.score - a.score)
  const focusRows = scored.slice(0, FOCUS_COUNT).map((s) => s.p)

  const { data: examples } = focusRows.length
    ? await admin
        .from('error_occurrences')
        .select('pattern_id, wrong_text, corrected_text')
        .in('pattern_id', focusRows.map((p) => p.id))
        .order('occurred_at', { ascending: false })
        .limit(30)
    : { data: [] }

  // Términos que ya conoce (los más recientes), para no repetirlos como vocabulario nuevo
  const knownRes = await admin.from('vocab_items').select('term').eq('user_id', userId).order('created_at', { ascending: false }).limit(80)

  const vocabIdsDue = (cardsRes.data ?? []).map((c) => c.vocab_id).filter(Boolean) as string[]
  const { data: vocabRows } = vocabIdsDue.length
    ? await admin.from('vocab_items').select('id, term, wrong_form, translation').in('id', vocabIdsDue)
    : await admin.from('vocab_items').select('id, term, wrong_form, translation').eq('user_id', userId).limit(6)

  // Temas: primero pendientes, luego los menos practicados
  const ut = new Map((userTopicsRes.data ?? []).map((t) => [t.topic_id, t]))
  const topics = (topicsRes.data ?? [])
    .filter((t) => ut.has(t.id))
    .map((t) => ({ ...t, status: ut.get(t.id)!.status, times: ut.get(t.id)!.times_practiced }))
    .sort((a, b) => (a.status === b.status ? a.times - b.times : a.status === 'pending' ? -1 : 1))
    .slice(0, 5)
  const topicCandidates = topics.length ? topics : (topicsRes.data ?? []).slice(0, 5).map((t) => ({ ...t, status: 'pending', times: 0 }))

  const lc = (profile.learner_context ?? {}) as Record<string, unknown>
  const levelFocus = guide?.focus_codes.length
    ? guide.focus_codes.map((c) => CATALOG_BY_CODE.get(c)).filter((c): c is CatalogPattern => !!c)
    : suggestedFocus(cefrBase)

  const context: LessonContext & {
    allPatterns: typeof allPatterns
    topicIds: Map<string, string>
    vocabRows: { id: string; term: string }[]
    cefrBase: string
  } = {
    profile: {
      display_name: profile.display_name,
      cefr,
      skills: (assessmentRes.data?.skills as Record<string, string>) ?? {},
      interests: (profile.interests as string[]) ?? [],
      learner_context: lc,
      level_guide: levelGuidePrompt(cefr, guide),
    },
    focus: [
      ...focusRows.map((p) => ({
        code: p.code,
        title: p.title,
        rule: p.rule,
        skill: p.skill,
        correct_streak: p.correct_streak,
        examples: (examples ?? [])
          .filter((e) => e.pattern_id === p.id)
          .slice(0, 2)
          .map((e) => ({ wrong: e.wrong_text, right: e.corrected_text })),
      })),
      // Usuario nuevo con pocos errores registrados: se completa con errores típicos de su nivel
      ...levelFocus
        .filter((c) => !focusRows.some((p) => p.code === c.code))
        .slice(0, Math.max(0, FOCUS_COUNT - focusRows.length))
        .map((c) => ({ code: c.code, title: c.title, rule: c.rule, skill: c.skill, correct_streak: 0, examples: [] })),
    ],
    otherCodes: active.filter((p) => !focusRows.includes(p) && !blocked.has(p.code)).map((p) => p.code),
    vocab: (vocabRows ?? []).slice(0, 6).map((v) => ({ term: v.term, wrong_form: v.wrong_form, translation: v.translation })),
    knownTerms: (knownRes.data ?? []).map((v) => v.term),
    topics: topicCandidates.map((t) => ({ slug: t.slug, name: t.name, status: t.status })),
    recentTitles: (recentRes.data ?? []).map((l) => l.title),
    roadmapFocus: roadmapFocus(lc),
    allPatterns,
    topicIds: new Map(topicCandidates.map((t) => [t.slug, t.id])),
    vocabRows: vocabRows ?? [],
    cefrBase,
  }
  return context
}

/** Semana del plan de estudio → foco del roadmap del seed (si existe) */
function roadmapFocus(lc: Record<string, unknown>): string | null {
  const plan = lc.study_plan as { started_on?: string } | undefined
  const roadmap = lc.roadmap as { weeks: string; focus: string }[] | undefined
  if (!plan?.started_on || !roadmap?.length) return null
  const week = Math.floor((Date.now() - new Date(plan.started_on).getTime()) / (7 * 86_400_000)) + 1
  const match = roadmap.find((r) => {
    const [a, b] = r.weeks.replace('+', '').split('-').map(Number)
    return week >= a && week <= (b || a)
  })
  return match ? `Semana ${week}: ${match.focus}` : null
}
