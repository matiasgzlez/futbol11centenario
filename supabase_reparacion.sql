-- Centenario: ejecutar una vez en el SQL Editor del proyecto Supabase.
-- Se puede volver a ejecutar. Conserva jugadores, fotos, propietarios y boletas.
begin;

create table if not exists public.players (
  team integer not null, pos integer not null, name text not null default '',
  photo text, updated_at timestamptz default now(), owner text,
  is_captain boolean not null default false, primary key (team, pos)
);
alter table public.players add column if not exists owner text;
alter table public.players add column if not exists is_captain boolean default false;
alter table public.players add column if not exists player_id uuid;
alter table public.players drop constraint if exists players_team_check;
alter table public.players add constraint players_team_check check (team in (0,1,2));
alter table public.players drop constraint if exists players_pos_check;
alter table public.players add constraint players_pos_check check (pos between 0 and 16 and (team <> 2 or pos = 0));
-- pos 16 = director técnico de cada equipo.
alter table public.players drop constraint if exists players_name_check;
alter table public.players add constraint players_name_check check (char_length(name) <= 20);

-- El guardado se hace por funciones atómicas, con comprobación explícita del dueño.
-- Los triggers anteriores ignoraban actualizaciones sin devolver ningún error.
drop trigger if exists t_owner on public.players;
update public.players set player_id = gen_random_uuid() where name <> '' and player_id is null;
insert into public.players (team,pos)
select t,p from generate_series(0,1) t cross join generate_series(0,16) p
on conflict do nothing;
insert into public.players (team,pos) values (2,0) on conflict do nothing;

create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  user_name text not null check (char_length(user_name) <= 30),
  team_pick text not null, total_goals text, scorer text, yellow_card text,
  amount integer default 500, created_at timestamptz default now(), owner text
);
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  author text not null check (char_length(author) <= 30),
  team integer check (team in (0,1,2)), photo text,
  text text not null check (char_length(text) <= 280),
  created_at timestamptz default now(), owner text
);

-- Fotos en los comentarios (URL pública del bucket "fotos").
alter table public.chat_messages add column if not exists image text;
alter table public.chat_messages drop constraint if exists chat_messages_image_check;
alter table public.chat_messages add constraint chat_messages_image_check check (image is null or (char_length(image) <= 2048 and image ~ '^https://'));

create or replace function public.centenario_owner() returns text
language plpgsql stable set search_path = '' as $$
declare token text := coalesce(current_setting('request.headers',true)::json->>'x-owner','');
begin
  if char_length(token) < 16 or char_length(token) > 200 then
    raise exception 'Acceso inválido. Recuperá tu código de acceso.';
  end if;
  return encode(sha256(convert_to(token,'UTF8')),'hex');
end $$;

create or replace function public._apply_centenario_player_change(
  req_owner text, is_admin boolean,
  source_team integer, source_pos integer, target_team integer, target_pos integer,
  player_name text, player_photo text, captain boolean default false
) returns setof public.players
language plpgsql security definer set search_path = '' as $$
declare
  src public.players; dst public.players;
  same_slot boolean := source_team = target_team and source_pos = target_pos;
  new_id uuid;
