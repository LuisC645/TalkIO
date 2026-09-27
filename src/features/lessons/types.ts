// Contrato público de los ejercicios (payload de exercises_public). El answer_key nunca llega al cliente.

export type Phase = 'warmup' | 'drill' | 'free'

/** passage: texto de lectura que acompaña a la pregunta (ejercicios de lectura) */
type Base = { instruction: string; hint: string | null; passage?: string }

export type MultipleChoicePayload = Base & { sentence: string | null; options: string[] }
export type FillBlankPayload = Base & { sentence: string; verb: string | null; time_clue: string | null }
export type ReorderPayload = Base & { tokens: string[] }
export type TransformPayload = Base & { sentence: string; target_form: string | null }
export type ErrorDetectionPayload = Base & { sentence: string }
export type FreeWritingPayload = Base & { prompt: string; min_words: number; guiding_questions: string[] }

export type ExerciseResponse = { choice: number } | { text: string } | { tokens: string[] }

export type Exercise = {
  id: string
  lesson_id: string
  position: number
  phase: Phase
  type: string
  grading: 'rule' | 'ai'
  payload: Record<string, unknown>
  target_pattern_id: string | null
}

export type Feedback = {
  explanation: string
  corrected: string | null
  errors: { fragment: string; correction: string; code: string; explanation: string }[]
  checklist?: { code: string; label: string; examples: string[] }[]
  note?: string
  model_answer?: string | null
  words?: number
}

export type Attempt = {
  id: string
  exercise_id: string
  response: ExerciseResponse
  is_correct: boolean | null
  score: number | null
  feedback: Feedback
}

export type GradeResult = {
  attempt_id: string
  is_correct: boolean
  score: number
  feedback: Feedback
  graded_by: 'rule' | 'ai'
  xp_awarded: number | null
  pattern: { code: string; title: string; correct_streak: number; mastery_threshold: number; status: string } | null
  lesson: {
    completed: boolean
    done?: number
    total?: number
    score?: number
    xp_earned?: number
    bonus_xp?: number
    kind?: LessonKind
    round?: number
    passed?: boolean
    pass_threshold?: number
    from_level?: string
    new_level?: string | null
  }
}

export type LessonKind = 'lesson' | 'weekly_exam' | 'level_exam'

/** Palabra nueva que enseña la lección (pasa al repaso) */
export type LessonVocab = { term: string; translation: string; example: string }

export type LessonRule = {
  title: string
  explanation: string
  examples: { wrong: string; right: string; note: string | null }[]
}
