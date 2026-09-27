-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Lecciones, ejercicios e intentos
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── lessons ─────────────────────────────────────────────────────────────────
create table public.lessons (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  title             text not null,
  cefr_level        public.cefr_level not null,
  focus_pattern_ids uuid[] not null default '{}',
  topic_id          uuid references public.topics (id) on delete set null,
  status            text not null default 'ready'
                      check (status in ('generating', 'ready', 'in_progress', 'completed', 'failed')),
  content           jsonb not null default '{}'::jsonb,   -- regla, explicación, metadatos de fases
  model             text,
  prompt_version    text,
  score             numeric(5, 2) check (score between 0 and 100),
  xp_earned         integer not null default 0,
  generated_at      timestamptz not null default now(),
  started_at        timestamptz,
  completed_at      timestamptz,
  unique (id, user_id)                                    -- destino de la FK compuesta de exercises
);

create index lessons_user_status_idx on public.lessons (user_id, status, generated_at desc);

-- ─── exercises ───────────────────────────────────────────────────────────────
-- `type` es texto libre validado en la app (zod), no enum: agregar tipos nuevos
-- (p. ej. speaking_prompt con audio en fase 2) no requiere migración.
-- Tipos actuales: multiple_choice, fill_blank, reorder, transform, error_detection,
-- tense_contrast, free_writing, speaking_prompt.
create table public.exercises (
  id                uuid primary key default gen_random_uuid(),
  lesson_id         uuid not null,
  user_id           uuid not null,
  position          smallint not null,
  phase             text not null check (phase in ('warmup', 'rule', 'drill', 'free')),
  type              text not null check (type ~ '^[a-z][a-z0-9_]*$'),
  payload           jsonb not null,                 -- enunciado, opciones, pistas…
  answer_key        jsonb,                          -- respuestas aceptadas; null si lo califica la IA
  grading           text not null check (grading in ('rule', 'ai')),
  target_pattern_id uuid references public.error_patterns (id) on delete set null,
  target_vocab_id   uuid references public.vocab_items (id) on delete set null,
  created_at        timestamptz not null default now(),
  foreign key (lesson_id, user_id) references public.lessons (id, user_id) on delete cascade,
  unique (lesson_id, position)
);

create index exercises_user_idx on public.exercises (user_id);

-- ─── exercise_attempts ───────────────────────────────────────────────────────
create table public.exercise_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  lesson_id   uuid not null references public.lessons (id) on delete cascade,
  response    jsonb not null,
  is_correct  boolean,
  score       numeric(4, 3) check (score between 0 and 1),
  feedback    jsonb not null default '{}'::jsonb,   -- explicación, corrección, errores detectados
  graded_by   text not null check (graded_by in ('rule', 'ai')),
  model       text,
  duration_ms integer check (duration_ms >= 0),
  created_at  timestamptz not null default now()
);

create index exercise_attempts_user_idx on public.exercise_attempts (user_id, created_at desc);
create index exercise_attempts_exercise_idx on public.exercise_attempts (exercise_id);

alter table public.error_occurrences
  add constraint error_occurrences_attempt_fk
  foreign key (attempt_id) references public.exercise_attempts (id) on delete set null;

-- ─── Vista para el cliente: ejercicios SIN answer_key ────────────────────────
-- security_invoker → aplica la RLS de exercises con los permisos de quien consulta.
create view public.exercises_public
with (security_invoker = true)
as
select id, lesson_id, user_id, position, phase, type, payload, grading,
       target_pattern_id, target_vocab_id, created_at
  from public.exercises;
