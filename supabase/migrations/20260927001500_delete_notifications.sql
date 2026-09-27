-- ─────────────────────────────────────────────────────────────────────────────
-- 15. Borrar notificaciones una a una (solo las propias).
-- ─────────────────────────────────────────────────────────────────────────────
grant delete on public.notifications to authenticated;

create policy "notifications: borrar propias" on public.notifications
  for delete to authenticated using ((select auth.uid()) = user_id);
