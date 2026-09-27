// Checklist determinista de writing (docs/user_seed.md › writing_checklist). Sin IA:
// se ejecuta siempre antes de la corrección y sus hallazgos se asocian a patrones conocidos.

export type ChecklistHit = {
  code: string
  label: string
  examples: string[]
}

const LOWERCASE_I = /(?:^|[^A-Za-z'’])(i)(?=(?:['’][a-z]+)?(?:[\s.,!?;:]|$))/g
const MISSING_APOSTROPHE = /\b(dont|doesnt|didnt|isnt|arent|wasnt|werent|cant|wont|im|ive|youre|theyre|thats|couldnt|wouldnt|shouldnt|havent|hasnt)\b/gi
// Coma seguida de un nuevo sujeto + verbo, sin conjunción: posible run-on
const RUN_ON = /,\s+(?!and\b|but\b|so\b|because\b|or\b|which\b|who\b)(i|he|she|we|they|it|my|you)\s+[a-z]+/gi
const BANNED_CLOSING = /\bthat['’]?s\s+(it|all)\b\s*[.!]?\s*$/i

export function runChecklist(text: string): ChecklistHit[] {
  const hits: ChecklistHit[] = []

  const lower = [...text.matchAll(LOWERCASE_I)]
  if (lower.length) {
    hits.push({
      code: 'lowercase_i',
      label: `"I" en minúscula (${lower.length} ${lower.length === 1 ? 'vez' : 'veces'})`,
      examples: lower.slice(0, 3).map((m) => contextAround(text, m.index ?? 0)),
    })
  }

  const apos = [...text.matchAll(MISSING_APOSTROPHE)]
  if (apos.length) {
    hits.push({
      code: 'spelling_apostrophes_capitals',
      label: 'Contracciones sin apóstrofo',
      examples: [...new Set(apos.map((m) => m[0]))].slice(0, 3),
    })
  }

  const runOns = [...text.matchAll(RUN_ON)]
  if (runOns.length) {
    hits.push({
      code: 'run_on_sentences',
      label: 'Posibles frases pegadas con coma',
      examples: runOns.slice(0, 2).map((m) => contextAround(text, m.index ?? 0)),
    })
  }

  if (BANNED_CLOSING.test(text.trim())) {
    hits.push({ code: 'underdeveloped_answers', label: 'Cierre con "that\'s it / that\'s all"', examples: [] })
  }

  return hits
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function contextAround(text: string, index: number): string {
  const start = Math.max(0, index - 18)
  return `…${text.slice(start, index + 22).trim()}…`
}
