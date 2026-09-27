-- ─────────────────────────────────────────────────────────────────────────────
-- 17. Preparación en segundo plano: la lección del día (y los exámenes desbloqueados) se
--     generan antes de estudiar, para no esperar a la IA al abrir Lecciones.
--     Disparadores: tarea programada cada hora (pg_cron → Edge Function daily-prep), al abrir
--     la app (notifications/sync) y al terminar una lección (deja lista la siguiente).
-- ─────────────────────────────────────────────────────────────────────────────

-- Registro por usuario y día (hora local): evita duplicar trabajo entre disparadores
create table public.daily_prep (
  user_id     uuid not null references auth.users (id) on delete cascade,
  local_date  date not null,
  status      text not null default 'running' check (status in ('running', 'done', 'failed')),
  trigger     text not null check (trigger in ('cron', 'app', 'after_lesson')),
  lesson_id   uuid references public.lessons (id) on delete set null,
  exam_ids    uuid[] not null default '{}',
  error       text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  primary key (user_id, local_date)
);

alter table public.daily_prep enable row level security;
revoke all on public.daily_prep from anon;
revoke insert, update, delete, truncate, references, trigger on public.daily_prep from authenticated;
create policy "daily_prep: leer propio" on public.daily_prep
  for select to authenticated using ((select auth.uid()) = user_id);

-- Reserva la preparación del día. true = este proceso la hace. Se puede repetir si falló o si
-- quedó colgada (> 10 min); con p_force (al terminar una lección) también si ya se hizo hoy.
create function public.claim_daily_prep(p_user uuid, p_date date, p_trigger text, p_force boolean default false)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.daily_prep (user_id, local_date, trigger)
  values (p_user, p_date, p_trigger)
  on conflict (user_id, local_date) do update
    set status = 'running', trigger = excluded.trigger, started_at = now(), finished_at = null, error = null
    where public.daily_prep.status = 'failed'
       or (public.daily_prep.status = 'running' and public.daily_prep.started_at < now() - interval '10 minutes')
       or (p_force and public.daily_prep.status = 'done');
  return found;
end;
$$;

-- Usuarios a preparar en esta hora: desde las 4:00 locales, sin preparación hecha hoy y con
-- actividad en las últimas 2 semanas (no se gasta IA en cuentas inactivas)
create function public.due_prep_users(p_limit integer default 20)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where p.onboarding_completed
    and extract(hour from (now() at time zone coalesce(p.timezone, 'UTC'))) >= 4
    and not exists (
      select 1 from public.daily_prep d
       where d.user_id = p.id
         and d.local_date = public.user_local_date(p.id)
         and (d.status = 'done' or (d.status = 'running' and d.started_at > now() - interval '10 minutes'))
    )
    and (
      p.created_at > now() - interval '14 days'
      or exists (
        select 1 from public.daily_activity a
         where a.user_id = p.id and a.local_date >= public.user_local_date(p.id) - 14
      )
    )
  order by random()
  limit p_limit;
$$;

-- ─── Tarea programada ────────────────────────────────────────────────────────
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Secreto de la llamada: se genera aquí mismo (nunca sale de la base de datos ni del Vault)
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'daily_prep_secret', 'Autoriza a pg_cron a llamar a daily-prep');
select vault.create_secret('https://wujywchamawemiafszdy.supabase.co', 'daily_prep_project_url', 'URL del proyecto para daily-prep');

-- La Edge Function comprueba el secreto con esta función (solo con la clave de servicio)
create function public.verify_prep_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
     where name = 'daily_prep_secret' and decrypted_secret = p_secret
  );
$$;

revoke execute on function public.claim_daily_prep(uuid, date, text, boolean) from public, anon, authenticated;
revoke execute on function public.due_prep_users(integer) from public, anon, authenticated;
revoke execute on function public.verify_prep_secret(text) from public, anon, authenticated;
grant execute on function public.claim_daily_prep(uuid, date, text, boolean) to service_role;
grant execute on function public.due_prep_users(integer) to service_role;
grant execute on function public.verify_prep_secret(text) to service_role;

-- Cada hora (minuto 7): la función responde al instante y prepara en segundo plano
select cron.schedule(
  'daily-prep',
  '7 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'daily_prep_project_url') || '/functions/v1/daily-prep',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-prep-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'daily_prep_secret')
    ),
    body := '{"source":"cron"}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);
