-- ─────────────────────────────────────────────────────────────────────────────
-- 20. Guías por nivel: vocabulario nuevo y lectura en cada lección.
--     new_words = palabras nuevas que enseña cada lección (pasan al repaso SRS);
--     reading   = cómo es el texto de lectura del nivel (largo, tipo de texto y preguntas).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.level_guides
  add column new_words smallint not null default 5 check (new_words between 0 and 10),
  add column reading   text not null default '';

update public.level_guides set
  new_words = 6,
  vocabulary = 'very frequent everyday words only (family, food, home, numbers, days, colors, jobs, daily routine, hobbies, places in town, clothes). No rare words. New words must be concrete and easy to picture.',
  reading = '40–60 words. A very simple text in present simple: a short personal profile, a message to a friend, a description of a person, a room or a daily routine. Short sentences, no past tense. 2 comprehension questions about explicit details (who, what, where, when).'
where level = 'A1';

update public.level_guides set
  new_words = 6,
  vocabulary = 'common everyday vocabulary (travel, shopping, work, school, weather, free time, health basics, feelings) plus frequent collocations (take a bus, have breakfast, do homework).',
  reading = '70–100 words. A short email, story, blog post or notice using A2 grammar (past simple and "going to" allowed). 2–3 questions: explicit details, sequence of events and the meaning of one word from the text.'
where level = 'A2';

update public.level_guides set
  new_words = 6,
  vocabulary = 'richer vocabulary: collocations, common phrasal verbs (look for, give up, find out), linking words (however, although, because of, so that) and word families (decide / decision). Prefer useful words for work, study, opinions and experiences.',
  reading = '130–180 words. An article, blog post, opinion text or real-life story with paragraphs and connectors. 3 questions: main idea, a specific detail and an inference or the meaning of a phrase in context (at least one question must require understanding, not just finding a word).'
where level = 'B1';

update public.level_guides set
  new_words = 5,
  reading = '180–240 words. An opinion article, report or narrative with nuance. 3 questions: main idea, inference, the author''s attitude or purpose, vocabulary in context.'
where level = 'B2';

update public.level_guides set
  new_words = 5,
  reading = '220–280 words. An authentic-style article or essay with complex arguments. 3 questions: inference, implied meaning, tone and precise vocabulary in context.'
where level in ('C1', 'C2');
