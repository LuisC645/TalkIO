-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Exámenes (semanal y de nivel) y repetición de lecciones.
--     Los exámenes son lecciones con kind distinto: reutilizan ejercicios,
--     intentos, calificación, registro de errores y XP.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.lessons
  add column kind  text    not null default 'lesson' check (kind in ('lesson', 'weekly_exam', 'level_exam')),
  add column round integer not null default 1 check (round >= 1),
  add column meta  jsonb   not null default '{}'::jsonb;   -- exámenes: week_start, target_level, pass_threshold, passed…

-- Un examen semanal por semana
create unique index lessons_weekly_exam_uidx
  on public.lessons (user_id, (meta ->> 'week_start'))
  where kind = 'weekly_exam';

create index lessons_user_kind_idx on public.lessons (user_id, kind, generated_at desc);

-- Intentos por ronda: repetir una lección crea una ronda nueva (la nota guardada es la última)
alter table public.exercise_attempts
  add column round integer not null default 1 check (round >= 1);

drop index if exists public.exercise_attempts_exercise_uidx;
create unique index exercise_attempts_exercise_round_uidx on public.exercise_attempts (exercise_id, round);

-- XP de exámenes
alter table public.xp_events drop constraint xp_events_source_check;
alter table public.xp_events add constraint xp_events_source_check
  check (source in ('exercise', 'lesson', 'review', 'streak_bonus', 'placement', 'adjustment', 'writing', 'exam'));

-- ─── retake_lesson: el usuario inicia una nueva ronda de una lección completada ──
create function public.retake_lesson(p_lesson_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round integer;
begin
  update public.lessons
     set round = round + 1,
         status = 'in_progress',
         started_at = now()
   where id = p_lesson_id
     and user_id = (select auth.uid())
     and kind = 'lesson'
     and status = 'completed'
  returning round into v_round;

  if v_round is null then
    raise exception 'Solo puedes repetir lecciones completadas' using errcode = 'P0002';
  end if;
  return v_round;
end;
$$;

revoke execute on function public.retake_lesson(uuid) from public, anon;
grant execute on function public.retake_lesson(uuid) to authenticated;

-- La vista de ejercicios no cambia; exercise_attempts ya se lee con RLS (incluye la ronda).
