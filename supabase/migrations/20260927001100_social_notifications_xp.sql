-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Nombre de usuario, amigos, notificaciones y XP proporcional al tiempo.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Nombre de usuario (para que te encuentren tus amigos) ───────────────────
alter table public.profiles
  add column username text check (username ~ '^[a-z0-9_.]{3,20}$'),
  add column browser_notifications boolean not null default false;

create unique index profiles_username_uidx on public.profiles (username) where username is not null;

grant update (username, browser_notifications) on public.profiles to authenticated;

-- ─── Amigos: seguir a alguien por su @username (solo ves racha y nivel) ──────
create table public.friendships (
  user_id    uuid not null references auth.users (id) on delete cascade,
  friend_id  uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create index friendships_friend_idx on public.friendships (friend_id);

alter table public.friendships enable row level security;
revoke all on public.friendships from anon;
revoke insert, update, truncate, references, trigger on public.friendships from authenticated;
create policy "friendships: leer propias" on public.friendships
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "friendships: quitar propias" on public.friendships
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ─── Notificaciones (dentro de la app; el navegador las muestra si hay permiso) ─
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in
               ('streak_risk', 'report_ready', 'exam_available', 'level_up', 'friend_added', 'goal_met', 'system')),
  title      text not null,
  body       text,
  link       text,                                   -- ruta interna, p. ej. /settings
  dedupe_key text,                                   -- evita repetir la misma notificación
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create unique index notifications_dedupe_uidx on public.notifications (user_id, dedupe_key) where dedupe_key is not null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon;
revoke insert, delete, truncate, references, trigger on public.notifications from authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy "notifications: leer propias" on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "notifications: marcar leídas" on public.notifications
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ─── RPC: agregar amigo por username ─────────────────────────────────────────
create function public.add_friend(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := auth.uid();
  v_friend public.profiles;
  v_mine   public.profiles;
begin
  if v_me is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  select * into v_friend from public.profiles where username = lower(trim(both '@ ' from p_username));
  if v_friend.id is null then
    raise exception 'No encontramos a nadie con ese nombre de usuario' using errcode = 'P0002';
  end if;
  if v_friend.id = v_me then
    raise exception 'No puedes agregarte a ti mismo' using errcode = '22023';
  end if;

  insert into public.friendships (user_id, friend_id) values (v_me, v_friend.id)
  on conflict do nothing;

  if found then
    select * into v_mine from public.profiles where id = v_me;
    insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
    values (
      v_friend.id, 'friend_added',
      coalesce(v_mine.display_name, 'Alguien') || ' te agregó como amigo',
      case when v_mine.username is not null then '@' || v_mine.username || ' ahora ve tu racha y tu nivel.' else 'Ahora ve tu racha y tu nivel.' end,
      '/dashboard',
      'friend:' || v_me
    )
    on conflict do nothing;
  end if;

  return jsonb_build_object('id', v_friend.id, 'username', v_friend.username, 'display_name', v_friend.display_name);
end;
$$;

-- ─── RPC: lista de amigos con racha y nivel (solo eso) ───────────────────────
create function public.get_friends()
returns table (
  friend_id uuid,
  username text,
  display_name text,
  current_streak integer,
  level integer,
  cefr text,
  active_today boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.username,
    p.display_name,
    case
      when up.last_goal_date is not null
       and public.user_local_date(p.id) - up.last_goal_date - 1 <= up.streak_freezes
      then up.current_streak else 0
    end,
    coalesce(up.level, 1),
    coalesce(p.cefr_level::text, '—') || case when p.cefr_plus then '+' else '' end,
    coalesce(up.last_goal_date = public.user_local_date(p.id), false)
  from public.friendships f
  join public.profiles p on p.id = f.friend_id
  left join public.user_progress up on up.user_id = p.id
  where f.user_id = auth.uid()
  order by 4 desc, 5 desc;
$$;

revoke execute on function public.add_friend(text), public.get_friends() from public, anon;
grant execute on function public.add_friend(text), public.get_friends() to authenticated;

-- ─── XP proporcional al tiempo: ~2 XP por minuto de estudio ──────────────────
-- Un repaso toma ~20-30 s → 1 XP (antes 2). El resto de XP se ajusta en las Edge Functions.
create or replace function public.record_review(
  p_card_id     uuid,
  p_card        jsonb,
  p_log         jsonb,
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
  c_review_xp constant integer := 1;
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

revoke execute on function public.record_review(uuid, jsonb, jsonb, integer) from public, anon;
grant execute on function public.record_review(uuid, jsonb, jsonb, integer) to authenticated;

-- Meta por defecto coherente con 25 min (≈ 2 XP/min)
alter table public.profiles alter column daily_goal_minutes set default 25;
