import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@4'
import { GRADE_PROMPT_VERSION, GradeOutput, gradeInput, gradeJsonSchema, SHORT_ANSWER_SYSTEM } from '../_shared/grading/ai.ts'
import { wordCount, type ChecklistHit } from '../_shared/grading/checklist.ts'
import { gradeWriting } from '../_shared/grading/writing.ts'
import { codesForPrompt } from '../_shared/patterns/catalog.ts'
import { recordDetectedErrors } from '../_shared/patterns/record.ts'
import { matchAccepted, normalize } from '../_shared/grading/normalize.ts'
import { AIError } from '../_shared/ai/provider.ts'
import { HttpError, json, serve } from '../_shared/http.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'
import { assertDailyLimit, callAI } from '../_shared/usage.ts'

const FUNCTION = 'grade-attempt'
const MAX_AI_PER_DAY = 150
const LESSON_BONUS_XP = 15
// Bonos al completar: exámenes valen más; repetir una lección no da bono
const EXAM_BONUS_XP: Record<string, number> = { weekly_exam: 30, level_exam: 40 }
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

const Body = z.object({
  exercise_id: z.uuid(),
  response: z.union([
    z.object({ choice: z.number().int().min(0) }),
    z.object({ text: z.string().max(4000) }),
    z.object({ tokens: z.array(z.string()).max(20) }),
  ]),
  duration_ms: z.number().int().min(0).max(3_600_000).optional(),
})

type Feedback = {
  explanation: string
  corrected: string | null
  errors: { fragment: string; correction: string; code: string; explanation: string }[]
  checklist?: ChecklistHit[]
  note?: string
  model_answer?: string | null
  words?: number
}

type Grade = { is_correct: boolean; score: number; feedback: Feedback; graded_by: 'rule' | 'ai'; model?: string }

/**
 * POST /grade-attempt { exercise_id, response, duration_ms } → resultado + XP + progreso.
 * Un intento por ejercicio y ronda (idempotente). Repetir una lección abre una ronda nueva:
 * la nota guardada es la de la última ronda; los aciertos repetidos no avanzan el dominio.
 */
serve(async (req) => {
  const admin = adminClient()
  const user = await requireUser(req, admin)
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) throw new HttpError(400, 'Respuesta inválida.')
  const { exercise_id, response, duration_ms } = parsed.data

  const { data: exercise } = await admin
    .from('exercises')
    .select('id, lesson_id, user_id, type, grading, payload, answer_key, target_pattern_id')
    .eq('id', exercise_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!exercise) throw new HttpError(404, 'Ejercicio no encontrado.')

  const { data: lessonRow } = await admin.from('lessons').select('round, kind').eq('id', exercise.lesson_id).single()
  const round = lessonRow?.round ?? 1
  const isRepeat = round > 1

  const { data: previous } = await admin
    .from('exercise_attempts')
    .select('*')
    .eq('exercise_id', exercise_id)
    .eq('round', round)
    .maybeSingle()
  if (previous) return json(await buildResult(admin, user.id, previous, null))

  // Patrones del usuario + catálogo (para clasificar errores; los nuevos se crean al detectarlos)
  const { data: patterns } = await admin.from('error_patterns').select('code, title').eq('user_id', user.id)
  const grade = await gradeExercise(admin, user.id, exercise, response, codesForPrompt(patterns ?? []))

  const { data: attempt, error: attemptError } = await admin
    .from('exercise_attempts')
    .insert({
      user_id: user.id,
      exercise_id,
      lesson_id: exercise.lesson_id,
      response,
      is_correct: grade.is_correct,
      score: grade.score,
      feedback: grade.feedback,
      graded_by: grade.graded_by,
      model: grade.model ?? null,
      duration_ms: duration_ms ?? null,
      round,
    })
    .select('*')
    .single()
  if (attemptError) {
    // Carrera: otro intento se guardó primero → devolver ese
    if (attemptError.code === '23505') {
      const { data: again } = await admin.from('exercise_attempts').select('*').eq('exercise_id', exercise_id).eq('round', round).single()
      return json(await buildResult(admin, user.id, again, null))
    }
    throw attemptError
  }

  // Patrones: el objetivo avanza o se reinicia; los errores detectados se registran
  const touched = new Set<string>()
  let targetProgress = null
  // En una repetición los aciertos no cuentan para dominar (ya se conocen las respuestas)
  if (exercise.target_pattern_id && !(isRepeat && grade.is_correct)) {
    const { data } = await admin.rpc('record_pattern_result', { p_pattern_id: exercise.target_pattern_id, p_correct: grade.is_correct })
    targetProgress = data
    touched.add(exercise.target_pattern_id)
    if (!grade.is_correct) {
      await admin.from('error_occurrences').insert({
        user_id: user.id,
        pattern_id: exercise.target_pattern_id,
        attempt_id: attempt.id,
        wrong_text: answerText(exercise, response).slice(0, 500),
        corrected_text: (grade.feedback.corrected ?? '').slice(0, 500),
        context: exercise.type,
        source: 'exercise',
      })
    }
  }
  await recordDetectedErrors(
    admin,
    user.id,
    [
      ...grade.feedback.errors.map((e) => ({ code: e.code, wrong: e.fragment, right: e.correction, context: exercise.type })),
      ...(grade.feedback.checklist ?? []).map((c) => ({ code: c.code, wrong: c.examples[0] ?? c.label, right: '', context: exercise.type })),
    ],
    { source: 'exercise', attemptId: attempt.id, skip: touched },
  )

  // XP: 2 por intentarlo + hasta 8 por acierto (escritura libre: 5 + hasta 15). Repetir: reducido.
  const writing = exercise.type === 'free_writing'
  const xp = isRepeat
    ? Math.round((writing ? 5 : 2) * grade.score)
    : writing
      ? Math.round(5 + 15 * grade.score)
      : Math.round(2 + 8 * grade.score)
  if (xp > 0) await admin.rpc('award_xp', { p_user_id: user.id, p_amount: xp, p_source: 'exercise', p_ref_id: attempt.id })

  const lesson = await updateLesson(admin, user.id, exercise.lesson_id)
  return json(await buildResult(admin, user.id, attempt, { xp, targetProgress, lesson }))
})

