import { z } from 'npm:zod@4'

export const EXERCISE_TYPES = [
  'multiple_choice',
  'fill_blank',
  'tense_contrast',
  'reorder',
  'transform',
  'error_detection',
  'free_writing',
] as const
export type ExerciseType = (typeof EXERCISE_TYPES)[number]

/** Tipos calificados sin IA (comparación con respuestas aceptadas) */
export const RULE_GRADED: ExerciseType[] = ['multiple_choice', 'fill_blank', 'tense_contrast', 'reorder']

const nullableString = { type: ['string', 'null'] }
const nullableStrings = { type: ['array', 'null'], items: { type: 'string' } }

/**
 * JSON Schema plano (sin oneOf) que recibe Gemini. Sin minItems/maxItems: Gemini los rechaza
 * (400 invalid argument); los conteos los exige zod y el prompt. Cada ejercicio usa solo los campos de su tipo;
 * el resto va en null. La validación por tipo la hace zod (abajo).
 */
export const lessonJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'topic_slug', 'focus_codes', 'rule', 'new_vocabulary', 'exercises'],
  properties: {
    title: { type: 'string', description: 'Título corto en español (máx. 6 palabras)' },
    topic_slug: { type: 'string', description: 'Uno de los slugs de tema candidatos' },
    focus_codes: { type: 'array', items: { type: 'string' }, description: 'Códigos de los errores que trabaja la lección' },
    rule: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'explanation', 'examples'],
      properties: {
        title: { type: 'string' },
        explanation: { type: 'string', description: 'Español, máx. 70 palabras, regla explícita' },
        examples: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['wrong', 'right', 'note'],
            properties: { wrong: { type: 'string' }, right: { type: 'string' }, note: nullableString },
          },
        },
      },
    },
    new_vocabulary: {
      type: ['array', 'null'],
      description: 'Palabras nuevas de la lección (null en exámenes)',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['term', 'translation', 'example'],
        properties: { term: { type: 'string' }, translation: { type: 'string' }, example: { type: 'string' } },
      },
    },
    exercises: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'phase', 'type', 'instruction', 'target_code', 'target_term', 'sentence', 'verb', 'time_clue', 'options',
          'correct_index', 'tokens', 'accepted', 'target_form', 'model_answer', 'hint', 'explanation', 'min_words',
          'guiding_questions', 'passage',
        ],
        properties: {
          phase: { type: 'string', enum: ['warmup', 'drill', 'free'] },
          type: { type: 'string', enum: [...EXERCISE_TYPES] },
          instruction: { type: 'string', description: 'Instrucción en español, una frase' },
          target_code: nullableString,
          target_term: nullableString,
          sentence: nullableString,
          verb: nullableString,
          time_clue: nullableString,
          options: nullableStrings,
          correct_index: { type: ['integer', 'null'] },
          tokens: nullableStrings,
          accepted: nullableStrings,
          target_form: nullableString,
          model_answer: nullableString,
          hint: nullableString,
          explanation: { type: 'string', description: 'Español, 1-2 frases: por qué es así' },
          min_words: { type: ['integer', 'null'] },
          guiding_questions: nullableStrings,
          passage: { type: ['string', 'null'], description: 'Texto de lectura (solo en ejercicios de lectura)' },
        },
      },
    },
  },
} as const

const Raw = z.object({
  phase: z.enum(['warmup', 'drill', 'free']),
  type: z.enum(EXERCISE_TYPES),
  instruction: z.string().min(3),
  target_code: z.string().nullable(),
  target_term: z.string().nullable(),
  sentence: z.string().nullable(),
  verb: z.string().nullable(),
  time_clue: z.string().nullable(),
  options: z.array(z.string()).nullable(),
  correct_index: z.number().int().nullable(),
  tokens: z.array(z.string()).nullable(),
  accepted: z.array(z.string()).nullable(),
  target_form: z.string().nullable(),
  model_answer: z.string().nullable(),
  hint: z.string().nullable(),
  explanation: z.string().min(3),
  min_words: z.number().int().nullable(),
  guiding_questions: z.array(z.string()).nullable(),
  passage: z.string().nullish(),
})
export type RawExercise = z.infer<typeof Raw>

