-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Un intento por ejercicio (grade-attempt es idempotente y evita carreras
--    con esta restricción: dos envíos simultáneos no pueden dar XP doble).
-- ─────────────────────────────────────────────────────────────────────────────
drop index if exists public.exercise_attempts_exercise_idx;
create unique index exercise_attempts_exercise_uidx on public.exercise_attempts (exercise_id);