async function gradeExercise(
  admin: SupabaseClient,
  userId: string,
  exercise: { type: string; payload: Record<string, unknown>; answer_key: Record<string, unknown> | null },
  response: z.infer<typeof Body>['response'],
  patternCodes: { code: string; title: string }[],
): Promise<Grade> {
  const key = (exercise.answer_key ?? {}) as Record<string, unknown>
  const payload = exercise.payload
  const explanation = String(key.explanation ?? '')
  const text = 'text' in response ? response.text.trim() : ''

  switch (exercise.type) {
    case 'multiple_choice': {
      if (!('choice' in response)) throw new HttpError(400, 'Elige una opción.')
      const options = payload.options as string[]
      const correct = response.choice === key.correct_index
      return {
        is_correct: correct,
        score: correct ? 1 : 0,
        graded_by: 'rule',
        feedback: { explanation, corrected: options[key.correct_index as number] ?? null, errors: [] },
      }
    }
    case 'fill_blank':
    case 'tense_contrast': {
      if (!text) throw new HttpError(400, 'Escribe tu respuesta.')
      const { match, expected } = matchAccepted(text, key.accepted as string[])
      return {
        is_correct: !!match,
        score: match ? 1 : 0,
        graded_by: 'rule',
        feedback: {
          explanation,
          corrected: expected,
          errors: [],
          note: match === 'typo' ? `Casi perfecto: se escribe "${expected}".` : undefined,
        },
      }
    }
    case 'reorder': {
      if (!('tokens' in response)) throw new HttpError(400, 'Ordena las palabras.')
      const candidates = [key.answer as string, ...((key.alternatives as string[]) ?? [])]
      const answer = normalize(response.tokens.join(' '))
      const correct = candidates.some((c) => normalize(c) === answer)
      return {
        is_correct: correct,
        score: correct ? 1 : 0,
        graded_by: 'rule',
        feedback: { explanation, corrected: key.answer as string, errors: [] },
      }
    }
    case 'transform':
    case 'error_detection': {
      if (!text) throw new HttpError(400, 'Escribe tu respuesta.')
      const accepted = [key.model_answer as string, ...((key.accepted as string[]) ?? [])].filter(Boolean)
      const { match } = matchAccepted(text, accepted)
      if (match === 'exact') {
        return { is_correct: true, score: 1, graded_by: 'rule', feedback: { explanation, corrected: text, errors: [] } }
      }
      // Casi exacta (1 letra): correcta sin gastar IA
      const near = matchAccepted(text, accepted)
      if (near.match === 'typo') {
        return {
          is_correct: true,
          score: 1,
          graded_by: 'rule',
          feedback: { explanation, corrected: near.expected, errors: [], note: `Casi perfecto: se escribe "${near.expected}".` },
        }
      }
      await ensureAIBudget(admin, userId)
      let shortAI: { data: unknown; model: string }
      try {
        shortAI = await callAI(admin, { userId, functionName: FUNCTION }, {
          tier: 'lite',
          system: SHORT_ANSWER_SYSTEM,
          input: gradeInput(
            {
              type: exercise.type,
              instruction: payload.instruction,
              source_sentence: payload.sentence,
              target_form: payload.target_form ?? null,
              model_answer: key.model_answer,
              other_correct_answers: key.accepted,
              learner_answer: text,
            },
            patternCodes,
          ),
          responseSchema: gradeJsonSchema as unknown as Record<string, unknown>,
          temperature: 0.2,
          maxOutputTokens: 1500,
          thinking: 'low',
        })
      } catch (err) {
        if (!(err instanceof AIError)) throw err
        // Sin IA: se compara con las respuestas esperadas (puede no aceptar variantes válidas)
        return {
          is_correct: false,
          score: 0,
          graded_by: 'rule',
          feedback: {
            explanation,
            corrected: key.model_answer as string,
            errors: [],
            model_answer: key.model_answer as string,
            note: 'Revisión automática sin IA: comparamos con la respuesta esperada. Si tu versión también es correcta, no te preocupes.',
          },
        }
      }
      const out = GradeOutput.parse(shortAI.data)
      return {
        is_correct: out.is_correct,
        score: out.score,
        graded_by: 'ai',
        model: shortAI.model,
        feedback: {
          explanation: out.feedback || explanation,
          corrected: out.corrected,
          errors: out.errors,
          model_answer: key.model_answer as string,
        },
      }
    }
    case 'free_writing':
    case 'speaking_prompt': {
      const words = wordCount(text)
      const min = Number(payload.min_words ?? 40)
      if (words < Math.min(10, min)) throw new HttpError(400, `Escribe al menos ${Math.min(10, min)} palabras.`)
      await ensureAIBudget(admin, userId)
      const w = await gradeWriting(
        admin,
        { userId, functionName: FUNCTION },
        {
          text,
          prompt: payload.prompt as string,
          guiding_questions: payload.guiding_questions as string[],
          min_words: min,
        },
        patternCodes,
      )
      return {
        is_correct: w.is_correct,
        score: w.score,
        graded_by: 'ai',
        model: w.model,
        feedback: {
          explanation: w.feedback,
          corrected: w.corrected,
          errors: w.errors,
          checklist: w.checklist,
          words,
          model_answer: (key.model_answer as string) ?? null,
          note: w.fallback
            ? 'Revisión básica sin IA (longitud y checklist). La corrección completa volverá cuando la IA esté disponible.'
            : words < min
              ? `Escribiste ${words} de ${min} palabras mínimas.`
              : undefined,
        },
      }
    }
    default:
      throw new HttpError(400, `Tipo de ejercicio no soportado: ${exercise.type}`)
  }
}