export const LessonOutput = z.object({
  title: z.string().min(2).max(80),
  topic_slug: z.string(),
  focus_codes: z.array(z.string()),
  rule: z.object({
    title: z.string().min(2),
    explanation: z.string().min(10),
    examples: z.array(z.object({ wrong: z.string(), right: z.string(), note: z.string().nullable() })).min(1),
  }),
  new_vocabulary: z
    .array(z.object({ term: z.string().trim().min(1).max(60), translation: z.string().trim().min(1), example: z.string().trim() }))
    .nullish()
    .transform((v) => v ?? []),
  // Un ejercicio mal formado se descarta sin tumbar la lección (se exigen 6 válidos)
  exercises: z
    .array(z.unknown())
    .transform((items) => items.flatMap((item) => {
      const r = Raw.safeParse(item)
      return r.success ? [r.data] : []
    }))
    .pipe(z.array(Raw).min(6, 'Se necesitan al menos 6 ejercicios completos (con instruction y explanation en texto)')),
})
export type LessonOutput = z.infer<typeof LessonOutput>

export type BuiltExercise = {
  phase: 'warmup' | 'drill' | 'free'
  type: ExerciseType
  grading: 'rule' | 'ai'
  payload: Record<string, unknown>
  answer_key: Record<string, unknown> | null
  target_code: string | null
  target_term: string | null
}

const hasBlank = (s: string | null) => !!s && s.includes('___')
const nonEmpty = (a: string[] | null) => (a ?? []).map((x) => x.trim()).filter(Boolean)

function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Convierte un ejercicio crudo en { payload visible, answer_key privado }.
 * Devuelve un motivo (string) si el ejercicio no es válido para su tipo.
 */
export function buildExercise(e: RawExercise): BuiltExercise | string {
  const base = { phase: e.phase, type: e.type, target_code: e.target_code, target_term: e.target_term }
  // El texto de lectura acompaña a la pregunta (se muestra encima)
  const passage = e.passage?.trim()
  const common = { instruction: e.instruction, hint: e.hint, ...(passage ? { passage } : {}) }

  switch (e.type) {
    case 'multiple_choice': {
      const options = nonEmpty(e.options)
      if (options.length < 2 || options.length > 4) return 'multiple_choice necesita 2-4 opciones'
      if (e.correct_index == null || e.correct_index < 0 || e.correct_index >= options.length) return 'correct_index inválido'
      return {
        ...base, grading: 'rule',
        payload: { ...common, sentence: e.sentence, options },
        answer_key: { correct_index: e.correct_index, explanation: e.explanation },
      }
    }
    case 'fill_blank':
    case 'tense_contrast': {
      const accepted = nonEmpty(e.accepted)
      if (!hasBlank(e.sentence)) return `${e.type} necesita "___" en sentence`
      if (!accepted.length) return `${e.type} necesita accepted`
      if (e.type === 'tense_contrast' && !e.verb) return 'tense_contrast necesita verb'
      return {
        ...base, grading: 'rule',
        payload: { ...common, sentence: e.sentence, verb: e.verb, time_clue: e.time_clue },
        answer_key: { accepted, explanation: e.explanation },
      }
    }
    case 'reorder': {
      const tokens = nonEmpty(e.tokens)
      if (tokens.length < 3 || tokens.length > 12) return 'reorder necesita 3-12 tokens'
      let shuffled = shuffle(tokens)
      for (let i = 0; i < 5 && shuffled.join(' ') === tokens.join(' '); i++) shuffled = shuffle(tokens)
      return {
        ...base, grading: 'rule',
        payload: { ...common, tokens: shuffled },
        answer_key: { answer: tokens.join(' '), alternatives: nonEmpty(e.accepted), explanation: e.explanation },
      }
    }
    case 'transform': {
      if (!e.sentence || !e.model_answer) return 'transform necesita sentence y model_answer'
      return {
        ...base, grading: 'ai',
        payload: { ...common, sentence: e.sentence, target_form: e.target_form },
        answer_key: { model_answer: e.model_answer, accepted: nonEmpty(e.accepted), explanation: e.explanation },
      }
    }
    case 'error_detection': {
      if (!e.sentence || !e.model_answer) return 'error_detection necesita sentence y model_answer'
      return {
        ...base, grading: 'ai',
        payload: { ...common, sentence: e.sentence },
        answer_key: { model_answer: e.model_answer, accepted: nonEmpty(e.accepted), explanation: e.explanation },
      }
    }
    case 'free_writing': {
      return {
        ...base, grading: 'ai',
        payload: {
          ...common,
          prompt: e.sentence ?? e.instruction,
          min_words: Math.min(Math.max(e.min_words ?? 60, 30), 200),
          guiding_questions: nonEmpty(e.guiding_questions),
        },
        answer_key: { model_answer: e.model_answer, explanation: e.explanation },
      }
    }
  }
}
