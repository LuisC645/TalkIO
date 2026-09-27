-- ─────────────────────────────────────────────────────────────────────────────
-- 18. Correos (Resend): consentimiento al registrarse, interruptor en Ajustes y registro de
--     envíos (evita duplicados). Tipos: reporte semanal y recordatorio de racha en riesgo.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column email_opt_in    boolean not null default false,
  add column email_opt_in_at timestamptz;

grant update (email_opt_in) on public.profiles to authenticated;

-- La fecha del consentimiento la pone la base de datos (no el cliente)
create function public.stamp_email_opt_in()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.email_opt_in is distinct from old.email_opt_in then
    new.email_opt_in_at := case when new.email_opt_in then now() else null end;
  end if;
  return new;
end;
$$;

create trigger profiles_email_opt_in
  before update of email_opt_in on public.profiles
  for each row execute function public.stamp_email_opt_in();

-- Registro de correos enviados (solo servidor)
create table public.email_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('weekly_report', 'streak_reminder')),
  dedupe_key  text not null,
  status      text not null check (status in ('sent', 'failed')),
  provider_id text,
  error       text,
  created_at  timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;

-- Alta: el consentimiento del formulario de registro (casilla sin marcar por defecto)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name     text := coalesce(new.raw_user_meta_data ->> 'display_name',
                              new.raw_user_meta_data ->> 'full_name',
                              split_part(new.email, '@', 1));
  v_wanted   text := lower(trim(both '@ ' from coalesce(new.raw_user_meta_data ->> 'username', '')));
  v_opt_in   boolean := coalesce((new.raw_user_meta_data ->> 'email_opt_in')::boolean, false);
  v_username text;
begin
  if v_wanted ~ '^[a-z0-9_.]{3,20}$' and not exists (select 1 from public.profiles where username = v_wanted) then
    v_username := v_wanted;
  else
    v_username := public.suggest_username(v_name);
  end if;

  insert into public.profiles (id, display_name, username, email_opt_in, email_opt_in_at)
  values (new.id, v_name, v_username, v_opt_in, case when v_opt_in then now() end)
  on conflict (id) do nothing;

  insert into public.user_progress (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
