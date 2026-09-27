-- ─────────────────────────────────────────────────────────────────────────────
-- 16. Descartar notificaciones (la ✕). Borrarlas de verdad (migración 15) hacía que la
--     sincronización las volviera a crear, porque con la fila se perdía su dedupe_key.
--     Se ocultan con dismissed_at y la fila queda: "Examen disponible" o "Racha en riesgo"
--     no reaparecen.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy "notifications: borrar propias" on public.notifications;
revoke delete on public.notifications from authenticated;

alter table public.notifications add column dismissed_at timestamptz;
grant update (dismissed_at) on public.notifications to authenticated;

create index notifications_visible_idx on public.notifications (user_id, created_at desc) where dismissed_at is null;

-- Un aviso que vuelve a ocurrir (p. ej. una nueva solicitud de amistad tras un rechazo)
-- vuelve a mostrarse aunque el anterior se hubiera descartado
create or replace function public.notify_user(p_user uuid, p_kind text, p_title text, p_body text, p_link text, p_key text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, link, dedupe_key)
  values (p_user, p_kind, p_title, p_body, p_link, p_key)
  on conflict (user_id, dedupe_key) where dedupe_key is not null
  do update set title = excluded.title, body = excluded.body, read_at = null, dismissed_at = null, created_at = now();
$$;
revoke execute on function public.notify_user(uuid, text, text, text, text, text) from public, anon, authenticated;
