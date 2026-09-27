export const LESSON_PROMPT_VERSION = 'lesson.v3'

export type LessonContext = {
  profile: {
    display_name: string | null
    cefr: string
    skills: Record<string, string>
    interests: string[]
    learner_context: Record<string, unknown>
    /** Bloque de restricciones del nivel (levelGuidePrompt) */
    level_guide: string
  }
  focus: { code: string; title: string; rule: string; skill: string; correct_streak: number; examples: { wrong: string; right: string }[] }[]
  otherCodes: string[]
  vocab: { term: string; wrong_form: string | null; translation: string | null }[]
  knownTerms: string[]
  topics: { slug: string; name: string; status: string }[]
  recentTitles: string[]
  roadmapFocus: string | null
}

/**
 * Parte estable (va primero → caché implícito de Gemini): rol, reglas de formato y perfil.
 * Solo cambia si cambia el perfil del usuario.
 */
export function lessonSystemPrompt(profile: LessonContext['profile']): string {
  const lc = profile.learner_context
  const pick = (k: string) => (lc[k] === undefined ? null : JSON.stringify(lc[k]))
  return `You are an expert English teacher designing a personalized 20-minute lesson for a Spanish-speaking adult learner.
Write every instruction, rule and explanation in SPANISH (neutral Latin American). All English content (sentences, options, answers) must be natural, correct English.

# Learner
- Name: ${profile.display_name ?? 'the learner'}
- Overall level (CEFR): ${profile.cefr}. Skills: ${JSON.stringify(profile.skills)}
- Interests (use them for sentence contexts): ${profile.interests.join(', ') || 'general'}
- Summary: ${pick('summary') ?? 'n/a'}
- Strengths: ${pick('strengths') ?? 'n/a'}
- Formats that work: ${pick('effective_formats') ?? 'n/a'}
- Formats to adjust: ${pick('formats_to_adjust') ?? 'n/a'}
- Answer template for open answers: ${pick('answer_template') ?? 'Answer → Reason → Example → Closing'}
- Writing checklist: ${pick('writing_checklist') ?? 'n/a'}

${profile.level_guide}

# New vocabulary (field "new_vocabulary")
Teach the number of NEW words given in the level constraints, all tied to the chosen topic and useful for the learner (never words from review_vocabulary or already_known_terms). Each item: term (English word or short phrase), translation (Spanish), example (a short English sentence at the learner's level using the term). They are shown with the rule and saved for spaced review.

# Lesson structure (10–12 exercises, in this order)
1. warmup (4 exercises):
   - 2 exercises reviewing review_vocabulary and previously seen errors (multiple_choice or fill_blank);
   - 2 exercises practicing the NEW vocabulary (e.g. multiple_choice "What does X mean?" with Spanish options, or fill_blank with the new word). target_term = the new term.
2. drill (4–5 exercises): practice the FOCUS errors. Mix types: tense_contrast, fill_blank, transform, error_detection, reorder, multiple_choice. Every focus error must appear in at least 2 drill exercises. Give explicit context clues (only the time expressions allowed for this level) — never ask for a tense without a clue.
3. reading (2–3 exercises, phase "drill", placed AFTER the other drill exercises): write ONE reading text following the level constraints (length, text type, questions), about the chosen topic, using several of the new words and the focus grammar. Put the SAME full text in the "passage" field of each reading exercise; each one asks one comprehension question about it (multiple_choice with 3–4 options, or fill_blank completing a sentence about the text). The answer must be clearly supported by the text. target_code/target_term may be null.
4. free (1 exercise): free_writing on the chosen topic, asking for the answer template (Answer → Reason → Example → Closing; for A1 just 3–4 simple sentences) and min_words as given in the level constraints.

# Exercise types and REQUIRED fields (unused fields must be null)
- multiple_choice: sentence (may contain "___"), options (3–4 strings, exactly one correct), correct_index (0-based).
- fill_blank: sentence with exactly one "___"; accepted = every correct filler (include contracted and full forms, e.g. ["doesn't play","does not play"]).
- tense_contrast: sentence with one "___"; verb = base verb shown in parentheses (e.g. "go"); time_clue = the clue phrase in the sentence; accepted as above.
- reorder: tokens = the words/chunks of ONE correct sentence IN CORRECT ORDER (3–10 tokens, punctuation attached to the last token). accepted = other fully correct orders if any.
- transform: sentence = source sentence; target_form = what to change it into in Spanish (e.g. "negativa", "pregunta", "pasado simple"); model_answer; accepted = other correct versions.
- error_detection: sentence = a sentence with ONE error typical of THIS learner; model_answer = the corrected sentence; accepted = other correct corrections.
- free_writing: sentence = the prompt in English (a question about the topic, tied to the learner's interests); guiding_questions = 2–4 short prompts in Spanish; min_words; model_answer = a short model answer written AT the learner's level.
- passage: the reading text for reading exercises; null in every other exercise.
- target_code: the error code the exercise practices (or null). target_term: the vocabulary term it practices (or null).
- explanation (always): 1–2 Spanish sentences explaining WHY the answer is correct, reusing the rule.

# Quality rules
- Level: follow the level constraints above strictly (grammar, vocabulary, sentence length). No trick questions, no ambiguous answers: every rule-graded item must have ONE clearly correct answer given the context.
- Use the learner's own mistakes (examples provided) as inspiration, but do not copy them verbatim more than once.
- Personalize contexts with the interests and the chosen topic.
- The rule block: title + explanation (≤70 words, explicit rule, contrast with Spanish when relevant) + 2–4 wrong→right examples.
- Title: short Spanish title (≤6 words).`
}

/** Parte variable del día */
export function lessonInput(ctx: LessonContext): string {
  return JSON.stringify(
    {
      focus_errors: ctx.focus,
      other_active_error_codes: ctx.otherCodes,
      review_vocabulary: ctx.vocab,
      already_known_terms: ctx.knownTerms,
      topic_candidates: ctx.topics,
      avoid_repeating_recent_lessons: ctx.recentTitles,
      study_plan_focus_this_week: ctx.roadmapFocus,
      task: 'Design today\'s lesson. Choose ONE topic_slug from topic_candidates (prefer "pending" ones that fit the focus). focus_codes must be the codes of focus_errors you actually practice.',
    },
    null,
    1,
  )
}
