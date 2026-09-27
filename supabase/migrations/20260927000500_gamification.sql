-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Gamificación: XP, nivel, racha, actividad diaria
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Curva de niveles ────────────────────────────────────────────────────────
-- XP acumulado para llegar al nivel L: ceil(50·(L-1)^1.5) → L2=50, L3=142, L5=400, L10=1350, L20=4141
-- (src/lib/xp.ts debe replicar esta fórmula para la UI)
create function public.xp_for_level(p_level integer)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select ceil(50 * power(greatest(p_level - 1, 0), 1.5))::bigint;
$$;

-- Inversa de xp_for_level; se corrige contra ella para evitar errores de redondeo.
create function public.level_for_xp(p_xp bigint)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_level integer := floor(power(greatest(p_xp, 0) / 50.0, 2.0 / 3.0))::integer + 1;
begin
  while public.xp_for_level(v_level + 1) <= p_xp loop
    v_level := v_level + 1;
  end loop;
  while v_level > 1 and public.xp_for_level(v_level) > p_xp loop
    v_level := v_level - 1;
  end loop;
  return v_level;
end;
$$;

-- ─── user_progress: totales y racha ──────────────────────────────────────────
create table public.user_progress (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  total_xp       bigint not null default 0,
  level          integer not null default 1,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_goal_date date,                          -- último día (local) en que se cumplió la meta
  streak_freezes integer not null default 0 check (streak_freezes >= 0),
  updated_at     timestamptz not null default now()
);

create trigger user_progress_updated_at
  before update on public.user_progress
  for each row execute function public.set_updated_at();

-- ─── daily_activity: una fila por día local ──────────────────────────────────
create table public.daily_activity (
  user_id           uuid not null references auth.users (id) on delete cascade,
  local_date        date not null,
  xp                integer not null default 0,
  active_seconds    integer not null default 0,
  exercises_done    integer not null default 0,
  lessons_completed integer not null default 0,
  reviews_done      integer not null default 0,
  goal_met          boolean not null default false,
  primary key (user_id, local_date)
);

-- ─── xp_events: libro contable (solo inserciones) ────────────────────────────
create table public.xp_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  amount     integer not null check (amount > 0),
  source     text not null check (source in
               ('exercise', 'lesson', 'review', 'streak_bonus', 'placement', 'adjustment')),
  ref_id     uuid,                                   -- intento, lección, review log…
  local_date date not null,
  created_at timestamptz not null default now()
);

create index xp_events_user_idx on public.xp_events (user_id, local_date);
-- Idempotencia: el mismo intento/lección/review no da XP dos veces
create unique index xp_events_ref_uidx on public.xp_events (user_id, source, ref_id) where ref_id is not null;

-- ─── Helper: sumar contadores a daily_activity ───────────────────────────────
create function public.bump_daily_activity(
  p_user_id           uuid,
  p_local_date        date,
  p_active_seconds    integer default 0,
  p_exercises_done    integer default 0,
  p_lessons_completed integer default 0,
  p_reviews_done      integer default 0
)
returns void
language sql
set search_path = ''
as $$
  insert into public.daily_activity
    (user_id, local_date, active_seconds, exercises_done, lessons_completed, reviews_done)
  values
    (p_user_id, p_local_date, p_active_seconds, p_exercises_done, p_lessons_completed, p_reviews_done)
  on conflict (user_id, local_date) do update set
    active_seconds    = public.daily_activity.active_seconds    + excluded.active_seconds,
    exercises_done    = public.daily_activity.exercises_done    + excluded.exercises_done,
    lessons_completed = public.daily_activity.lessons_completed + excluded.lessons_completed,
    reviews_done      = public.daily_activity.reviews_done      + excluded.reviews_done;
$$;

-- ─── Trigger xp_events: actividad diaria, meta, racha, nivel ─────────────────
create function public.on_xp_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_goal     integer;
  v_day_xp   integer;
  v_was_met  boolean;
  v_progress public.user_progress;
  v_gap      integer;
