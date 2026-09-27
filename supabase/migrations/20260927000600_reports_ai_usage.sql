-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Reportes semanales, uso de IA y agregados
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── weekly_reports ──────────────────────────────────────────────────────────
-- email_status queda en 'pending' mientras no se integre Resend; cuando se
-- integre, weekly-report solo tiene que enviar los 'pending' y actualizar.
create table public.weekly_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  week_start   date not null,
  week_end     date not null,
  stats        jsonb not null,                 -- salida de get_weekly_stats
  content_md   text not null,                  -- texto redactado por la IA
  model        text,
  email_status text not null default 'pending'
                 check (email_status in ('pending', 'sent', 'failed', 'skipped')),
  email_provider_id text,                      -- id del proveedor de correo (Resend) cuando exista
  email_error  text,
  sent_at      timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id, week_start),
  check (week_end = week_start + 6)
);

create index weekly_reports_user_idx on public.weekly_reports (user_id, week_start desc);

-- ─── ai_usage: costo y límites por usuario ───────────────────────────────────
create table public.ai_usage (
  id            bigint generated always as identity primary key,
  user_id       uuid references auth.users (id) on delete set null,
  function_name text not null,                 -- generate-lesson, grade-attempt, weekly-report…
  tier          text not null check (tier in ('lite', 'standard', 'pro')),
  model         text not null,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cached_tokens integer not null default 0,
  latency_ms    integer,
  success       boolean not null default true,
  error         text,
  created_at    timestamptz not null default now()
);

create index ai_usage_user_idx on public.ai_usage (user_id, created_at desc);

-- ─── get_weekly_stats: agregados de una semana (días locales) ────────────────
-- security invoker: el cliente solo ve sus datos (RLS); las Edge Functions
-- con service_role la usan para cualquier usuario.
create function public.get_weekly_stats(p_user_id uuid, p_week_start date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with params as (
    select p_week_start as ws,
           p_week_start + 6 as we,
           coalesce((select p.timezone from public.profiles p where p.id = p_user_id), 'UTC') as tz
  ),
  days as (
    select d::date as local_date
      from params, generate_series(params.ws, params.we, interval '1 day') as d
  ),
  activity as (
    select d.local_date,
           coalesce(a.xp, 0)                as xp,
           coalesce(a.active_seconds, 0)    as active_seconds,
           coalesce(a.exercises_done, 0)    as exercises_done,
           coalesce(a.lessons_completed, 0) as lessons_completed,
           coalesce(a.reviews_done, 0)      as reviews_done,
           coalesce(a.goal_met, false)      as goal_met
      from days d
      left join public.daily_activity a
        on a.user_id = p_user_id and a.local_date = d.local_date
  ),
  attempts as (
    select count(*)                                 as total,
           count(*) filter (where ea.is_correct)    as correct
      from public.exercise_attempts ea, params
     where ea.user_id = p_user_id
       and (ea.created_at at time zone params.tz)::date between params.ws and params.we
  ),
  top_errors as (
    select ep.code, ep.title, count(*) as occurrences
      from public.error_occurrences eo
      join public.error_patterns ep on ep.id = eo.pattern_id
     cross join params
     where eo.user_id = p_user_id
       and eo.source <> 'seed'
       and (eo.occurred_at at time zone params.tz)::date between params.ws and params.we
     group by ep.code, ep.title
     order by occurrences desc
     limit 5
  ),
  mastered as (
    select ep.code, ep.title
      from public.error_patterns ep, params
     where ep.user_id = p_user_id
       and (ep.mastered_at at time zone params.tz)::date between params.ws and params.we
  ),
  prev_week as (
    select coalesce(sum(a.xp), 0) as xp
      from public.daily_activity a, params
     where a.user_id = p_user_id
       and a.local_date between params.ws - 7 and params.ws - 1
  )
  select jsonb_build_object(
    'week_start', params.ws,
    'week_end',   params.we,
    'timezone',   params.tz,
    'totals', (
      select jsonb_build_object(
        'xp',             sum(xp),
        'active_minutes', sum(active_seconds) / 60,
        'exercises',      sum(exercises_done),
        'lessons',        sum(lessons_completed),
        'reviews',        sum(reviews_done),
        'days_active',    count(*) filter (where xp > 0 or exercises_done > 0 or reviews_done > 0),
        'days_goal_met',  count(*) filter (where goal_met))
        from activity),
    'previous_week_xp', (select xp from prev_week),
    'attempts', (
      select jsonb_build_object(
        'total',    total,
        'correct',  correct,
        'accuracy', case when total > 0 then round(correct::numeric / total, 3) end)
        from attempts),
    'daily',             (select jsonb_agg(to_jsonb(a) order by a.local_date) from activity a),
    'top_errors',        coalesce((select jsonb_agg(to_jsonb(t) order by t.occurrences desc) from top_errors t), '[]'::jsonb),
    'mastered_patterns', coalesce((select jsonb_agg(to_jsonb(m)) from mastered m), '[]'::jsonb),
    'active_patterns',   (select count(*) from public.error_patterns ep
                           where ep.user_id = p_user_id and ep.status = 'active'),
    'streak', (select jsonb_build_object('current', v.current_streak, 'longest', v.longest_streak)
                 from public.user_progress_view v where v.user_id = p_user_id),
    'level',  (select jsonb_build_object('level', up.level, 'total_xp', up.total_xp)
                 from public.user_progress up where up.user_id = p_user_id)
  )
  from params;
$$;

-- La programación semanal (pg_cron + pg_net → Edge Function weekly-report)
-- se agrega en la migración de esa función, cuando exista.