async function ensureAIBudget(admin: SupabaseClient, userId: string) {
  if (!(await assertDailyLimit(admin, userId, FUNCTION, MAX_AI_PER_DAY))) {
    throw new HttpError(429, 'Llegaste al límite diario de correcciones con IA. Vuelve mañana.', 'daily_limit')
  }
}

function answerText(exercise: { type: string; payload: Record<string, unknown> }, response: z.infer<typeof Body>['response']): string {
  if ('text' in response) return response.text
  if ('tokens' in response) return response.tokens.join(' ')
  const options = (exercise.payload.options as string[]) ?? []
  return options[response.choice] ?? String(response.choice)
}

/**
 * Marca la lección en curso; al completar todos los ejercicios de la ronda la cierra, guarda la
 * nota (la última ronda) y bonifica. En exámenes calcula el aprobado y, en el de nivel, promueve.
 */
async function updateLesson(admin: SupabaseClient, userId: string, lessonId: string) {
  const { data: lesson } = await admin.from('lessons').select('id, status, topic_id, kind, round, meta').eq('id', lessonId).single()
  const round = lesson?.round ?? 1
  const [{ count: total }, { data: attempts }] = await Promise.all([
    admin.from('exercises').select('id', { count: 'exact', head: true }).eq('lesson_id', lessonId),
    admin.from('exercise_attempts').select('id, score').eq('lesson_id', lessonId).eq('round', round),
  ])
  const done = attempts?.length ?? 0

  if (lesson?.status === 'ready') {
    await admin.from('lessons').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', lessonId)
  }

  if (done < (total ?? 0) || lesson?.status === 'completed') {
    return { completed: lesson?.status === 'completed', done, total: total ?? 0, kind: lesson?.kind, round }
  }

  const score = Math.round(((attempts ?? []).reduce((s, a) => s + Number(a.score ?? 0), 0) / done) * 100)
  const kind = (lesson?.kind ?? 'lesson') as string
  const meta = (lesson?.meta ?? {}) as Record<string, unknown>

  // Bono solo en la primera ronda
  const bonus = round > 1 ? 0 : kind === 'lesson' ? LESSON_BONUS_XP : (EXAM_BONUS_XP[kind] ?? 0)
  if (bonus) {
    await admin.rpc('award_xp', { p_user_id: userId, p_amount: bonus, p_source: kind === 'lesson' ? 'lesson' : 'exam', p_ref_id: lessonId })
  }
  const { data: xpRows } = await admin
    .from('xp_events')
    .select('amount')
    .eq('user_id', userId)
    .in('ref_id', [lessonId, ...(attempts ?? []).map((a) => a.id)])
  const xpEarned = (xpRows ?? []).reduce((s, r) => s + r.amount, 0)

  // Exámenes: aprobado y, en el de nivel, promoción
  let examResult: Record<string, unknown> = {}
  if (kind !== 'lesson') {
    const threshold = Number(meta.pass_threshold ?? (kind === 'level_exam' ? 80 : 70))
    const passed = score >= threshold
    examResult = { passed, pass_threshold: threshold }
    if (kind === 'level_exam') examResult = { ...examResult, ...(await applyLevelExam(admin, userId, meta, score, passed)) }
  }

  await admin
    .from('lessons')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      score,
      xp_earned: xpEarned,
      ...(kind !== 'lesson' ? { meta: { ...meta, ...examResult } } : {}),
    })
    .eq('id', lessonId)

  if (lesson?.topic_id && round === 1) {
    const { data: ut } = await admin.from('user_topics').select('times_practiced').eq('user_id', userId).eq('topic_id', lesson.topic_id).maybeSingle()
    await admin.from('user_topics').upsert({
      user_id: userId,
      topic_id: lesson.topic_id,
      status: 'practiced',
      times_practiced: (ut?.times_practiced ?? 0) + 1,
      last_practiced_at: new Date().toISOString(),
    })
  }

  return { completed: true, done, total: total ?? 0, score, xp_earned: xpEarned, bonus_xp: bonus, kind, round, ...examResult }
}

