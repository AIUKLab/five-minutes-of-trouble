-- Five Minutes of Trouble — asynchronous play update
-- Run this once in Supabase SQL Editor.

alter table public.game_questions
  add column if not exists created_by smallint check (created_by in (1,2));

create or replace function public.fm_new_question_v2(
  p_game uuid,
  p_secret text,
  p_player smallint,
  p_category text,
  p_question text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare qid uuid;
begin
  if p_player not in (1,2) then raise exception 'Invalid player'; end if;
  if not exists(select 1 from public.games where id=p_game and room_secret=p_secret) then raise exception 'Not allowed'; end if;

  insert into public.game_questions(game_id, category, question, created_by)
  values (p_game, left(p_category,80), left(p_question,600), p_player)
  returning id into qid;

  return qid;
end;
$$;

create or replace function public.fm_skip_question_v2(
  p_game uuid,
  p_secret text,
  p_question uuid,
  p_player smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_player not in (1,2) then raise exception 'Invalid player'; end if;
  if not exists(select 1 from public.games where id=p_game and room_secret=p_secret) then raise exception 'Not allowed'; end if;

  if exists(select 1 from public.game_answers where question_id=p_question) then
    raise exception 'Question already has an answer';
  end if;

  update public.game_questions
  set skipped=true
  where id=p_question and game_id=p_game and created_by=p_player;
end;
$$;

create or replace function public.fm_state_v2(
  p_game uuid,
  p_secret text,
  p_player smallint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
  q public.game_questions%rowtype;
  partner smallint;
  current_partner_answered boolean := false;
  hist jsonb;
begin
  if p_player not in (1,2) then raise exception 'Invalid player'; end if;
  partner := case when p_player=1 then 2 else 1 end;

  select * into g from public.games where id=p_game and room_secret=p_secret;
  if not found then raise exception 'Not allowed'; end if;

  select q0.* into q
  from public.game_questions q0
  where q0.game_id=p_game
    and not q0.skipped
    and q0.created_by=p_player
    and not exists(
      select 1 from public.game_answers a
      where a.question_id=q0.id and a.player_no=p_player
    )
  order by q0.created_at desc
  limit 1;

  if q.id is not null then
    select exists(
      select 1 from public.game_answers a
      where a.question_id=q.id and a.player_no=partner
    ) into current_partner_answered;
  end if;

  select coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb) into hist
  from (
    select
      qh.id,
      qh.category,
      qh.question,
      qh.skipped,
      qh.created_by,
      qh.created_at,
      exists(select 1 from public.game_answers a where a.question_id=qh.id and a.player_no=p_player) as my_submitted,
      exists(select 1 from public.game_answers a where a.question_id=qh.id and a.player_no=partner) as partner_submitted,
      (select a.answer from public.game_answers a where a.question_id=qh.id and a.player_no=p_player) as my_answer,
      case when
        exists(select 1 from public.game_answers a where a.question_id=qh.id and a.player_no=1)
        and exists(select 1 from public.game_answers a where a.question_id=qh.id and a.player_no=2)
      then (select a.answer from public.game_answers a where a.question_id=qh.id and a.player_no=1)
      else null end as player1_answer,
      case when
        exists(select 1 from public.game_answers a where a.question_id=qh.id and a.player_no=1)
        and exists(select 1 from public.game_answers a where a.question_id=qh.id and a.player_no=2)
      then (select a.answer from public.game_answers a where a.question_id=qh.id and a.player_no=2)
      else null end as player2_answer
    from public.game_questions qh
    where qh.game_id=p_game
  ) x;

  return jsonb_build_object(
    'player1_name', g.player1_name,
    'player2_name', g.player2_name,
    'current', case when q.id is null then null else jsonb_build_object(
      'id',q.id,
      'category',q.category,
      'question',q.question,
      'skipped',q.skipped,
      'created_by',q.created_by,
      'partner_submitted',current_partner_answered
    ) end,
    'history', hist
  );
end;
$$;

grant execute on function public.fm_new_question_v2(uuid,text,smallint,text,text) to anon, authenticated;
grant execute on function public.fm_skip_question_v2(uuid,text,uuid,smallint) to anon, authenticated;
grant execute on function public.fm_state_v2(uuid,text,smallint) to anon, authenticated;
