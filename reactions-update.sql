-- Five Minutes of Trouble — answer reactions update
-- Run this once in Supabase SQL Editor.
-- Safe for existing games and existing answers.

create table if not exists public.game_answer_reactions (
  question_id uuid not null references public.game_questions(id) on delete cascade,
  answer_player smallint not null check (answer_player in (1,2)),
  reactor_player smallint not null check (reactor_player in (1,2)),
  reaction text not null check (reaction in ('❤️','😂','👀','🫶🏻','😈')),
  created_at timestamptz not null default now(),
  primary key (question_id, answer_player, reactor_player),
  check (answer_player <> reactor_player)
);

alter table public.game_answer_reactions enable row level security;
revoke all on public.game_answer_reactions from anon, authenticated;

create or replace function public.fm_set_reaction(
  p_game uuid,
  p_secret text,
  p_question uuid,
  p_answer_player smallint,
  p_reactor_player smallint,
  p_reaction text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare existing text;
begin
  if p_answer_player not in (1,2) or p_reactor_player not in (1,2) or p_answer_player=p_reactor_player then
    raise exception 'Invalid players';
  end if;
  if p_reaction not in ('❤️','😂','👀','🫶🏻','😈') then raise exception 'Invalid reaction'; end if;
  if not exists(select 1 from public.games where id=p_game and room_secret=p_secret) then raise exception 'Not allowed'; end if;
  if not exists(select 1 from public.game_questions where id=p_question and game_id=p_game and not skipped) then raise exception 'Question unavailable'; end if;
  if not exists(select 1 from public.game_answers where question_id=p_question and player_no=1)
     or not exists(select 1 from public.game_answers where question_id=p_question and player_no=2) then
    raise exception 'Answers not revealed';
  end if;

  select reaction into existing
  from public.game_answer_reactions
  where question_id=p_question and answer_player=p_answer_player and reactor_player=p_reactor_player;

  if existing=p_reaction then
    delete from public.game_answer_reactions
    where question_id=p_question and answer_player=p_answer_player and reactor_player=p_reactor_player;
  else
    insert into public.game_answer_reactions(question_id,answer_player,reactor_player,reaction)
    values (p_question,p_answer_player,p_reactor_player,p_reaction)
    on conflict (question_id,answer_player,reactor_player)
    do update set reaction=excluded.reaction, created_at=now();
  end if;
end;
$$;

create or replace function public.fm_get_reactions(
  p_game uuid,
  p_secret text,
  p_player smallint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare result jsonb;
begin
  if p_player not in (1,2) then raise exception 'Invalid player'; end if;
  if not exists(select 1 from public.games where id=p_game and room_secret=p_secret) then raise exception 'Not allowed'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'question_id',r.question_id,
    'answer_player',r.answer_player,
    'reactor_player',r.reactor_player,
    'reaction',r.reaction
  ) order by r.created_at),'[]'::jsonb)
  into result
  from public.game_answer_reactions r
  join public.game_questions q on q.id=r.question_id
  where q.game_id=p_game
    and not q.skipped
    and exists(select 1 from public.game_answers a where a.question_id=q.id and a.player_no=1)
    and exists(select 1 from public.game_answers a where a.question_id=q.id and a.player_no=2);

  return result;
end;
$$;

grant execute on function public.fm_set_reaction(uuid,text,uuid,smallint,smallint,text) to anon, authenticated;
grant execute on function public.fm_get_reactions(uuid,text,smallint) to anon, authenticated;
