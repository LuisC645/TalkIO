import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

// Qué puede aparecer en una lección según el nivel CEFR del usuario (tabla level_guides). Se
// inyecta en los prompts para que la IA no use gramática ni vocabulario por encima del nivel
// (p. ej. pasado con un A1). Se lee siempre con el nivel actual del perfil.

export type LevelGuide = {
  level: string
  grammar: string
  avoid: string
  vocabulary: string
  sentence_words: string
  free_writing_words: string
  time_clues: string
  focus_codes: string[]
  blocked_patterns: string[]
  new_words: number
  reading: string
}

/** Guía del nivel base (A1+ → A1). null si la tabla no tiene la fila */
export async function loadLevelGuide(admin: SupabaseClient, cefr: string): Promise<LevelGuide | null> {
  const { data } = await admin.from('level_guides').select('*').eq('level', cefr.replace('+', '')).maybeSingle()
  return (data as LevelGuide | null) ?? null
}

/** Bloque para los prompts: qué gramática, vocabulario y longitud corresponden al nivel */
export function levelGuidePrompt(cefr: string, g: LevelGuide | null): string {
  const plus = cefr.endsWith('+')
  const base = cefr.replace('+', '')
  if (!g) {
    return `# Level constraints (${cefr}) — STRICT
Use only grammar, vocabulary and sentence length a ${cefr} learner (CEFR) can understand. Never practice structures above ${base}.`
  }
  return `# Level constraints (${cefr}) — STRICT
The learner is ${cefr}${plus ? ` (solid ${base}, starting to approach the next level)` : ''}. Everything in the lesson must be understandable and doable at this level.
- Grammar you may use and practice: ${g.grammar}
- NEVER use or test: ${g.avoid}${plus ? ' (at most ONE exercise may preview a structure from the next level, clearly explained).' : ''}
- Vocabulary: ${g.vocabulary}
- Sentence length: ${g.sentence_words} words.
- Time clues you may use: ${g.time_clues}.
- New vocabulary per lesson: ${g.new_words} words.
- Reading text: ${g.reading || 'short text at this level with 2–3 comprehension questions.'}
- free_writing: min_words ${g.free_writing_words}; the prompt and the model_answer must use only ${base} grammar.
- If a focus error belongs to a structure above this level, practice only the part that fits this level.`
}
