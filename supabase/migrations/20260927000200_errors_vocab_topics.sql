-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Temas, patrones de error y vocabulario
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── topics: catálogo global ─────────────────────────────────────────────────
create table public.topics (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  category    text not null,          -- personal, career, technical, travel, opinion, work…
  description text,
  created_at  timestamptz not null default now()
);

-- ─── user_topics: qué temas practicó cada usuario ────────────────────────────
create table public.user_topics (
  user_id           uuid not null references auth.users (id) on delete cascade,
  topic_id          uuid not null references public.topics (id) on delete cascade,
  status            text not null default 'pending' check (status in ('pending', 'practiced')),
  times_practiced   integer not null default 0,
  last_practiced_at timestamptz,
  primary key (user_id, topic_id)
);

-- ─── error_patterns: errores recurrentes (regla de N aciertos seguidos) ──────
create table public.error_patterns (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  code              text not null,                 -- ej. past_tense_speaking, articles, lowercase_i
  title             text not null,
  rule              text not null,                 -- explicación corta de la regla
  category          text not null,                 -- grammar, false_friend, spelling, punctuation, fluency…
  skill             text not null check (skill in ('speaking', 'writing', 'both')),
  priority          smallint not null default 3 check (priority between 1 and 5),  -- 5 = más alta
  correct_streak    smallint not null default 0 check (correct_streak >= 0),
  mastery_threshold smallint not null default 3 check (mastery_threshold > 0),
  status            text not null default 'active' check (status in ('active', 'mastered')),
  occurrences       integer not null default 0,
  last_seen_at      timestamptz,
  mastered_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, code)
);

create index error_patterns_active_idx
  on public.error_patterns (user_id, priority desc)
  where status = 'active';

create trigger error_patterns_updated_at
  before update on public.error_patterns
  for each row execute function public.set_updated_at();

-- ─── error_occurrences: cada vez que aparece un error ────────────────────────
create table public.error_occurrences (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  pattern_id     uuid not null references public.error_patterns (id) on delete cascade,
  attempt_id     uuid,                             -- FK se agrega en la migración 3
  wrong_text     text not null,
  corrected_text text not null,
  context        text,
  source         text not null check (source in ('seed', 'exercise', 'conversation', 'placement')),
  occurred_at    timestamptz not null default now()
);

create index error_occurrences_user_idx on public.error_occurrences (user_id, occurred_at desc);
create index error_occurrences_pattern_idx on public.error_occurrences (pattern_id);

-- ─── vocab_items: vocabulario, colocaciones y falsos amigos ──────────────────
create table public.vocab_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  term        text not null,                       -- forma correcta en inglés
  wrong_form  text,                                -- lo que el usuario dijo, si aplica
  translation text,                                -- español
  kind        text not null check (kind in
                ('word', 'collocation', 'false_friend', 'phrasal_verb', 'expression', 'structure')),
  topic_id    uuid references public.topics (id) on delete set null,
  example     text,
  notes       text,
  created_at  timestamptz not null default now()
);

create unique index vocab_items_user_term_uidx on public.vocab_items (user_id, lower(term));
create index vocab_items_topic_idx on public.vocab_items (topic_id);

-- ─── Regla de dominio: N aciertos seguidos → mastered; un fallo reinicia ─────
-- La llama grade-attempt (service_role) después de calificar un ejercicio.
create function public.record_pattern_result(p_pattern_id uuid, p_correct boolean)
returns public.error_patterns
language plpgsql
set search_path = ''
as $$
declare
  v_row public.error_patterns;
begin
  if p_correct then
    update public.error_patterns
       set correct_streak = correct_streak + 1,
           status       = case when correct_streak + 1 >= mastery_threshold then 'mastered' else status end,
           mastered_at  = case when correct_streak + 1 >= mastery_threshold and status <> 'mastered'
                               then now() else mastered_at end
     where id = p_pattern_id
     returning * into v_row;
  else
    update public.error_patterns
       set correct_streak = 0,
           status       = 'active',
           mastered_at  = null,
           occurrences  = occurrences + 1,
           last_seen_at = now()
     where id = p_pattern_id
     returning * into v_row;
  end if;
  return v_row;
end;
$$;
