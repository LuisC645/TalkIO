import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const FALLBACK_PROMPT_VERSION = 'fallback.v1'

export type ReusedExercise = {
  phase: 'warmup' | 'drill' | 'free'
  type: string
  payload: Record<string, unknown>
  answer_key: Record<string, unknown> | null
  grading: 'rule' | 'ai'
  target_pattern_id: string | null
  target_vocab_id: string | null
}

// Tipos que se califican sin IA (o con alternativa sin IA): la escritura libre queda fuera
const REUSABLE = ['multiple_choice', 'fill_blank', 'tense_contrast', 'reorder', 'transform', 'error_detection']

function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Alternativa sin IA: arma una lección de repaso (o un examen semanal) con ejercicios que el
 * usuario ya hizo, priorizando los que falló. Si se indican lessonIds, solo usa esas lecciones.
 */
export async function pastExercisesForReview(
  admin: SupabaseClient,
  userId: string,
  opts: { limit: number; lessonIds?: string[] },
): Promise<ReusedExercise[]> {
  let ids = opts.lessonIds
  if (!ids) {
    const { data } = await admin
      .from('lessons')
      .select('id')
      .eq('user_id', userId)
      .eq('kind', 'lesson')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(20)
    ids = (data ?? []).map((l) => l.id)
  }
  if (!ids.length) return []

  const { data: exercises } = await admin
    .from('exercises')
    .select('id, type, payload, answer_key, grading, target_pattern_id, target_vocab_id')
    .in('lesson_id', ids)
    .in('type', REUSABLE)
  if (!exercises?.length) return []

  const { data: wrong } = await admin
    .from('exercise_attempts')
    .select('exercise_id')
    .in('exercise_id', exercises.map((e) => e.id))
    .eq('is_correct', false)
  const failed = new Set((wrong ?? []).map((w) => w.exercise_id))

  // Primero los fallados, luego el resto; sin repetir la misma oración
  const ordered = [...shuffle(exercises.filter((e) => failed.has(e.id))), ...shuffle(exercises.filter((e) => !failed.has(e.id)))]
  const seen = new Set<string>()
  const picked = ordered.filter((e) => {
    const key = JSON.stringify((e.payload as Record<string, unknown>).sentence ?? (e.payload as Record<string, unknown>).tokens ?? e.id)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return picked.slice(0, opts.limit).map((e, i) => ({
    phase: i < 2 ? 'warmup' : 'drill',
    type: e.type,
    payload: e.payload as Record<string, unknown>,
    answer_key: e.answer_key as Record<string, unknown> | null,
    grading: e.grading as 'rule' | 'ai',
    target_pattern_id: e.target_pattern_id,
    target_vocab_id: e.target_vocab_id,
  }))
}