begin
  select daily_goal_xp into v_goal from public.profiles where id = new.user_id;
  v_goal := coalesce(v_goal, 50);

  -- 1) Actividad diaria
  select goal_met into v_was_met
    from public.daily_activity
   where user_id = new.user_id and local_date = new.local_date;
  v_was_met := coalesce(v_was_met, false);

  insert into public.daily_activity (user_id, local_date, xp)
  values (new.user_id, new.local_date, new.amount)
  on conflict (user_id, local_date) do update
    set xp = public.daily_activity.xp + excluded.xp
  returning xp into v_day_xp;

  -- 2) Totales y nivel
  insert into public.user_progress (user_id) values (new.user_id)
  on conflict (user_id) do nothing;

  update public.user_progress
     set total_xp = total_xp + new.amount,
         level    = public.level_for_xp(total_xp + new.amount)
   where user_id = new.user_id
  returning * into v_progress;

  -- 3) Racha: solo la primera vez que se cumple la meta en ese día
  if not v_was_met and v_day_xp >= v_goal then
    update public.daily_activity set goal_met = true
     where user_id = new.user_id and local_date = new.local_date;

    -- Ignora días anteriores al último registrado (eventos tardíos)
    if v_progress.last_goal_date is null or new.local_date > v_progress.last_goal_date then
      v_gap := case when v_progress.last_goal_date is null then null
                    else new.local_date - v_progress.last_goal_date - 1 end;

      update public.user_progress
         set current_streak = case
               when v_gap = 0 then current_streak + 1                        -- día consecutivo
               when v_gap is not null and v_gap <= streak_freezes then current_streak + 1  -- cubierto por freezes
               else 1 end,
             streak_freezes = case
               when v_gap is not null and v_gap > 0 and v_gap <= streak_freezes
                 then streak_freezes - v_gap else streak_freezes end,
             last_goal_date = new.local_date
       where user_id = new.user_id;

      update public.user_progress
         set longest_streak = greatest(longest_streak, current_streak)
       where user_id = new.user_id;
    end if;
  end if;

  return new;
end;
$$;

create function public.set_xp_event_local_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.local_date is null then
    new.local_date := public.user_local_date(new.user_id, new.created_at);
  end if;
  return new;
end;
$$;

create trigger xp_events_local_date
  before insert on public.xp_events
  for each row execute function public.set_xp_event_local_date();

create trigger xp_events_apply
  after insert on public.xp_events
  for each row execute function public.on_xp_event();

