// Catálogo de errores frecuentes de hispanohablantes aprendiendo inglés. La IA clasifica cada
// error con uno de estos códigos; si el usuario aún no tiene ese patrón, se crea al detectarlo.
// Los códigos coinciden con los del seed (docs/user_seed.json) para mantener un solo registro.

export type CatalogPattern = {
  code: string
  title: string
  rule: string
  category: string
  skill: 'speaking' | 'writing' | 'both'
  priority: number
}

export const PATTERN_CATALOG: CatalogPattern[] = [
  { code: 'past_tense_narration', title: 'Pasado al narrar', rule: 'Para contar algo que ya pasó, todos los verbos van en pasado simple (went, visited, had).', category: 'grammar', skill: 'both', priority: 5 },
  { code: 'present_continuous_aux', title: 'Presente continuo sin auxiliar', rule: 'Presente continuo = am/is/are + verbo-ing: I am working, It is raining.', category: 'grammar', skill: 'both', priority: 4 },
  { code: 'do_does_base_form', title: 'do/does + verbo base', rule: 'Después de do/does/don\'t/doesn\'t el verbo va en forma base: Does she study? He doesn\'t play.', category: 'grammar', skill: 'both', priority: 5 },
  { code: 'third_person_s', title: 'Tercera persona (-s)', rule: 'En presente simple, he/she/it lleva -s en el verbo: She works, He watches.', category: 'grammar', skill: 'both', priority: 4 },
  { code: 'subject_verb_agreement', title: 'Concordancia sujeto-verbo', rule: 'El verbo concuerda con el sujeto: People are, The news is, There are many.', category: 'grammar', skill: 'both', priority: 3 },
  { code: 'articles', title: 'Artículos (a / an / the / Ø)', rule: 'Sin "the" con conceptos generales (people, math); a/an según el sonido inicial (an hour, a university).', category: 'grammar', skill: 'both', priority: 5 },
  { code: 'prepositions_time_place', title: 'Preposiciones de tiempo y lugar', rule: 'on + días, in + meses/partes del día, at + horas/lugares puntuales: on Monday, in the evening, at 7.', category: 'grammar', skill: 'both', priority: 3 },
  { code: 'present_perfect_experience', title: 'Presente perfecto', rule: 'Experiencias sin momento definido o acciones que siguen: I have visited, I have lived here since 2020.', category: 'grammar', skill: 'both', priority: 3 },
  { code: 'conditionals', title: 'Condicionales', rule: 'Segundo condicional: If + pasado, would + verbo base: If I had time, I would travel.', category: 'grammar', skill: 'both', priority: 3 },
  { code: 'gerund_infinitive', title: 'Gerundio o infinitivo', rule: 'Algunos verbos van con -ing (enjoy, suggest) y otros con to + verbo (want, decide).', category: 'grammar', skill: 'both', priority: 2 },
  { code: 'comparatives_superlatives', title: 'Comparativos y superlativos', rule: 'Cortos: bigger/the biggest. Largos: more interesting/the most interesting. Nunca "more bigger".', category: 'grammar', skill: 'both', priority: 2 },
  { code: 'plural_nouns', title: 'Plurales', rule: 'Los sustantivos contables en plural llevan -s; los incontables no (information, advice).', category: 'grammar', skill: 'both', priority: 2 },
  { code: 'missing_subject_verb', title: 'Sujeto o verbo omitido', rule: 'En inglés toda oración necesita sujeto y verbo: It is important (no "Is important").', category: 'grammar', skill: 'both', priority: 3 },
  { code: 'word_order', title: 'Orden de la oración', rule: 'Sujeto + verbo + objeto + lugar + tiempo; el adjetivo va antes del sustantivo (a red car).', category: 'grammar', skill: 'both', priority: 3 },
  { code: 'some_any_negatives', title: 'some / any', rule: 'En negativas y preguntas se usa any/anything: I don\'t have any time.', category: 'grammar', skill: 'both', priority: 2 },
  { code: 'false_friends_calques', title: 'Falsos amigos y calcos', rule: 'No traduzcas palabra por palabra: carrera = degree, actually = en realidad, make/do según la acción.', category: 'false_friend', skill: 'both', priority: 4 },
  { code: 'vocabulary_word_choice', title: 'Elección de palabras', rule: 'Usa la palabra o colocación natural en inglés: make a decision, take a photo, do homework.', category: 'vocabulary', skill: 'both', priority: 2 },
  { code: 'lowercase_i', title: '"I" en minúscula', rule: 'El pronombre I siempre va en mayúscula, también en I\'m, I\'ve, I\'d.', category: 'spelling', skill: 'writing', priority: 3 },
  { code: 'spelling_apostrophes_capitals', title: 'Ortografía, apóstrofos y mayúsculas', rule: 'Contracciones con apóstrofo (don\'t, I\'m) y nombres propios, días y meses con mayúscula.', category: 'spelling', skill: 'writing', priority: 3 },
  { code: 'run_on_sentences', title: 'Frases pegadas con coma', rule: 'No unas dos oraciones solo con coma: separa con punto o usa and / but / so / because.', category: 'punctuation', skill: 'writing', priority: 3 },
  { code: 'underdeveloped_answers', title: 'Respuestas sin desarrollo', rule: 'Responde con Answer → Reason (because…) → Example (for example…) → Closing (so…).', category: 'fluency', skill: 'both', priority: 3 },
]

export const CATALOG_BY_CODE = new Map(PATTERN_CATALOG.map((p) => [p.code, p]))

/** Lista para el prompt de calificación: los del usuario + el catálogo (sin duplicados) */
export function codesForPrompt(userPatterns: { code: string; title: string }[]) {
  const seen = new Set(userPatterns.map((p) => p.code))
  return [...userPatterns, ...PATTERN_CATALOG.filter((p) => !seen.has(p.code)).map((p) => ({ code: p.code, title: p.title }))]
}

/** Foco sugerido por nivel cuando el usuario aún tiene pocos errores registrados */
export function suggestedFocus(cefr: string): CatalogPattern[] {
  // Respaldo si la tabla level_guides no tiene el nivel (la fuente principal es la tabla)
  const codes = cefr.startsWith('A1')
    ? ['third_person_s', 'do_does_base_form', 'articles']
    : cefr.startsWith('A')
    ? ['do_does_base_form', 'past_tense_narration', 'present_continuous_aux']
    : cefr.startsWith('B')
      ? ['present_perfect_experience', 'conditionals', 'gerund_infinitive']
      : ['conditionals', 'vocabulary_word_choice', 'gerund_infinitive']
  return codes.map((c) => CATALOG_BY_CODE.get(c)!).filter(Boolean)
}
