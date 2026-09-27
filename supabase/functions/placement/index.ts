import { z } from 'npm:zod@4'
import { AIError } from '../_shared/ai/provider.ts'
import { runChecklist, wordCount } from '../_shared/grading/checklist.ts'
import { HttpError, json, serve } from '../_shared/http.ts'
import { PATTERN_CATALOG } from '../_shared/patterns/catalog.ts'
import { recordDetectedErrors } from '../_shared/patterns/record.ts'
import { indexToLevel, levelFromAnswers, levelToIndex, PLACEMENT_BANK, WRITING_TASK } from '../_shared/placement/bank.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'
import { callAI } from '../_shared/usage.ts'

const FUNCTION = 'placement'

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('questions') }),
  z.object({
    action: z.literal('submit'),
    answers: z.array(z.number().int().min(0).nullable()).length(PLACEMENT_BANK.length),
    writing: z.string().trim().max(3000),
    interests: z.array(z.string().max(40)).max(12),
    timezone: z.string().max(64).optional(),
  }),
])

const WritingLevel = z.object({
  writing_cefr: z.enum(['A1', 'A1+', 'A2', 'A2+', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C1+', 'C2']),
  vocabulary_cefr: z.enum(['A1', 'A1+', 'A2', 'A2+', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C1+', 'C2']),
  summary: z.string(),
  strengths: z.array(z.string()),
  errors: z.array(z.object({ fragment: z.string(), correction: z.string(), code: z.string(), explanation: z.string() })),
})

const LEVEL_ENUM = ['A1', 'A1+', 'A2', 'A2+', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C1+', 'C2']
const writingSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['writing_cefr', 'vocabulary_cefr', 'summary', 'strengths', 'errors'],
  properties: {
    writing_cefr: { type: 'string', enum: LEVEL_ENUM },
    vocabulary_cefr: { type: 'string', enum: LEVEL_ENUM },
    summary: { type: 'string', description: 'Español, máx. 40 palabras, en segunda persona (tú)' },
    strengths: { type: 'array', items: { type: 'string' }, description: 'Español, 1–3 fortalezas cortas' },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['fragment', 'correction', 'code', 'explanation'],
        properties: {
          fragment: { type: 'string' },
          correction: { type: 'string' },
          code: { type: 'string' },
          explanation: { type: 'string' },
        },
      },
    },
  },
}

const SYSTEM = `You are a CEFR examiner assessing a short writing sample from a Spanish-speaking adult learner of English.
- Estimate the CEFR level of the WRITING (grammar control, range, coherence) and of the VOCABULARY range, using "+" when the sample is clearly above the base level. Be calibrated: short, simple but correct texts are A2; B1 needs connected text with reasons and some tense variety.
- List up to 6 of the most important recurring errors (not every typo). For each: exact fragment, correction, a one-sentence explanation IN SPANISH, and the matching code from the provided catalog (use "other" if none fits).
- summary: IN SPANISH, 2 sentences max, second person, encouraging and concrete. strengths: 1–3 short items in Spanish.
- If the text is empty or not in English, rate A1 and explain in the summary.`

/**
 * Test de nivel para usuarios nuevos:
 *  questions → preguntas sin respuestas + tarea de escritura
 *  submit    → califica (preguntas sin IA + escritura con IA), fija el nivel, crea los primeros
 *              patrones de error y completa el onboarding.
 */
serve(async (req) => {
  const admin = adminClient()
  const user = await requireUser(req, admin)
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) throw new HttpError(400, 'Respuestas inválidas.')
  const body = parsed.data

  if (body.action === 'questions') {
    return json({
      questions: PLACEMENT_BANK.map(({ answer: _answer, ...q }) => q),
      writing: WRITING_TASK,
    })
  }

  const { data: profile } = await admin.from('profiles').select('onboarding_completed').eq('id', user.id).single()
  if (profile?.onboarding_completed) throw new HttpError(409, 'Ya completaste el test de nivel.', 'already_done')

  // 1) Preguntas (sin IA)
  const all = levelFromAnswers(body.answers)
  const grammar = levelFromAnswers(body.answers, (q) => q.skill === 'grammar')
  const vocabMc = levelFromAnswers(body.answers, (q) => q.skill === 'vocabulary')

  // 2) Escritura (IA, tier standard); si está vacía, solo cuentan las preguntas
  let writing: z.infer<typeof WritingLevel> | null = null
  let aiUnavailable = false
  if (wordCount(body.writing) >= 5) {
    try {
      const { data } = await callAI(admin, { userId: user.id, functionName: FUNCTION }, {
        tier: 'standard',
        system: SYSTEM,
        input: JSON.stringify({
          task: WRITING_TASK.prompt,
          learner_text: body.writing,
          word_count: wordCount(body.writing),
          error_catalog: PATTERN_CATALOG.map((p) => ({ code: p.code, title: p.title })),
        }),
        responseSchema: writingSchema,
        temperature: 0.2,
        maxOutputTokens: 3000,
        thinking: 'low',
      })
      writing = WritingLevel.parse(data)
    } catch (err) {
      if (!(err instanceof AIError)) throw err
      aiUnavailable = true // el nivel sale solo de las preguntas
    }
  }

  // 3) Nivel global: promedio de preguntas y escritura (índice continuo A1=0 … C2=5)
  const wIdx = writing ? levelToIndex(writing.writing_cefr) : null
  const vIdx = writing ? levelToIndex(writing.vocabulary_cefr) : null
  const overallIdx = wIdx == null ? all.index : (all.index + wIdx) / 2
  const overall = indexToLevel(overallIdx)
  const skills: Record<string, string> = {
    grammar: indexToLevel(grammar.index).label,
    vocabulary: indexToLevel(vIdx == null ? vocabMc.index : (vocabMc.index + vIdx) / 2).label,
  }
  if (wIdx != null) skills.writing = indexToLevel(wIdx).label

  const notes = [
    `Test de nivel: ${all.correct}/${PLACEMENT_BANK.length} preguntas correctas.`,
    writing
      ? `Escritura: ${writing.writing_cefr}. ${writing.summary}`
      : aiUnavailable
      ? 'Texto no evaluado (IA no disponible).'
      : 'Sin muestra de escritura.',
  ].join(' ')

  const { data: assessment, error: aErr } = await admin
    .from('level_assessments')
    .insert({ user_id: user.id, source: 'placement', overall_cefr: overall.level, overall_plus: overall.plus, skills, notes })
    .select('id')
    .single()
  if (aErr) throw aErr

  await admin.from('placement_sessions').insert({
    user_id: user.id,
    status: 'completed',
    current_step: PLACEMENT_BANK.length + 1,
    responses: { answers: body.answers, writing: body.writing, interests: body.interests },
    result_assessment_id: assessment.id,
    completed_at: new Date().toISOString(),
  })

  // 4) Perfil: nivel, intereses, zona horaria del dispositivo y onboarding completo
  const tz = body.timezone && isValidTimezone(body.timezone) ? body.timezone : undefined
  const { error: pErr } = await admin
    .from('profiles')
    .update({
      cefr_level: overall.level,
      cefr_plus: overall.plus,
      interests: body.interests,
      onboarding_completed: true,
      ...(tz ? { timezone: tz } : {}),
      learner_context: {
        summary: writing?.summary ?? null,
        strengths: writing?.strengths ?? [],
        placement: { correct: all.correct, total: PLACEMENT_BANK.length },
      },
    })
    .eq('id', user.id)
  if (pErr) throw pErr

  // 5) Temas: todos disponibles como pendientes para las lecciones
  const { data: topics } = await admin.from('topics').select('id')
  if (topics?.length) {
    await admin
      .from('user_topics')
      .upsert(topics.map((t) => ({ user_id: user.id, topic_id: t.id, status: 'pending' })), {
        onConflict: 'user_id,topic_id',
        ignoreDuplicates: true,
      })
  }

  // 6) Primeros errores detectados → patrones (con tarjeta de repaso)
  const detected = writing
    ? writing.errors.map((e) => ({ code: e.code, wrong: e.fragment, right: e.correction, context: 'placement' }))
    // Sin IA: los primeros errores salen del checklist de escritura
    : runChecklist(body.writing).map((c) => ({ code: c.code, wrong: c.examples[0] ?? c.label, right: '', context: 'placement' }))
  const { created } = await recordDetectedErrors(admin, user.id, detected, { source: 'placement' })

  return json({
    level: overall.label,
    skills,
    correct: all.correct,
    total: PLACEMENT_BANK.length,
    summary: writing?.summary ??
      (aiUnavailable
        ? 'Tu nivel se calculó con tus respuestas. No pudimos analizar tu texto ahora (la IA no está disponible); tus lecciones irán afinando el diagnóstico.'
        : null),
    strengths: writing?.strengths ?? [],
    focus: created,
    errors: writing?.errors ?? [],
  })
})

function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}