begin
  perform pg_advisory_xact_lock(110433);
  if nullif(trim(player_name),'') is null or char_length(trim(player_name)) > 20 then
    raise exception 'El nombre debe tener entre 1 y 20 caracteres.';
  end if;
  if player_photo is not null and (char_length(player_photo) > 2048 or player_photo !~ '^https://') then
    raise exception 'La foto debe ser una URL HTTPS válida.';
  end if;
  select * into src from public.players where team=source_team and pos=source_pos for update;
  if not found then raise exception 'No existe ese lugar. Aplicá la reparación de la base.'; end if;
  select * into dst from public.players where team=target_team and pos=target_pos for update;
  if not found then raise exception 'No existe el lugar de destino.'; end if;
  if not is_admin then
    if (src.name <> '' and src.owner is not null and src.owner <> req_owner)
       or (dst.name <> '' and dst.owner is not null and dst.owner <> req_owner) then
      raise exception 'Ese lugar pertenece a otro acceso. Recuperá el código con el que lo cargaste.';
    end if;
  end if;
  if (source_team=2 or target_team=2) and not same_slot then
    raise exception 'El árbitro no se puede intercambiar con un jugador.';
  end if;
  if (source_pos=16 or target_pos=16) and not same_slot then
    raise exception 'El técnico no se puede intercambiar con un jugador.';
  end if;
  new_id := coalesce(src.player_id,gen_random_uuid());
  if not same_slot then
    update public.players set name=dst.name,photo=dst.photo,
      owner=case when is_admin then dst.owner else (case when dst.name='' then null else coalesce(dst.owner,req_owner) end) end,
      player_id=dst.player_id,is_captain=false,updated_at=now()
      where team=source_team and pos=source_pos;
  end if;
  if captain and target_team <> 2 then
    update public.players set is_captain=false,updated_at=now()
      where team=target_team and is_captain=true;
  end if;
  update public.players set name=trim(player_name),photo=player_photo,
    owner=case when is_admin then coalesce(src.owner,dst.owner) else req_owner end,
    player_id=new_id,is_captain=(captain and target_team <> 2 and target_pos <> 16),updated_at=now()
    where team=target_team and pos=target_pos;
  return query select * from public.players order by team,pos;
end $$;

create or replace function public.save_centenario_player(
  source_team integer, source_pos integer, target_team integer, target_pos integer,
  player_name text, player_photo text, captain boolean default false
) returns setof public.players
language plpgsql security definer set search_path = '' as $$
begin
  return query select * from public._apply_centenario_player_change(
    public.centenario_owner(), false,
    source_team, source_pos, target_team, target_pos,
    player_name, player_photo, captain
  );
end $$;

-- Variante administrativa: igual que save_centenario_player pero valida la
-- contraseña de admin en vez del dueño, para poder mover/renombrar cualquier lugar.
create or replace function public.admin_save_centenario_player(
  admin_pass text, source_team integer, source_pos integer, target_team integer, target_pos integer,
  player_name text, player_photo text, captain boolean default false
) returns setof public.players
language plpgsql security definer set search_path = '' as $$
begin
  if admin_pass <> 'centenarioutn412' then
    raise exception 'Contraseña de administrador incorrecta';
  end if;
  return query select * from public._apply_centenario_player_change(
    null, true,
    source_team, source_pos, target_team, target_pos,
    player_name, player_photo, captain
  );
end $$;

create or replace function public.save_centenario_bet(
  bet_id uuid, user_label text, prediction text, goals text,
  scorer_name text, yellow_name text, chips integer
) returns setof public.bets
language plpgsql security definer set search_path = '' as $$
declare h text := public.centenario_owner(); p jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(h,0));
  if nullif(trim(user_label),'') is null or char_length(trim(user_label)) > 20 then
    raise exception 'Ingresá un nombre de hasta 20 caracteres.';
  end if;
  if chips is null or chips not in (100,250,500,1000) then raise exception 'Cantidad de fichas inválida.'; end if;
  if char_length(prediction) > 8000 then raise exception 'Pronóstico demasiado largo.'; end if;
  p := prediction::jsonb;
  if p->>'s0' is null or p->>'s1' is null
    or (p->>'s0')::integer not between 0 and 15 or (p->>'s1')::integer not between 0 and 15 then
    raise exception 'El marcador debe estar entre 0 y 15.';
  end if;
  if exists(select 1 from public.bets where id=bet_id and owner is distinct from h) then
    raise exception 'La boleta pertenece a otro acceso.';
  end if;
  -- Borrar la anterior e insertar la nueva en la misma transacción.
  -- Si algo falla, PostgreSQL conserva la boleta anterior.
  delete from public.bets where owner=h;
  return query insert into public.bets(id,user_name,team_pick,total_goals,scorer,yellow_card,amount,owner)
    values(bet_id,trim(user_label),prediction,
      case when (p->>'s0')::integer+(p->>'s1')::integer >= 3 then 'mas' else 'menos' end,
      left(scorer_name,20),left(yellow_name,20),chips,h) returning *;
