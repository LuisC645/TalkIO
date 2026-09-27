-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Repetición espaciada (FSRS). Columnas = Card / ReviewLog de ts-fsrs v5.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── srs_cards ───────────────────────────────────────────────────────────────
-- Una carta apunta a un vocab_item o a un error_pattern (FKs reales, no polimórficas).
create table public.srs_cards (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  item_type      text not null check (item_type in ('vocab', 'pattern')),
  vocab_id       uuid references public.vocab_items (id) on delete cascade,
  pattern_id     uuid references public.error_patterns (id) on delete cascade,
  -- ts-fsrs Card
  due            timestamptz not null default now(),
  stability      double precision not null default 0,
  difficulty     double precision not null default 0,
  elapsed_days   integer not null default 0,        -- deprecated en ts-fsrs 6, se conserva por compatibilidad
  scheduled_days integer not null default 0,
  learning_steps integer not null default 0,
  reps           integer not null default 0,
  lapses         integer not null default 0,
  state          smallint not null default 0 check (state between 0 and 3),  -- New, Learning, Review, Relearning
  last_review    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (
    (item_type = 'vocab'   and vocab_id is not null and pattern_id is null) or
    (item_type = 'pattern' and pattern_id is not null and vocab_id is null)
  )
);

create unique index srs_cards_vocab_uidx   on public.srs_cards (user_id, vocab_id)   where vocab_id is not null;
create unique index srs_cards_pattern_uidx on public.srs_cards (user_id, pattern_id) where pattern_id is not null;
create index srs_cards_due_idx on public.srs_cards (user_id, due);

create trigger srs_cards_updated_at
  before update on public.srs_cards
  for each row execute function public.set_updated_at();

-- ─── srs_review_logs ─────────────────────────────────────────────────────────
create table public.srs_review_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  card_id           uuid not null references public.srs_cards (id) on delete cascade,
  -- ts-fsrs ReviewLog
  rating            smallint not null check (rating between 1 and 4),   -- Again, Hard, Good, Easy
  state             smallint not null check (state between 0 and 3),
  due               timestamptz not null,
  stability         double precision not null,
  difficulty        double precision not null,
  elapsed_days      integer not null,
  last_elapsed_days integer not null,
  scheduled_days    integer not null,
  learning_steps    integer not null,
  review            timestamptz not null,
  duration_ms       integer check (duration_ms >= 0),
  created_at        timestamptz not null default now()
);

create index srs_review_logs_user_idx on public.srs_review_logs (user_id, review desc);
create index srs_review_logs_card_idx on public.srs_review_logs (card_id);

-- record_review (RPC que usa el cliente) se define en la migración 5,
-- porque además otorga XP y actualiza la actividad diaria.
