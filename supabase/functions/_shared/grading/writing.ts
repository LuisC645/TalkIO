import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { FREE_WRITING_SYSTEM, GradeOutput, gradeInput, gradeJsonSchema } from './ai.ts'
import { runChecklist, wordCount, type ChecklistHit } from './checklist.ts'
import { AIError } from '../ai/provider.ts'
import { callAI } from '../usage.ts'

export type WritingGrade = {
  score: number
  is_correct: boolean
  feedback: string
  corrected: string
  errors: GradeOutput['errors']
  checklist: ChecklistHit[]
  words: number
  model: string
  /** true = la IA no respondió y se hizo una revisión básica (longitud + checklist) */
  fallback?: boolean
}

const CHECKLIST_LABEL: Record<string, string> = {
  lowercase_i: '"I" va siempre en mayúscula.',
  spelling_apostrophes_capitals: 'Las contracciones llevan apóstrofo (don\'t, I\'m).',
  run_on_sentences: 'Separa las oraciones con punto o únelas con and / but / so / because.',
  underdeveloped_answers: 'Cierra con una conclusión en vez de "that\'s it".',
}

/**
 * Revisión básica sin IA: puntúa por longitud frente al mínimo y descuenta por cada hallazgo del
 * checklist. Es una estimación y se dice así; la corrección completa vuelve cuando la IA responda.
 */
export function basicWritingGrade(text: string, minWords: number | null | undefined): WritingGrade {
  const words = wordCount(text)
  const checklist = runChecklist(text)
  const min = minWords && minWords > 0 ? minWords : 40
  const lengthScore = Math.min(1, words / min)
  const score = Math.round(Math.max(0.2, Math.min(0.85, 0.35 + 0.5 * lengthScore - 0.08 * checklist.length)) * 100) / 100
  const tips = checklist.map((c) => CHECKLIST_LABEL[c.code]).filter(Boolean)
  return {
    score,
    is_correct: score >= 0.7,
    feedback: [
      'La corrección con IA no está disponible en este momento, así que hicimos una revisión básica (longitud y checklist de escritura).',
      tips.length ? `Revisa: ${tips.join(' ')}` : 'No encontramos problemas de formato.',
      'Vuelve a enviar un texto más tarde para recibir la corrección completa.',
    ].join(' '),
    corrected: '',
    errors: [],
    checklist,
    words,
    model: 'sin-ia',
    fallback: true,
  }
}

/**
 * Corrige un texto libre en inglés: checklist determinista + IA (tier standard).
 * La usan las lecciones (free_writing) y la pestaña "Escribir".
 */
export async function gradeWriting(
  admin: SupabaseClient,
  ctx: { userId: string; functionName: string },
  task: { text: string; prompt?: string | null; guiding_questions?: string[]; min_words?: number | null },
  patternCodes: { code: string; title: string }[],
): Promise<WritingGrade> {
  const words = wordCount(task.text)
  const checklist = runChecklist(task.text)
  let ai: { data: unknown; model: string }
  try {
    ai = await callAI(admin, ctx, {
    tier: 'standard',
    system: FREE_WRITING_SYSTEM,
    input: gradeInput(
      {
        prompt: task.prompt ?? 'Free writing practice: the learner chose the topic.',
        guiding_questions: task.guiding_questions ?? [],
        min_words: task.min_words ?? null,
        learner_text: task.text,
        learner_word_count: words,
        automatic_checklist_findings: checklist.map((c) => c.label),
      },
      patternCodes,
    ),
    responseSchema: gradeJsonSchema as unknown as Record<string, unknown>,
    temperature: 0.3,
    maxOutputTokens: 3000,
    thinking: 'low',
  })
  } catch (err) {
    if (err instanceof AIError) return basicWritingGrade(task.text, task.min_words)
    throw err
  }
  const { data, model } = ai
  const out = GradeOutput.parse(data)
  const min = task.min_words ?? 0
  // Por debajo del mínimo de palabras, la nota se escala (sin castigar de más)
  const lengthFactor = !min || words >= min ? 1 : Math.max(0.5, words / min)
  const score = Math.round(out.score * lengthFactor * 100) / 100
  return {
    score,
    is_correct: score >= 0.7,
    feedback: out.feedback,
    corrected: out.corrected,
    errors: out.errors,
    checklist,
    words,
    model,
  }
}
