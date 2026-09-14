-- Five Minutes of Trouble — one-time update for invitee naming
-- Paste this entire file into Supabase > SQL Editor > New query > Run.

create or replace function public.fm_join_game(p_game uuid, p_secret text, p_player smallint, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_player not in (1,2) then raise exception 'Invalid player'; end if;
  if not exists(select 1 from public.games where id=p_game and room_secret=p_secret) then raise exception 'Not allowed'; end if;
  if length(trim(coalesce(p_name,''))) = 0 then raise exception 'Name required'; end if;

  if p_player = 1 then
    update public.games set player1_name=left(trim(p_name),40) where id=p_game and room_secret=p_secret;
  else
    update public.games set player2_name=left(trim(p_name),40) where id=p_game and room_secret=p_secret;
  end if;
end;
$$;

grant execute on function public.fm_join_game(uuid,text,smallint,text) to anon, authenticated;
