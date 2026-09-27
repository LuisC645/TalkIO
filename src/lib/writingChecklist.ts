// Checklist de escritura en vivo (misma lógica que supabase/functions/_shared/grading/checklist.ts).
// Se muestra como aviso mientras se escribe: "la app puede revisar esto antes de cada corrección".

const LOWERCASE_I = /(?:^|[^A-Za-z'’])(i)(?=(?:['’][a-z]+)?(?:[\s.,!?;:]|$))/g
const MISSING_APOSTROPHE = /\b(dont|doesnt|didnt|isnt|arent|wasnt|werent|cant|wont|im|ive|youre|theyre|thats|couldnt|wouldnt|shouldnt|havent|hasnt)\b/gi
const BANNED_CLOSING = /\bthat['’]?s\s+(it|all)\b\s*[.!]?\s*$/i

export type LiveHint = { id: string; label: string }

export function liveHints(text: string): LiveHint[] {
  const hints: LiveHint[] = []
  const lower = text.match(LOWERCASE_I)?.length ?? 0
  if (lower) hints.push({ id: 'i', label: `"I" va en mayúscula (${lower})` })
  const apos = [...new Set((text.match(MISSING_APOSTROPHE) ?? []).map((w) => w.toLowerCase()))]
  if (apos.length) hints.push({ id: 'apos', label: `Falta apóstrofo: ${apos.slice(0, 3).join(', ')}` })
  if (BANNED_CLOSING.test(text.trim())) hints.push({ id: 'closing', label: 'Cierra con una conclusión, no con "that\'s it"' })
  return hints
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}