/**
 * Examen de nivel: ≥ umbral (80) → sube al nivel objetivo; 60–79 sin "+" → gana el "+".
 * Deja constancia en level_assessments (reassessment).
 */
async function applyLevelExam(admin: SupabaseClient, userId: string, meta: Record<string, unknown>, score: number, passed: boolean) {
  const { data: profile } = await admin.from('profiles').select('cefr_level, cefr_plus').eq('id', userId).single()
  const from = `${profile?.cefr_level ?? 'A1'}${profile?.cefr_plus ? '+' : ''}`
  const target = String(meta.target_level ?? '')
  let newLevel: string | null = null
  let update: { cefr_level: string; cefr_plus: boolean } | null = null

  if (passed && LEVELS.includes(target)) {
    update = { cefr_level: target, cefr_plus: false }
    newLevel = target
  } else if (score >= 60 && profile && !profile.cefr_plus) {
    update = { cefr_level: profile.cefr_level ?? 'A1', cefr_plus: true }
    newLevel = `${profile.cefr_level}+`
  }

  if (update) {
    await admin.from('profiles').update(update).eq('id', userId)
    const { data: last } = await admin
      .from('level_assessments')
      .select('skills')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    await admin.from('level_assessments').insert({
      user_id: userId,
      source: 'reassessment',
      overall_cefr: update.cefr_level,
      overall_plus: update.cefr_plus,
      skills: last?.skills ?? {},
      notes: `Examen de nivel (${target}): ${score}/100.`,
    })
  }
  return { from_level: from, new_level: newLevel }
}

async function buildResult(
  admin: SupabaseClient,
  userId: string,
  attempt: Record<string, unknown>,
  extra: { xp: number; targetProgress: unknown; lesson: unknown } | null,
) {
  let lesson = extra?.lesson
  if (!lesson) {
    const { data } = await admin
      .from('lessons')
      .select('status, score, xp_earned, kind, round, meta')
      .eq('id', attempt.lesson_id as string)
      .eq('user_id', userId)
      .single()
    const meta = (data?.meta ?? {}) as Record<string, unknown>
    lesson = {
      completed: data?.status === 'completed',
      score: data?.score,
      xp_earned: data?.xp_earned,
      kind: data?.kind,
      round: data?.round,
      passed: meta.passed,
      new_level: meta.new_level,
    }
  }
  return {
    attempt_id: attempt.id,
    is_correct: attempt.is_correct,
    score: attempt.score,
    feedback: attempt.feedback,
    graded_by: attempt.graded_by,
    xp_awarded: extra?.xp ?? null,
    pattern: extra?.targetProgress ?? null,
    lesson,
    prompt_version: GRADE_PROMPT_VERSION,
  }
}
