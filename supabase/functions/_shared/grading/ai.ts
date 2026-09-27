import { z } from 'npm:zod@4'

export const GRADE_PROMPT_VERSION = 'grade.v1'

export const gradeJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['is_correct', 'score', 'corrected', 'feedback', 'errors'],
  properties: {
    is_correct: { type: 'boolean' },
    score: { type: 'number', minimum: 0, maximum: 1 },
    corrected: { type: 'string', description: 'La respuesta del alumno corregida con el menor cambio posible' },
    feedback: { type: 'string', description: 'Español, máx. 45 palabras, directo, sin disculpas' },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['fragment', 'correction', 'code', 'explanation'],
        properties: {
          fragment: { type: 'string' },
          correction: { type: 'string' },
          code: { type: 'string', description: 'Uno de los códigos dados, u "other"' },
          explanation: { type: 'string', description: 'Español, una frase' },
        },
      },
    },
  },
} as const

export const GradeOutput = z.object({
  is_correct: z.boolean(),
  score: z.number().min(0).max(1),
  corrected: z.string(),
  feedback: z.string(),
  errors: z.array(z.object({ fragment: z.string(), correction: z.string(), code: z.string(), explanation: z.string() })).max(8),
})
export type GradeOutput = z.infer<typeof GradeOutput>

const BASE = `You grade answers from a Spanish-speaking adult learning English. Judge them against the task and the learner's level (the task was written at that level); do not penalize simple but correct language.
Be fair and encouraging, but precise:
- Accept ANY grammatical, natural answer that fulfils the instruction, even if it differs from the model answer.
- Ignore differences in final punctuation and capitalization of the first letter, unless the error is the lowercase pronoun "i".
- List only real errors (max 5, most important first). For each: the exact wrong fragment, its correction, a one-sentence explanation IN SPANISH, and the code of the matching learner error pattern from the provided list (use "other" if none fits).
- "corrected": the learner's answer with the minimum changes needed to be correct.
- "feedback": IN SPANISH, max 45 words, second person (tú), no apologies, no emojis. Say what is right, then the main fix.`

/** Respuestas cortas (transform / error_detection): tier lite */
export const SHORT_ANSWER_SYSTEM = `${BASE}
- is_correct = true only if the answer fully fulfils the instruction with no grammar errors. score: 1 correct, 0.5 right idea with a minor slip, 0 otherwise.`

/** Escritura libre: tier standard */
export const FREE_WRITING_SYSTEM = `${BASE}
- Evaluate: task fulfilment, grammar, vocabulary, and whether the answer follows Answer → Reason (because…) → Example (for example…) → Closing (so… / that's why…).
- score between 0 and 1 (0.7+ = solid for this level). is_correct = score >= 0.7.
- "corrected": the full text corrected (keep the learner's ideas and voice).
- "feedback": one concrete strength + the single most important improvement.`

export function gradeInput(task: Record<string, unknown>, patternCodes: { code: string; title: string }[]): string {
  return JSON.stringify({ task, learner_error_patterns: patternCodes }, null, 1)
}