end $$;

create or replace function public.centenario_chat_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.owner := public.centenario_owner();
  new.created_at := now();
  if nullif(trim(new.author),'') is null or nullif(trim(new.text),'') is null then
    raise exception 'Completá tu nombre y el mensaje.';
  end if;
  return new;
end $$;
drop trigger if exists centenario_chat_owner on public.chat_messages;
create trigger centenario_chat_owner before insert on public.chat_messages
for each row execute function public.centenario_chat_owner();

alter table public.players enable row level security;
alter table public.bets enable row level security;
alter table public.chat_messages enable row level security;
drop policy if exists "leer" on public.players;
create policy "leer" on public.players for select to anon using (true);
drop policy if exists "editar" on public.players;
revoke insert, update, delete on public.players from anon, authenticated;
grant select on public.players to anon;

drop policy if exists "apuestas leer" on public.bets;
create policy "apuestas leer" on public.bets for select to anon using (true);
drop policy if exists "apuestas insertar" on public.bets;
drop policy if exists "apuestas borrar" on public.bets;
create policy "apuestas borrar" on public.bets for delete to anon using (owner=public.centenario_owner());
revoke insert,update on public.bets from anon,authenticated;
grant select,delete on public.bets to anon;

drop policy if exists "chat leer" on public.chat_messages;
create policy "chat leer" on public.chat_messages for select to anon using (true);
drop policy if exists "chat insertar" on public.chat_messages;
create policy "chat insertar" on public.chat_messages for insert to anon with check(owner=public.centenario_owner());
drop policy if exists "chat borrar propio" on public.chat_messages;
create policy "chat borrar propio" on public.chat_messages for delete to anon using(owner=public.centenario_owner());
revoke update on public.chat_messages from anon,authenticated;
grant select,insert,delete on public.chat_messages to anon;

create or replace function public.admin_delete_chat_message(msg_id uuid, admin_pass text)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if admin_pass <> 'centenarioutn412' then
    raise exception 'Contraseña de administrador incorrecta';
  end if;
  if msg_id is null then
    delete from public.chat_messages;
  else
    delete from public.chat_messages where id = msg_id;
  end if;
  return true;
end $$;

revoke all on function public._apply_centenario_player_change(text,boolean,integer,integer,integer,integer,text,text,boolean) from public;
revoke all on function public.save_centenario_player(integer,integer,integer,integer,text,text,boolean) from public;
revoke all on function public.admin_save_centenario_player(text,integer,integer,integer,integer,text,text,boolean) from public;
revoke all on function public.save_centenario_bet(uuid,text,text,text,text,text,integer) from public;
revoke all on function public.admin_delete_chat_message(uuid,text) from public;
grant execute on function public.save_centenario_player(integer,integer,integer,integer,text,text,boolean) to anon;
grant execute on function public.admin_save_centenario_player(text,integer,integer,integer,integer,text,text,boolean) to anon;
grant execute on function public.save_centenario_bet(uuid,text,text,text,text,text,integer) to anon;
grant execute on function public.admin_delete_chat_message(uuid,text) to anon;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('fotos','fotos',true,2097152,array['image/jpeg'])
on conflict(id) do update set public=true,file_size_limit=2097152,allowed_mime_types=array['image/jpeg'];
drop policy if exists "fotos leer" on storage.objects;
create policy "fotos leer" on storage.objects for select to anon using(bucket_id='fotos');
drop policy if exists "fotos subir" on storage.objects;
create policy "fotos subir" on storage.objects for insert to anon
with check(bucket_id='fotos' and (storage.foldername(name))[1]=public.centenario_owner());

-- No falla si estas tablas ya estaban en la publicación.
do $$ declare t text; begin
  foreach t in array array['players','bets','chat_messages'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;
