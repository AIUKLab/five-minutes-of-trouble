-- Five Minutes of Trouble — Supabase setup
-- Paste this entire file into Supabase > SQL Editor > New query > Run.

create extension if not exists pgcrypto;

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  room_secret text not null,
  player1_name text not null default 'Ange',
  player2_name text not null default 'Vee',
  created_at timestamptz not null default now()
);

create table if not exists public.game_questions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  category text not null,
  question text not null,
  skipped boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.game_answers (
  question_id uuid not null references public.game_questions(id) on delete cascade,
  player_no smallint not null check (player_no in (1,2)),
  answer text not null,
  created_at timestamptz not null default now(),
  primary key (question_id, player_no)
);

alter table public.games enable row level security;
alter table public.game_questions enable row level security;
alter table public.game_answers enable row level security;

revoke all on public.games from anon, authenticated;
revoke all on public.game_questions from anon, authenticated;
revoke all on public.game_answers from anon, authenticated;

create or replace function public.fm_create_game(p_secret text, p1 text, p2 text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare g uuid;
begin
  if length(coalesce(p_secret,'')) < 24 then raise exception 'Invalid secret'; end if;
  insert into public.games(room_secret, player1_name, player2_name)
  values (p_secret, left(coalesce(nullif(trim(p1),''),'Player 1'),40), left(coalesce(nullif(trim(p2),''),'Player 2'),40))
  returning id into g;
  return g;
end;
$$;

create or replace function public.fm_new_question(p_game uuid, p_secret text, p_category text, p_question text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare qid uuid;
begin
  if not exists(select 1 from public.games where id=p_game and room_secret=p_secret) then raise exception 'Not allowed'; end if;
  if exists(
    select 1 from public.game_questions q
    where q.game_id=p_game and not q.skipped
      and (select count(*) from public.game_answers a where a.question_id=q.id) < 2
  ) then raise exception 'Finish or skip the current question first'; end if;
  insert into public.game_questions(game_id, category, question)
  values (p_game, left(p_category,80), left(p_question,600)) returning id into qid;
  return qid;
end;
$$;

create or replace function public.fm_submit_answer(p_game uuid, p_secret text, p_question uuid, p_player smallint, p_answer text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_player not in (1,2) then raise exception 'Invalid player'; end if;
  if not exists(select 1 from public.games where id=p_game and room_secret=p_secret) then raise exception 'Not allowed'; end if;
  if not exists(select 1 from public.game_questions where id=p_question and game_id=p_game and not skipped) then raise exception 'Question unavailable'; end if;
  if length(trim(coalesce(p_answer,''))) = 0 then raise exception 'Answer required'; end if;
  insert into public.game_answers(question_id, player_no, answer)
  values (p_question, p_player, left(trim(p_answer),2000))
  on conflict (question_id, player_no) do update set answer=excluded.answer, created_at=now();
end;
$$;

create or replace function public.fm_skip_question(p_game uuid, p_secret text, p_question uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists(select 1 from public.games where id=p_game and room_secret=p_secret) then raise exception 'Not allowed'; end if;
  update public.game_questions set skipped=true where id=p_question and game_id=p_game;
end;
$$;

create or replace function public.fm_state(p_game uuid, p_secret text, p_player smallint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
  q public.game_questions%rowtype;
  a1 text; a2 text;
  hist jsonb;
begin
  if p_player not in (1,2) then raise exception 'Invalid player'; end if;
  select * into g from public.games where id=p_game and room_secret=p_secret;
  if not found then raise exception 'Not allowed'; end if;

  select * into q from public.game_questions
  where game_id=p_game and not skipped
  order by created_at desc limit 1;

  if q.id is not null then
    select answer into a1 from public.game_answers where question_id=q.id and player_no=1;
    select answer into a2 from public.game_answers where question_id=q.id and player_no=2;
  end if;

  select coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb) into hist
  from (
    select qh.id, qh.category, qh.question, qh.skipped, qh.created_at,
      case when count(ah.*) filter (where ah.player_no=1)>0 and count(ah.*) filter (where ah.player_no=2)>0
        then max(ah.answer) filter (where ah.player_no=1) else null end as player1_answer,
      case when count(ah.*) filter (where ah.player_no=1)>0 and count(ah.*) filter (where ah.player_no=2)>0
        then max(ah.answer) filter (where ah.player_no=2) else null end as player2_answer
    from public.game_questions qh
    left join public.game_answers ah on ah.question_id=qh.id
    where qh.game_id=p_game
    group by qh.id
  ) x;

  return jsonb_build_object(
    'player1_name', g.player1_name,
    'player2_name', g.player2_name,
    'current', case when q.id is null then null else jsonb_build_object(
      'id',q.id,'category',q.category,'question',q.question,'skipped',q.skipped,
      'my_answer',case when p_player=1 then a1 else a2 end,
      'partner_submitted',case when p_player=1 then a2 is not null else a1 is not null end,
      'both_submitted',a1 is not null and a2 is not null,
      'player1_answer',case when a1 is not null and a2 is not null then a1 else null end,
      'player2_answer',case when a1 is not null and a2 is not null then a2 else null end
    ) end,
    'history', hist
  );
end;
$$;

grant execute on function public.fm_create_game(text,text,text) to anon, authenticated;
grant execute on function public.fm_new_question(uuid,text,text,text) to anon, authenticated;
grant execute on function public.fm_submit_answer(uuid,text,uuid,smallint,text) to anon, authenticated;
grant execute on function public.fm_skip_question(uuid,text,uuid) to anon, authenticated;
grant execute on function public.fm_state(uuid,text,smallint) to anon, authenticated;
