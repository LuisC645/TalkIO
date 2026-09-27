-- ─────────────────────────────────────────────────────────────────────────────
-- 19. Guías por nivel CEFR: qué gramática, vocabulario y longitud corresponden a cada nivel.
--     Es la referencia que recibe la IA (Gemini) al crear lecciones y exámenes semanales: se lee
--     con el nivel ACTUAL del perfil, así que al subir o bajar de nivel las lecciones nuevas se
--     ajustan solas. Editar una fila cambia las próximas lecciones sin desplegar código.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.level_guides (
  level              text primary key check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  grammar            text not null,              -- gramática que se puede usar y practicar
  avoid              text not null,              -- gramática que nunca debe aparecer
  vocabulary         text not null,
  sentence_words     text not null,              -- largo de las oraciones (palabras), p. ej. '3–9'
  free_writing_words text not null,              -- min_words del ejercicio de escritura libre
  time_clues         text not null,              -- pistas de tiempo permitidas en los ejercicios
  focus_codes        text[] not null default '{}', -- errores típicos del nivel (usuario nuevo)
  blocked_patterns   text[] not null default '{}', -- errores que no se practican en este nivel
  updated_at         timestamptz not null default now()
);

alter table public.level_guides enable row level security;
revoke all on public.level_guides from anon;
revoke insert, update, delete, truncate, references, trigger on public.level_guides from authenticated;
create policy "level_guides: leer catálogo" on public.level_guides
  for select to authenticated using (true);

insert into public.level_guides
  (level, grammar, avoid, vocabulary, sentence_words, free_writing_words, time_clues, focus_codes, blocked_patterns)
values
  ('A1',
   'verb "to be" (am/is/are), present simple (affirmative, negative with don''t/doesn''t, questions with do/does), third person -s, "there is / there are", "have got / has", "can" for ability, subject and object pronouns, possessive adjectives (my, your, his…), a/an/the, regular plurals, this/that/these/those, basic prepositions (in, on, at, under, next to), imperatives, simple wh- questions (what, where, who, how old).',
   'ANY past tense (was/were, -ed, irregular past), present continuous, present perfect, future forms, conditionals, passive voice, modal verbs other than "can", gerund vs infinitive, comparatives, relative clauses, phrasal verbs, idioms.',
   'very frequent everyday words only (family, food, home, numbers, days, colors, jobs, daily routine, hobbies). No rare words.',
   '3–9', '25–40',
   '"every day", "usually", "on Mondays", "always", "never", "at 7 o''clock"',
   array['third_person_s', 'do_does_base_form', 'articles'],
   array['past_tense_narration', 'present_continuous_aux', 'present_perfect_experience', 'conditionals', 'gerund_infinitive', 'comparatives_superlatives', 'some_any_negatives', 'run_on_sentences', 'underdeveloped_answers']),
  ('A2',
   'everything from A1 plus present continuous (am/is/are + -ing), present simple vs present continuous, past simple of "to be" and of regular/common irregular verbs (affirmative, negative, questions), "going to" for plans, comparatives and superlatives, some/any, countable/uncountable with much/many, adverbs of frequency, can/can''t/must/have to, prepositions of time (in/on/at).',
   'present perfect, past continuous, past perfect, second/third conditionals, passive voice, reported speech, complex relative clauses, advanced phrasal verbs and idioms.',
   'common everyday vocabulary (travel, shopping, work, school, weather, free time, health basics).',
   '5–12', '40–60',
   '"yesterday", "last week", "right now", "at the moment", "every day", "tomorrow", "next weekend"',
   array['do_does_base_form', 'past_tense_narration', 'present_continuous_aux'],
   array['present_perfect_experience', 'conditionals', 'gerund_infinitive']),
  ('B1',
   'everything from A2 plus present perfect (experience, "for/since", "already/yet/just"), past continuous vs past simple, "will" vs "going to", first and second conditionals, gerund vs infinitive after common verbs, basic passive (present/past), defining relative clauses (who/which/that), used to, should/might/could.',
   'third and mixed conditionals, advanced passive forms, inversion, rare idioms.',
   'wider everyday and work vocabulary, common collocations and phrasal verbs.',
   '6–16', '60–90',
   '"since 2020", "for two years", "ever", "already", "while", "last year", "right now", "by next week"',
   array['present_perfect_experience', 'conditionals', 'gerund_infinitive'],
   array[]::text[]),
  ('B2',
   'everything from B1 plus present perfect continuous, past perfect, third and mixed conditionals, passive in all common tenses, reported speech, modals of deduction (must have / might have), non-defining relative clauses, wish/if only.',
   'very literary or archaic structures.',
   'broad vocabulary including abstract topics, collocations, common idioms and phrasal verbs.',
   '8–20', '90–130',
   'natural context of any tense; clues can be less explicit',
   array['conditionals', 'vocabulary_word_choice', 'gerund_infinitive'],
   array[]::text[]),
  ('C1',
   'any structure, including inversion, cleft sentences, advanced modals, nuanced tense contrasts and formal/informal register.',
   'nothing specific; keep sentences natural.',
   'precise, nuanced and idiomatic vocabulary.',
   '8–24', '120–160',
   'implicit context is fine',
   array['conditionals', 'vocabulary_word_choice', 'gerund_infinitive'],
   array[]::text[]),
  ('C2',
   'any structure, including inversion, cleft sentences, advanced modals, nuanced tense contrasts and formal/informal register.',
   'nothing specific; keep sentences natural.',
   'precise, nuanced and idiomatic vocabulary at native-like level.',
   '8–24', '120–160',
   'implicit context is fine',
   array['conditionals', 'vocabulary_word_choice', 'gerund_infinitive'],
   array[]::text[]);
