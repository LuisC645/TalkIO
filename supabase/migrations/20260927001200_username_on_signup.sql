-- ─────────────────────────────────────────────────────────────────────────────
-- 12. Nombre de usuario desde el registro: el alta usa el @usuario elegido (si es
--     válido y está libre) o genera uno a partir del nombre. Los usuarios que ya
--     existían reciben uno automáticamente.
-- ─────────────────────────────────────────────────────────────────────────────

-- Convierte un nombre en un @usuario libre: "Sofía Pérez" → sofia_perez (o sofia_perez4821)
create function public.suggest_username(p_base text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_slug text;
  v_try  text;
  i      integer := 0;
begin
  v_slug := lower(coalesce(p_base, ''));
  v_slug := translate(v_slug, 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc');
  v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '_', 'g');
  v_slug := trim(both '_' from v_slug);
  v_slug := left(v_slug, 14);
  if length(v_slug) < 3 then
    v_slug := 'user';
  end if;

  v_try := v_slug;
  while exists (select 1 from public.profiles where username = v_try) loop
    i := i + 1;
    v_try := left(v_slug, 15) || (1000 + floor(random() * 9000))::integer::text;
    exit when i > 20;
  end loop;
  return v_try;
end;
$$;

-- ¿Está libre este @usuario? (el formulario de registro lo consulta en vivo)
create function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(p_username) ~ '^[a-z0-9_.]{3,20}$'
     and not exists (select 1 from public.profiles where username = lower(p_username));
$$;

revoke execute on function public.suggest_username(text) from public, anon, authenticated;
revoke execute on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- Alta: nombre + @usuario (el elegido si es válido y libre; si no, uno generado)
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
  v_username text;
begin
  if v_wanted ~ '^[a-z0-9_.]{3,20}$' and not exists (select 1 from public.profiles where username = v_wanted) then
    v_username := v_wanted;
  else
    v_username := public.suggest_username(v_name);
  end if;

  insert into public.profiles (id, display_name, username)
  values (new.id, v_name, v_username)
  on conflict (id) do nothing;

  insert into public.user_progress (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Usuarios que ya existían sin @usuario
do $$
declare
  r record;
begin
  for r in
    select p.id, coalesce(p.display_name, split_part(u.email, '@', 1)) as base
      from public.profiles p
      join auth.users u on u.id = p.id
     where p.username is null
  loop
    update public.profiles set username = public.suggest_username(r.base) where id = r.id;
  end loop;
end;
$$;