-- ─── award_xp: punto único para otorgar XP (Edge Functions / RPCs) ───────────
-- Devuelve false si ese ref_id ya había otorgado XP (idempotente).
create function public.award_xp(
  p_user_id uuid,
  p_amount  integer,
  p_source  text,
  p_ref_id  uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  if p_amount <= 0 then
    return false;
  end if;

  insert into public.xp_events (user_id, amount, source, ref_id, local_date)
  values (p_user_id, p_amount, p_source, p_ref_id, public.user_local_date(p_user_id))
  on conflict (user_id, source, ref_id) where ref_id is not null do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted > 0;
end;
$$;

-- ─── Contadores automáticos ──────────────────────────────────────────────────
create function public.on_exercise_attempt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.bump_daily_activity(
    new.user_id,
    public.user_local_date(new.user_id, new.created_at),
    p_active_seconds => coalesce(new.duration_ms, 0) / 1000,
    p_exercises_done => 1
  );
  return new;
end;
$$;

create trigger exercise_attempts_activity
  after insert on public.exercise_attempts
  for each row execute function public.on_exercise_attempt();

create function public.on_lesson_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.bump_daily_activity(
    new.user_id,
    public.user_local_date(new.user_id, coalesce(new.completed_at, now())),
    p_lessons_completed => 1
  );
  return new;
end;
$$;

create trigger lessons_completed_activity
  after update of status on public.lessons
  for each row
  when (new.status = 'completed' and old.status is distinct from 'completed')
  execute function public.on_lesson_completed();

-- ─── record_review: RPC del cliente para registrar un repaso FSRS ────────────
-- El cliente calcula el nuevo estado con ts-fsrs y lo envía; aquí se guarda
-- carta + log de forma atómica y se otorga XP.
create function public.record_review(
  p_card_id     uuid,
  p_card        jsonb,          -- Card de ts-fsrs (después del repaso)
  p_log         jsonb,          -- ReviewLog de ts-fsrs
  p_duration_ms integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_log_id  uuid;
  c_review_xp constant integer := 2;
begin
  if v_user_id is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  update public.srs_cards set
    due            = (p_card ->> 'due')::timestamptz,
    stability      = (p_card ->> 'stability')::double precision,
    difficulty     = (p_card ->> 'difficulty')::double precision,
    elapsed_days   = (p_card ->> 'elapsed_days')::integer,
    scheduled_days = (p_card ->> 'scheduled_days')::integer,
    learning_steps = (p_card ->> 'learning_steps')::integer,
    reps           = (p_card ->> 'reps')::integer,
    lapses         = (p_card ->> 'lapses')::integer,
    state          = (p_card ->> 'state')::smallint,
    last_review    = (p_card ->> 'last_review')::timestamptz
  where id = p_card_id and user_id = v_user_id;

  if not found then
    raise exception 'Carta no encontrada' using errcode = 'P0002';
  end if;

  insert into public.srs_review_logs (
    user_id, card_id, rating, state, due, stability, difficulty, elapsed_days,
    last_elapsed_days, scheduled_days, learning_steps, review, duration_ms
  ) values (
    v_user_id, p_card_id,
    (p_log ->> 'rating')::smallint,
    (p_log ->> 'state')::smallint,
    (p_log ->> 'due')::timestamptz,
    (p_log ->> 'stability')::double precision,
    (p_log ->> 'difficulty')::double precision,
    (p_log ->> 'elapsed_days')::integer,
    (p_log ->> 'last_elapsed_days')::integer,
    (p_log ->> 'scheduled_days')::integer,
    (p_log ->> 'learning_steps')::integer,
    (p_log ->> 'review')::timestamptz,
    p_duration_ms
  )
  returning id into v_log_id;

  perform public.bump_daily_activity(
    v_user_id,
    public.user_local_date(v_user_id),
    p_active_seconds => coalesce(p_duration_ms, 0) / 1000,
    p_reviews_done   => 1
  );
  perform public.award_xp(v_user_id, c_review_xp, 'review', v_log_id);

  return v_log_id;
end;
$$;

-- ─── Vista de racha "efectiva" (se rompe sola al leer, sin cron) ─────────────
create view public.user_progress_view
with (security_invoker = true)
as
select
  up.user_id,
  up.total_xp,
  up.level,
  public.xp_for_level(up.level)     as level_start_xp,
  public.xp_for_level(up.level + 1) as next_level_xp,
  case
    when up.last_goal_date is not null
     and public.user_local_date(up.user_id) - up.last_goal_date - 1 <= up.streak_freezes
    then up.current_streak
    else 0
  end as current_streak,
  up.longest_streak,
  up.last_goal_date,
  up.streak_freezes,
  coalesce(da.xp, 0)          as today_xp,
  coalesce(da.goal_met, false) as today_goal_met,
  p.daily_goal_xp
from public.user_progress up
join public.profiles p on p.id = up.user_id
left join public.daily_activity da
  on da.user_id = up.user_id and da.local_date = public.user_local_date(up.user_id);

-- ─── Alta de usuario: crea perfil y progreso ─────────────────────────────────
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name',
                           new.raw_user_meta_data ->> 'full_name',
                           split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.user_progress (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: usuarios creados antes de esta migración (p. ej. el tuyo)
insert into public.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1))
  from auth.users u
on conflict (id) do nothing;

insert into public.user_progress (user_id)
select u.id from auth.users u
on conflict (user_id) do nothing;
