-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Row Level Security y privilegios
--
-- Modelo: el cliente (rol authenticated) LEE solo sus filas y casi no escribe.
--   · Escribe directamente: columnas editables de profiles.
--   · Escribe vía RPC:      record_review (security definer, valida auth.uid()).
--   · Todo lo demás (lecciones, intentos, XP, errores, reportes) lo escriben las
--     Edge Functions con service_role, que ignora la RLS.
-- anon no tiene acceso a nada.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Habilitar RLS en todas las tablas ────────────────────────────────────
alter table public.profiles           enable row level security;
alter table public.level_assessments  enable row level security;
alter table public.placement_sessions enable row level security;
alter table public.topics             enable row level security;
alter table public.user_topics        enable row level security;
alter table public.error_patterns     enable row level security;
alter table public.error_occurrences  enable row level security;
alter table public.vocab_items        enable row level security;
alter table public.lessons            enable row level security;
alter table public.exercises          enable row level security;
alter table public.exercise_attempts  enable row level security;
alter table public.srs_cards          enable row level security;
alter table public.srs_review_logs    enable row level security;
alter table public.user_progress      enable row level security;
alter table public.daily_activity     enable row level security;
alter table public.xp_events          enable row level security;
alter table public.weekly_reports     enable row level security;
alter table public.ai_usage           enable row level security;   -- sin políticas: solo service_role

-- ─── 2. Privilegios de tabla (defensa en profundidad además de la RLS) ───────
revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from authenticated;

-- profiles: solo columnas editables por el usuario
grant update (display_name, timezone, daily_goal_xp, daily_goal_minutes, interests, weekly_report_email)
  on public.profiles to authenticated;

-- exercises: todo menos answer_key (el cliente usa la vista exercises_public)
revoke select on public.exercises from authenticated;
grant select (id, lesson_id, user_id, position, phase, type, payload, grading,
              target_pattern_id, target_vocab_id, created_at)
  on public.exercises to authenticated;

-- ai_usage: invisible para el cliente
revoke select on public.ai_usage from authenticated;

-- ─── 3. Políticas SELECT "solo mis filas" ────────────────────────────────────
create policy "profiles: leer propio" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: editar propio" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "level_assessments: leer propio" on public.level_assessments
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "placement_sessions: leer propio" on public.placement_sessions
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "topics: leer catálogo" on public.topics
  for select to authenticated using (true);
create policy "user_topics: leer propio" on public.user_topics
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "error_patterns: leer propio" on public.error_patterns
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "error_occurrences: leer propio" on public.error_occurrences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "vocab_items: leer propio" on public.vocab_items
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "lessons: leer propio" on public.lessons
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "exercises: leer propio" on public.exercises
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "exercise_attempts: leer propio" on public.exercise_attempts
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "srs_cards: leer propio" on public.srs_cards
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "srs_review_logs: leer propio" on public.srs_review_logs
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "user_progress: leer propio" on public.user_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "daily_activity: leer propio" on public.daily_activity
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "xp_events: leer propio" on public.xp_events
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "weekly_reports: leer propio" on public.weekly_reports
  for select to authenticated using ((select auth.uid()) = user_id);

-- ─── 4. Vistas (security_invoker → aplican la RLS de las tablas base) ────────
revoke all on public.exercises_public, public.user_progress_view from anon, authenticated;
grant select on public.exercises_public, public.user_progress_view to authenticated;

-- ─── 5. Funciones: nadie las ejecuta salvo las permitidas explícitamente ─────
-- (service_role conserva sus permisos; los triggers no requieren EXECUTE)
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.record_review(uuid, jsonb, jsonb, integer)   to authenticated;
grant execute on function public.get_weekly_stats(uuid, date)                to authenticated;
grant execute on function public.user_local_date(uuid, timestamptz)          to authenticated;
grant execute on function public.xp_for_level(integer)                       to authenticated;
grant execute on function public.level_for_xp(bigint)                        to authenticated;

-- Nota: Supabase otorga EXECUTE por defecto a anon/authenticated en funciones
-- nuevas. Toda migración futura que cree funciones internas debe revocarlo.
