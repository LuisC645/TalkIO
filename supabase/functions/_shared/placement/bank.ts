// Banco del test de nivel: 3 preguntas por nivel (A1–C1), de fácil a difícil. Las respuestas
// viven solo en el servidor. Cada pregunta tiene además la opción "No lo sé" (reduce el azar).

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type Level = (typeof LEVELS)[number]

export type PlacementQuestion = {
  id: string
  level: Exclude<Level, 'C2'>
  skill: 'grammar' | 'vocabulary'
  prompt: string
  sentence: string
  options: string[]
  answer: number
}

export const PLACEMENT_BANK: PlacementQuestion[] = [
  { id: 'a1-1', level: 'A1', skill: 'grammar', prompt: 'Completa la oración', sentence: 'She ___ a teacher.', options: ['are', 'is', 'am', 'be'], answer: 1 },
  { id: 'a1-2', level: 'A1', skill: 'grammar', prompt: 'Completa la oración', sentence: 'I ___ coffee every morning.', options: ['drink', 'drinks', 'drinking', 'am drink'], answer: 0 },
  { id: 'a1-3', level: 'A1', skill: 'vocabulary', prompt: 'Elige la palabra correcta', sentence: 'The opposite of "cheap" is ___.', options: ['small', 'easy', 'expensive', 'poor'], answer: 2 },

  { id: 'a2-1', level: 'A2', skill: 'grammar', prompt: 'Completa la oración', sentence: 'Yesterday we ___ to the beach.', options: ['go', 'gone', 'going', 'went'], answer: 3 },
  { id: 'a2-2', level: 'A2', skill: 'grammar', prompt: 'Completa la pregunta', sentence: '___ your brother work on weekends?', options: ['Does', 'Do', 'Is', 'Are'], answer: 0 },
  { id: 'a2-3', level: 'A2', skill: 'vocabulary', prompt: 'Elige la palabra correcta', sentence: 'I always ___ my teeth before bed.', options: ['clean', 'brush', 'wash', 'make'], answer: 1 },

  { id: 'b1-1', level: 'B1', skill: 'grammar', prompt: 'Completa la oración', sentence: 'I ___ in this city since 2019.', options: ['live', 'am living', 'have lived', 'lived'], answer: 2 },
  { id: 'b1-2', level: 'B1', skill: 'grammar', prompt: 'Completa la oración', sentence: 'If I ___ more time, I would travel more.', options: ['had', 'have', 'will have', 'would have'], answer: 0 },
  { id: 'b1-3', level: 'B1', skill: 'vocabulary', prompt: 'Elige la palabra correcta', sentence: 'She finished her ___ in engineering last year.', options: ['career', 'race', 'degree', 'title'], answer: 2 },

  { id: 'b2-1', level: 'B2', skill: 'grammar', prompt: 'Completa la oración', sentence: 'By the time we arrived, the movie ___.', options: ['has already started', 'had already started', 'already started', 'was already starting'], answer: 1 },
  { id: 'b2-2', level: 'B2', skill: 'grammar', prompt: 'Completa la oración', sentence: 'He suggested ___ earlier to avoid the traffic.', options: ['to leave', 'leave', 'that leaving', 'leaving'], answer: 3 },
  { id: 'b2-3', level: 'B2', skill: 'vocabulary', prompt: 'Elige la expresión correcta', sentence: 'The meeting was ___ until next week.', options: ['put off', 'put out', 'put up', 'put away'], answer: 0 },

  { id: 'c1-1', level: 'C1', skill: 'grammar', prompt: 'Completa la oración', sentence: 'Hardly ___ the room when the phone rang.', options: ['she had entered', 'did she entered', 'had she entered', 'she entered'], answer: 2 },
  { id: 'c1-2', level: 'C1', skill: 'grammar', prompt: 'Completa la oración', sentence: 'The report, ___ findings were controversial, was published anyway.', options: ['which', "who's", 'that', 'whose'], answer: 3 },
  { id: 'c1-3', level: 'C1', skill: 'vocabulary', prompt: 'Elige la palabra correcta', sentence: 'Her argument was so ___ that nobody could refute it.', options: ['compelling', 'compulsive', 'compulsory', 'complacent'], answer: 0 },
]

export const WRITING_TASK = {
  prompt: 'Tell me about yourself: what do you do on a typical day, and what did you do last weekend?',
  guidance: 'Escribe en inglés entre 40 y 120 palabras. No te preocupes por los errores: nos ayudan a conocer tu nivel.',
  min_words: 25,
}

/**
 * Nivel por preguntas: el más alto en el que acertaste al menos 2 de 3, con todos los niveles
 * anteriores también superados (regla de parada). "+" si en el siguiente acertaste al menos 1.
 * Devuelve un índice continuo: A1 = 0 … C2 = 5, +0.5 por el "+".
 */
export function levelFromAnswers(answers: (number | null)[], filter?: (q: PlacementQuestion) => boolean) {
  const byLevel = new Map<string, { correct: number; total: number }>()
  PLACEMENT_BANK.forEach((q, i) => {
    if (filter && !filter(q)) return
    const r = byLevel.get(q.level) ?? { correct: 0, total: 0 }
    r.total++
    if (answers[i] === q.answer) r.correct++
    byLevel.set(q.level, r)
  })
  let reached = -1
  for (let i = 0; i < 5; i++) {
    const r = byLevel.get(LEVELS[i])
    if (!r || r.total === 0) continue
    if (r.correct / r.total >= 0.6) reached = i
    else break
  }
  const base = Math.max(0, reached)
  const next = byLevel.get(LEVELS[base + 1])
  const plus = reached >= 0 && !!next && next.correct >= 1
  return { index: base + (plus ? 0.5 : 0), correct: [...byLevel.values()].reduce((s, r) => s + r.correct, 0) }
}

export function indexToLevel(index: number): { level: Level; plus: boolean; label: string } {
  const clamped = Math.min(Math.max(index, 0), 5)
  const base = Math.floor(clamped)
  const plus = clamped - base >= 0.5 && base < 5
  return { level: LEVELS[base], plus, label: `${LEVELS[base]}${plus ? '+' : ''}` }
}

export function levelToIndex(level: string): number {
  const plus = level.endsWith('+')
  const i = LEVELS.indexOf(level.replace('+', '') as Level)
  return Math.max(0, i) + (plus ? 0.5 : 0)
}
