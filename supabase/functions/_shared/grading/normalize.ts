// Comparación tolerante para ejercicios calificados por regla: ignora mayúsculas, espacios,
// puntuación final y el tipo de apóstrofo, y trata contracciones y formas completas como iguales.

const CONTRACTIONS: [RegExp, string][] = [
  [/\bcan't\b/g, 'cannot'],
  [/\bcan not\b/g, 'cannot'],
  [/\bwon't\b/g, 'will not'],
  [/\bshan't\b/g, 'shall not'],
  [/\blet's\b/g, 'let us'],
  [/\bi'm\b/g, 'i am'],
  [/\b(you|we|they)'re\b/g, '$1 are'],
  [/\b(he|she|it|that|there|what)'s\b/g, '$1 is'],
  [/\b(i|you|we|they)'ve\b/g, '$1 have'],
  [/\b(i|you|he|she|we|they)'ll\b/g, '$1 will'],
  [/\b(i|you|he|she|we|they)'d\b/g, '$1 would'],
  [/\b(\w+)n't\b/g, '$1 not'],
]

export function normalize(text: string): string {
  let s = text
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/[.!?]+$/, '')
    .trim()
  for (const [re, rep] of CONTRACTIONS) s = s.replace(re, rep)
  return s
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

/**
 * exact: coincide con alguna respuesta aceptada.
 * typo: le falta/sobra/cambia 1 letra en una respuesta de ≥5 caracteres (se acepta con aviso).
 */
export function matchAccepted(answer: string, accepted: string[]): { match: 'exact' | 'typo' | null; expected: string } {
  const a = normalize(answer)
  for (const acc of accepted) if (normalize(acc) === a) return { match: 'exact', expected: acc }
  for (const acc of accepted) {
    const n = normalize(acc)
    if (n.length >= 5 && levenshtein(a, n) === 1) return { match: 'typo', expected: acc }
  }
  return { match: null, expected: accepted[0] ?? '' }
}
