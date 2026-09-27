-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tipos base, perfil y nivel
-- ─────────────────────────────────────────────────────────────────────────────

create type public.cefr_level as enum ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- Trigger genérico para updated_at
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─── profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  display_name         text,
  timezone             text not null default 'UTC',
  native_language      text not null default 'es',
  cefr_level           public.cefr_level,
  cefr_plus            boolean not null default false,          -- "A2+" = A2 con cefr_plus
  daily_goal_xp        integer not null default 50 check (daily_goal_xp between 10 and 1000),
  daily_goal_minutes   integer not null default 20 check (daily_goal_minutes between 5 and 240),
  interests            jsonb not null default '[]'::jsonb,       -- ["electrical engineering", "Valorant", …]
  learner_context      jsonb not null default '{}'::jsonb,       -- fortalezas, formatos que funcionan, plan, metas
  weekly_report_email  boolean not null default false,
  onboarding_completed boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Rechaza zonas horarias inválidas (la racha y los reportes dependen de ella)
create function public.validate_profile_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Zona horaria inválida: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger profiles_validate_timezone
  before insert or update of timezone on public.profiles
  for each row execute function public.validate_profile_timezone();

-- Fecha local del usuario (para racha, actividad diaria y reportes)
create function public.user_local_date(p_user_id uuid, p_at timestamptz default now())
returns date
language sql
stable
set search_path = ''
as $$
  select (p_at at time zone coalesce(
    (select p.timezone from public.profiles p where p.id = p_user_id), 'UTC'))::date;
$$;

-- ─── level_assessments: historial de nivel ───────────────────────────────────
create table public.level_assessments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  source        text not null check (source in ('seed', 'placement', 'reassessment')),
  overall_cefr  public.cefr_level not null,
  overall_plus  boolean not null default false,
  skills        jsonb not null default '{}'::jsonb,   -- {"listening":"B1","writing":"A2+",…}
  notes         text,
  created_at    timestamptz not null default now()
);

create index level_assessments_user_idx on public.level_assessments (user_id, created_at desc);

-- ─── placement_sessions: test de nivel en curso ──────────────────────────────
create table public.placement_sessions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  status               text not null default 'in_progress'
                         check (status in ('in_progress', 'completed', 'abandoned')),
  current_step         integer not null default 0,
  responses            jsonb not null default '[]'::jsonb,
  result_assessment_id uuid references public.level_assessments (id) on delete set null,
  started_at           timestamptz not null default now(),
  completed_at         timestamptz
);

create index placement_sessions_user_idx on public.placement_sessions (user_id, started_at desc);
