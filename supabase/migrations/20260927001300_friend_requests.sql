-- ─────────────────────────────────────────────────────────────────────────────
-- 13. Amistad por solicitud: agregar envía una solicitud; el otro la acepta o la rechaza.
--     Una fila por pareja (user_id = quien la envió, friend_id = quien la recibe).
--     Aceptada → los dos ven la racha y el nivel del otro.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.friendships
  add column status       text not null default 'pending' check (status in ('pending', 'accepted')),
  add column responded_at timestamptz;

-- Las amistades anteriores (seguir a alguien) pasan a ser mutuas y aceptadas; si ya se
-- seguían los dos, queda una sola fila por pareja
delete from public.friendships a
 using public.friendships b
 where a.user_id = b.friend_id and a.friend_id = b.user_id and a.user_id > b.user_id;
update public.friendships set status = 'accepted', responded_at = created_at;

-- Una sola relación por pareja, sin importar quién la inició
create unique index friendships_pair_uidx
  on public.friendships (least(user_id, friend_id), greatest(user_id, friend_id));

-- Lectura: filas en las que participas (enviadas o recibidas). Cambios solo por RPC.
drop policy "friendships: leer propias" on public.friendships;
drop policy "friendships: quitar propias" on public.friendships;
revoke delete on public.friendships from authenticated;
create policy "friendships: leer propias" on public.friendships
  for select to authenticated using ((select auth.uid()) in (user_id, friend_id));

-- Nuevos tipos de notificación
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in
  ('streak_risk', 'report_ready', 'exam_available', 'level_up', 'friend_added', 'friend_request',
   'friend_accepted', 'goal_met', 'system'));

-- Aviso a otra persona (reenvía si ya existía: vuelve a quedar sin leer y arriba)
create function public.notify_user(p_user uuid, p_kind text, p_title text, p_body text, p_link text, p_key text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  values (p_user, p_kind, p_title, p_body, p_link, p_key)
  on conflict (user_id, dedupe_key) where dedupe_key is not null
  do update set title = excluded.title, body = excluded.body, read_at = null, created_at = now();
$$;
revoke execute on function public.notify_user(uuid, text, text, text, text, text) from public, anon, authenticated;

-- ─── Enviar solicitud (o aceptar, si esa persona ya te la había enviado) ──────
drop function public.add_friend(text);
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
  v_row    public.friendships;
  v_who    text;
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

  select * into v_mine from public.profiles where id = v_me;
  v_who := coalesce(v_mine.display_name, 'Alguien');

  select * into v_row from public.friendships
   where (user_id = v_me and friend_id = v_friend.id) or (user_id = v_friend.id and friend_id = v_me);

  if v_row.user_id is not null then
    if v_row.status = 'accepted' then
      raise exception 'Ya son amigos' using errcode = '23505';
    end if;
    if v_row.user_id = v_me then
      raise exception 'Ya le enviaste una solicitud. Espera a que la acepte.' using errcode = '23505';
    end if;
    -- Esa persona ya te había enviado una: agregarla equivale a aceptar
    perform public.respond_friend_request(v_friend.id, true);
    return jsonb_build_object('status', 'accepted', 'username', v_friend.username, 'display_name', v_friend.display_name);
  end if;

  insert into public.friendships (user_id, friend_id, status) values (v_me, v_friend.id, 'pending');
  perform public.notify_user(
    v_friend.id, 'friend_request',
    v_who || ' quiere ser tu amigo',
    case when v_mine.username is not null then '@' || v_mine.username || ' · ' else '' end
      || 'Acéptalo en Amigos para ver la racha y el nivel del otro.',
    '#friends',
    'friend-req:' || v_me
  );
  return jsonb_build_object('status', 'pending', 'username', v_friend.username, 'display_name', v_friend.display_name);
end;
$$;

-- ─── Aceptar o rechazar una solicitud recibida ───────────────────────────────
create function public.respond_friend_request(p_requester uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := auth.uid();
  v_mine public.profiles;
begin
  if v_me is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.friendships
                  where user_id = p_requester and friend_id = v_me and status = 'pending') then
    raise exception 'Esta solicitud ya no está disponible' using errcode = 'P0002';
  end if;

  if p_accept then
    update public.friendships set status = 'accepted', responded_at = now()
     where user_id = p_requester and friend_id = v_me;
    select * into v_mine from public.profiles where id = v_me;
    perform public.notify_user(
      p_requester, 'friend_accepted',
      coalesce(v_mine.display_name, 'Alguien') || ' aceptó tu solicitud',
      'Ahora ven la racha y el nivel del otro.',
      '#friends',
      'friend-ok:' || v_me
    );
  else
    -- Rechazar no avisa a quien la envió
    delete from public.friendships where user_id = p_requester and friend_id = v_me;
  end if;

  -- La notificación de la solicitud queda leída
  update public.notifications set read_at = coalesce(read_at, now())
   where user_id = v_me and dedupe_key = 'friend-req:' || p_requester;
end;
$$;

-- ─── Quitar amigo o cancelar una solicitud enviada ───────────────────────────
create function public.remove_friend(p_other uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.friendships
   where (user_id = auth.uid() and friend_id = p_other)
      or (user_id = p_other and friend_id = auth.uid() and status = 'accepted');
$$;

-- ─── Amigos (aceptados, en cualquier dirección): racha y nivel ───────────────
create or replace function public.get_friends()
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
  join public.profiles p
    on p.id = case when f.user_id = auth.uid() then f.friend_id else f.user_id end
  left join public.user_progress up on up.user_id = p.id
  where f.status = 'accepted' and auth.uid() in (f.user_id, f.friend_id)
  order by 4 desc, 5 desc;
$$;

-- ─── Solicitudes pendientes: recibidas y enviadas (sin racha ni nivel) ────────
create function public.get_friend_requests()
returns table (
  other_id uuid,
  username text,
  display_name text,
  direction text,        -- 'incoming' | 'outgoing'
  created_at timestamptz
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
    case when f.friend_id = auth.uid() then 'incoming' else 'outgoing' end,
    f.created_at
  from public.friendships f
  join public.profiles p
    on p.id = case when f.user_id = auth.uid() then f.friend_id else f.user_id end
  where f.status = 'pending' and auth.uid() in (f.user_id, f.friend_id)
  order by 4, f.created_at desc;
$$;

revoke execute on function
  public.add_friend(text), public.respond_friend_request(uuid, boolean), public.remove_friend(uuid),
  public.get_friends(), public.get_friend_requests()
  from public, anon;
grant execute on function
  public.add_friend(text), public.respond_friend_request(uuid, boolean), public.remove_friend(uuid),
  public.get_friends(), public.get_friend_requests()
  to authenticated;
