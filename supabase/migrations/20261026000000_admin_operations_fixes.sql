-- =====================================================================
-- Admin operations fixes. Run AFTER 20261025000000_admin_operations.sql.
-- Fixes: functions callable by anyone, wrong booster config path,
-- payout that never credited wallets, missing safety checks, void
-- that did not void predictions, and a real dry-run preview.
-- =====================================================================

-- A prize can never be credited twice for the same gameweek and rank
create unique index if not exists wallet_ledger_prize_ref_uidx
  on public.wallet_ledger (source_reference) where type = 'prize';

-- ---------------------------------------------------------------------
-- Preview a settlement without writing anything
-- ---------------------------------------------------------------------
create or replace function public.preview_settlement_admin(
  p_fixture_id uuid, p_home_goals integer, p_away_goals integer
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  f public.fixtures;
  cfg jsonb; v_correct int; v_bonus int; v_mult int; v_result text; v_out jsonb;
begin
  if p_home_goals is null or p_away_goals is null or p_home_goals < 0 or p_away_goals < 0 then
    raise exception 'invalid score';
  end if;
  select * into f from public.fixtures where id = p_fixture_id;
  if not found then raise exception 'fixture not found'; end if;
  if f.status in ('void', 'finished') then raise exception 'fixture is already % ', f.status; end if;

  select points into cfg from public.app_config where id = true;
  v_correct := coalesce((cfg->>'correctOutcome')::int, 3);
  v_bonus   := coalesce((cfg->>'exactScoreBonus')::int, 2);
  v_mult    := greatest(coalesce((cfg->>'boosterMultiplier')::int, 2), 1);
  v_result  := case when p_home_goals > p_away_goals then 'home'
                    when p_home_goals < p_away_goals then 'away' else 'draw' end;

  with scored as (
    select p.booster,
           case when p.home_goals is not null and p.home_goals = p_home_goals
                     and p.away_goals = p_away_goals then 'exact'
                when p.outcome = v_result then 'correct'
                else 'wrong' end as kind
    from public.predictions p where p.fixture_id = p_fixture_id
  ), pts as (
    select booster, kind,
           (case kind when 'exact' then v_correct + v_bonus when 'correct' then v_correct else 0 end)
           * (case when booster then v_mult else 1 end) as points
    from scored
  )
  select jsonb_build_object(
    'predictions', count(*),
    'exact',   count(*) filter (where kind = 'exact'),
    'correct', count(*) filter (where kind = 'correct'),
    'wrong',   count(*) filter (where kind = 'wrong'),
    'boosted', count(*) filter (where booster and kind <> 'wrong'),
    'total_points', coalesce(sum(points), 0),
    'result', v_result
  ) into v_out from pts;
  return v_out;
end;
$$;

-- ---------------------------------------------------------------------
-- Settle a fixture (idempotent, one transaction)
-- ---------------------------------------------------------------------
create or replace function public.settle_fixture_admin(
  p_fixture_id uuid, p_home_goals integer, p_away_goals integer
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  f public.fixtures;
  cfg jsonb; v_correct int; v_bonus int; v_mult int; v_result text;
  v_exact int; v_correct_n int; v_wrong int; v_points bigint;
begin
  if p_home_goals is null or p_away_goals is null or p_home_goals < 0 or p_away_goals < 0 then
    raise exception 'invalid score';
  end if;

  select * into f from public.fixtures where id = p_fixture_id for update;
  if not found then raise exception 'fixture not found'; end if;
  if f.status = 'void' then raise exception 'fixture is void'; end if;
  if f.status = 'finished' then
    return jsonb_build_object('idempotent', true, 'fixture_id', p_fixture_id);
  end if;
  if f.kickoff_at > now() then raise exception 'fixture has not kicked off yet'; end if;

  select points into cfg from public.app_config where id = true;
  v_correct := coalesce((cfg->>'correctOutcome')::int, 3);
  v_bonus   := coalesce((cfg->>'exactScoreBonus')::int, 2);
  v_mult    := greatest(coalesce((cfg->>'boosterMultiplier')::int, 2), 1);
  v_result  := case when p_home_goals > p_away_goals then 'home'
                    when p_home_goals < p_away_goals then 'away' else 'draw' end;

  update public.fixtures
     set status = 'finished', home_goals = p_home_goals, away_goals = p_away_goals, settled_at = now()
   where id = p_fixture_id;

  update public.predictions p
     set result = case when p.home_goals is not null and p.home_goals = p_home_goals
                            and p.away_goals = p_away_goals then 'exact'
                       when p.outcome = v_result then 'correct'
                       else 'wrong' end,
         points_awarded =
           (case when p.home_goals is not null and p.home_goals = p_home_goals
                      and p.away_goals = p_away_goals then v_correct + v_bonus
                 when p.outcome = v_result then v_correct
                 else 0 end)
           * (case when p.booster then v_mult else 1 end)
   where p.fixture_id = p_fixture_id;

  select count(*) filter (where result = 'exact'),
         count(*) filter (where result = 'correct'),
         count(*) filter (where result = 'wrong'),
         coalesce(sum(points_awarded), 0)
    into v_exact, v_correct_n, v_wrong, v_points
    from public.predictions where fixture_id = p_fixture_id;

  return jsonb_build_object('idempotent', false, 'fixture_id', p_fixture_id,
    'exact', v_exact, 'correct', v_correct_n, 'wrong', v_wrong,
    'total_points', v_points, 'booster_multiplier', v_mult);
end;
$$;

-- ---------------------------------------------------------------------
-- Void a fixture (also voids its predictions)
-- ---------------------------------------------------------------------
create or replace function public.void_fixture_admin(p_fixture_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  f public.fixtures; v_count int;
begin
  select * into f from public.fixtures where id = p_fixture_id for update;
  if not found then raise exception 'fixture not found'; end if;
  if f.status = 'void' then
    return jsonb_build_object('idempotent', true, 'fixture_id', p_fixture_id);
  end if;

  -- Never change points after prizes were paid for that gameweek
  if exists (
    select 1 from public.prize_awards pa
    join public.predictions p on p.gameweek_id = pa.gameweek_id
    where p.fixture_id = p_fixture_id
  ) then
    raise exception 'prizes were already paid for this gameweek; cannot void';
  end if;

  update public.fixtures set status = 'void' where id = p_fixture_id;
  update public.predictions set result = 'void', points_awarded = 0 where fixture_id = p_fixture_id;
  get diagnostics v_count = row_count;

  return jsonb_build_object('idempotent', false, 'fixture_id', p_fixture_id, 'predictions_voided', v_count);
end;
$$;

-- ---------------------------------------------------------------------
-- Who would win a gameweek's prizes (used by preview and payout)
-- ---------------------------------------------------------------------
create or replace function public.weekly_payout_candidates(p_gameweek_id uuid)
returns table (
  rank integer, user_id uuid, nickname text, points integer,
  exact_scores integer, correct_results integer, amount_naira numeric
)
language sql stable security definer set search_path = public as $$
  with cfg as (
    select prize_tiers, minimum_predictions from public.app_config where id = true
  ), gw as (
    select id, qualification_waived from public.gameweeks where id = p_gameweek_id
  ), eligible as (
    select wl.user_id, wl.nickname, wl.points, wl.exact_scores, wl.correct_results, wl.first_prediction_at
    from public.weekly_leaderboard wl
    join gw on gw.id = wl.gameweek_id
    left join public.weekly_qualification q
      on q.user_id = wl.user_id and q.gameweek_id = wl.gameweek_id
    cross join cfg
    where wl.gameweek_id = p_gameweek_id
      and wl.points > 0
      and wl.predictions_count >= cfg.minimum_predictions
      and (gw.qualification_waived or coalesce(q.qualified, false))
  ), ranked as (
    select (row_number() over (
              order by e.points desc, e.exact_scores desc, e.correct_results desc,
                       e.first_prediction_at asc, e.user_id))::int as rank,
           e.*
    from eligible e
  )
  select r.rank, r.user_id, r.nickname, r.points, r.exact_scores, r.correct_results,
         (t.value->>'naira')::numeric
  from ranked r
  cross join cfg
  join lateral jsonb_array_elements(cfg.prize_tiers) as t(value)
    on (case when jsonb_typeof(t.value->'rank') = 'number'
             then (t.value->>'rank')::int end) = r.rank
  order by r.rank;
$$;

-- ---------------------------------------------------------------------
-- Weekly payout: dry run or real run (awards + wallet credits + paid flag)
-- ---------------------------------------------------------------------
create or replace function public.weekly_payout_admin(p_gameweek_id uuid, p_dry_run boolean default true)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  g public.gameweeks; c public.app_config;
  v_total numeric := 0; v_count integer := 0;
begin
  select * into g from public.gameweeks where id = p_gameweek_id for update;
  if not found then raise exception 'gameweek not found'; end if;
  select * into c from public.app_config where id = true for update;

  if c.prizes_paused then raise exception 'prizes are paused'; end if;
  if g.prize_status = 'paid'
     or exists (select 1 from public.prize_awards where gameweek_id = p_gameweek_id) then
    raise exception 'this gameweek was already paid';
  end if;
  if g.ends_at > now() then raise exception 'gameweek has not ended yet'; end if;
  if exists (
    select 1 from public.fixtures f
    where f.kickoff_at >= g.starts_at and f.kickoff_at <= g.ends_at
      and f.status in ('scheduled', 'live')
  ) then
    raise exception 'unsettled fixtures remain in this gameweek';
  end if;

  -- Refresh qualification for everyone who predicted this week
  perform public.compute_weekly_qualification(u.user_id, p_gameweek_id)
  from (select distinct user_id from public.predictions where gameweek_id = p_gameweek_id) u;

  select coalesce(sum(amount_naira), 0), count(*)
    into v_total, v_count
    from public.weekly_payout_candidates(p_gameweek_id);

  if p_dry_run then
    return jsonb_build_object(
      'dry_run', true, 'total', v_total, 'winners', v_count,
      'budget', c.weekly_budget_naira, 'over_budget', v_total > c.weekly_budget_naira,
      'rows', coalesce((select jsonb_agg(to_jsonb(x) order by x.rank)
                          from public.weekly_payout_candidates(p_gameweek_id) x), '[]'::jsonb));
  end if;

  if v_total > c.weekly_budget_naira then raise exception 'payout total exceeds the weekly budget'; end if;
  if v_count = 0 then raise exception 'no eligible winners for this gameweek'; end if;

  insert into public.prize_awards (gameweek_id, user_id, rank, amount_naira)
  select p_gameweek_id, user_id, rank, amount_naira
  from public.weekly_payout_candidates(p_gameweek_id);

  insert into public.wallet_ledger (user_id, amount_naira, type, source_reference, status, available_at, note)
  select user_id, amount_naira, 'prize',
         'gameweek:' || p_gameweek_id::text || ':rank:' || rank::text,
         'available', now(), 'Weekly prize, rank ' || rank::text
  from public.weekly_payout_candidates(p_gameweek_id);

  update public.gameweeks set prize_status = 'paid' where id = p_gameweek_id;

  return jsonb_build_object('dry_run', false, 'total', v_total, 'winners', v_count);
end;
$$;

-- ---------------------------------------------------------------------
-- CRITICAL: these functions bypass Row Level Security. Only the server
-- (service role) may run them. Without this, anyone with your public
-- anon key could call them from the browser.
-- ---------------------------------------------------------------------
revoke execute on function public.preview_settlement_admin(uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.settle_fixture_admin(uuid, integer, integer)     from public, anon, authenticated;
revoke execute on function public.void_fixture_admin(uuid)                         from public, anon, authenticated;
revoke execute on function public.weekly_payout_candidates(uuid)                   from public, anon, authenticated;
revoke execute on function public.weekly_payout_admin(uuid, boolean)               from public, anon, authenticated;

grant execute on function public.preview_settlement_admin(uuid, integer, integer) to service_role;
grant execute on function public.settle_fixture_admin(uuid, integer, integer)     to service_role;
grant execute on function public.void_fixture_admin(uuid)                         to service_role;
grant execute on function public.weekly_payout_candidates(uuid)                   to service_role;
grant execute on function public.weekly_payout_admin(uuid, boolean)               to service_role;

-- ---------------------------------------------------------------------
-- TESTING NOTES (do not run on a live site):
-- Settlement needs a fixture whose kickoff has passed. Example:
--   update public.fixtures set kickoff_at = now() - interval '3 hours'
--   where external_id = 'seed-fix-01';
-- To test a payout, every fixture in that gameweek must be settled or
-- void, and the gameweek must have ended:
--   update public.gameweeks set ends_at = now() - interval '1 minute'
--   where id = '<gameweek id>';
-- ---------------------------------------------------------------------
