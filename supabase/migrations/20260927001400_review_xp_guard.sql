-- ─────────────────────────────────────────────────────────────────────────────
-- 14. Seguridad: record_review solo da XP si la tarjeta estaba pendiente (antes se podía
--     sumar XP llamándola en bucle sobre la misma tarjeta) y limita la duración a 10 min.
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_due     timestamptz;
  v_ms      integer := least(greatest(coalesce(p_duration_ms, 0), 0), 600000);  -- máx. 10 min por tarjeta
  c_review_xp constant integer := 1;
begin
  if v_user_id is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  -- Estado anterior: solo da XP si la tarjeta estaba pendiente (evita sumar XP repasando
  -- la misma tarjeta una y otra vez). Margen de 15 min para los reaprendizajes de la sesión.
  select due into v_due from public.srs_cards where id = p_card_id and user_id = v_user_id for update;
  if not found then
    raise exception 'Carta no encontrada' using errcode = 'P0002';
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
    v_ms
  )
  returning id into v_log_id;

  perform public.bump_daily_activity(
    v_user_id,
    public.user_local_date(v_user_id),
    p_active_seconds => v_ms / 1000,
    p_reviews_done   => 1
  );
  if v_due <= now() + interval '15 minutes' then
    perform public.award_xp(v_user_id, c_review_xp, 'review', v_log_id);
  end if;

  return v_log_id;
end;
$$;

revoke execute on function public.record_review(uuid, jsonb, jsonb, integer) from public, anon;
grant execute on function public.record_review(uuid, jsonb, jsonb, integer) to authenticated;
