-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Escritura libre con corrección (pestaña "Escribir") y fuentes nuevas de
--    errores / XP (writing, placement).
-- ─────────────────────────────────────────────────────────────────────────────

create table public.writing_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  prompt     text,
  text       text not null check (char_length(text) between 1 and 4000),
  score      numeric(4, 3) check (score between 0 and 1),
  feedback   jsonb not null default '{}'::jsonb,   -- corregido, errores, checklist, comentario
  model      text,
  created_at timestamptz not null default now()
);

create index writing_entries_user_idx on public.writing_entries (user_id, created_at desc);

alter table public.writing_entries enable row level security;
revoke all on public.writing_entries from anon;
revoke insert, update, delete, truncate, references, trigger on public.writing_entries from authenticated;
create policy "writing_entries: leer propio" on public.writing_entries
  for select to authenticated using ((select auth.uid()) = user_id);

-- Errores detectados en la escritura libre
alter table public.error_occurrences drop constraint error_occurrences_source_check;
alter table public.error_occurrences add constraint error_occurrences_source_check
  check (source in ('seed', 'exercise', 'conversation', 'placement', 'writing'));

-- XP por escritura libre
alter table public.xp_events drop constraint xp_events_source_check;
alter table public.xp_events add constraint xp_events_source_check
  check (source in ('exercise', 'lesson', 'review', 'streak_bonus', 'placement', 'adjustment', 'writing'));

-- Las habilidades evaluadas en el test incluyen vocabulario (sin cambios de esquema: skills es jsonb)
