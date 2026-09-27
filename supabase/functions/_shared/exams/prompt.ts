export const EXAM_PROMPT_VERSION = 'exam.v3'

type Base = {
  cefr: string
  interests: string[]
  /** Restricciones del nivel (levelGuidePrompt) */
  levelGuide: string
}

const COMMON = `You write English EXAMS for a Spanish-speaking adult learner. Instructions and explanations in SPANISH; all English content natural and correct.
Output format is the same lesson JSON: "rule" = what the exam covers (title + short Spanish explanation + 2 wrong→right examples), "exercises" = the questions.
EXAM RULES:
- hint MUST be null in every exercise (no help during exams).
- Every rule-graded item (multiple_choice, fill_blank, tense_contrast, reorder) must have exactly ONE clearly correct answer given the context; include contracted and full forms in "accepted".
- Mix types; no two consecutive exercises of the same type. Use the learner's interests for contexts.
- Field requirements per type are the same as in lessons (unused fields null): multiple_choice (sentence, options 3–4, correct_index), fill_blank (sentence with one "___", accepted), tense_contrast (sentence with "___", verb, time_clue, accepted), reorder (tokens in correct order), transform (sentence, target_form, model_answer, accepted), error_detection (sentence with ONE error, model_answer, accepted), free_writing (sentence = prompt in English, guiding_questions, min_words, model_answer).
- explanation (always, Spanish, 1–2 sentences) is shown in the results review after the exam.
- new_vocabulary must be null and passage must be null in every exercise (the level reference below describes lessons; use only its grammar, vocabulary and length rules).`

export function weeklyExamPrompt(b: Base) {
  return `${COMMON}
WEEKLY EXAM: 10 exercises, all phase "drill", at the learner's level (${b.cefr}), covering ONLY what the learner practiced this week (given below): the rules, the focus errors and their own recent mistakes. Slightly harder than the lessons (less obvious contexts), still fair and within the learner's level. No free_writing.
Learner interests: ${b.interests.join(', ') || 'general'}.

${b.levelGuide}`
}

export function levelExamPrompt(b: Base & { target: string }) {
  return `${COMMON}
LEVEL-UP EXAM: the learner is ${b.cefr} and wants to reach ${b.target}. Write 12 exercises at ${b.target} difficulty (genuinely harder than ${b.cefr}: ${b.target}-level grammar, vocabulary range and sentence complexity), phase "drill", covering the core ${b.target} grammar and vocabulary of the CEFR, plus 1 final free_writing (phase "free", min_words as in the target level reference) with a ${b.target}-level task. Total 13.
Learner interests: ${b.interests.join(', ') || 'general'}.

Reference for the TARGET level ${b.target} (write the exam with this, not above it):
${b.levelGuide}`
}
