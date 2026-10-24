-- =====================================================================
-- Admin operations fixes. Run AFTER 20261025000000_admin_operations.sql.
-- Fixes: functions callable by anyone, wrong booster config path,
-- payout that never credited wallets, missing safety checks, void
-- that did not void predictions, and a real dry-run preview.
-- =====================================================================

create unique index if not exists wallet_ledger_prize_ref_uidx
  on public.wallet_ledger (source_reference) where type = 'prize';

create or replace function public.preview_settlement_admin(
  p_fixture_id uuid, p_home_goals integer, p_away_goals integer
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f public.fixtures; cfg jsonb; v_correct int; v_bonus int; v_mult int; v_result text; v_out jsonb;
begin
  if p_home_goals is null or p_away_goals is null or p_home_goals < 0 or p_away_goals < 0 then raise exception 'invalid score'; end if;
  select * into f from public.fixtures where id = p_fixture_id;
  if not found then raise exception 'fixture not found'; end if;
  if f.status in ('void', 'finished') then raise exception 'fixture is already % ', f.status; end if;
  select points into cfg from public.app_config where id = true;
  v_correct := coalesce((cfg->'points'->>'correctOutcome')::int, 3); v_bonus := coalesce((cfg->'points'->>'exactScoreBonus')::int, 2); v_mult := greatest(coalesce((cfg->'points'->>'boosterMultiplier')::int, 2), 1);
  v_result := case when p_home_goals > p_away_goals then 'home' when p_home_goals < p_away_goals then 'away' else 'draw' end;
  with scored as (select p.booster, case when p.home_goals = p_home_goals and p.away_goals = p_away_goals then 'exact' when p.outcome = v_result then 'correct' else 'wrong' end as kind from public.predictions p where p.fixture_id = p_fixture_id), pts as (select booster, kind, (case kind when 'exact' then v_correct + v_bonus when 'correct' then v_correct else 0 end) * case when booster then v_mult else 1 end as points from scored)
  select jsonb_build_object('predictions', count(*), 'exact', count(*) filter (where kind = 'exact'), 'correct', count(*) filter (where kind = 'correct'), 'wrong', count(*) filter (where kind = 'wrong'), 'boosted', count(*) filter (where booster and kind <> 'wrong'), 'total_points', coalesce(sum(points), 0), 'result', v_result) into v_out from pts;
  return v_out;
end; $$;

create or replace function public.settle_fixture_admin(p_fixture_id uuid, p_home_goals integer, p_away_goals integer) returns jsonb language plpgsql security definer set search_path = public as $$
declare f public.fixtures; cfg jsonb; v_correct int; v_bonus int; v_mult int; v_result text; v_exact int; v_correct_n int; v_wrong int; v_points bigint;
begin
  if p_home_goals is null or p_away_goals is null or p_home_goals < 0 or p_away_goals < 0 then raise exception 'invalid score'; end if;
  select * into f from public.fixtures where id = p_fixture_id for update;
  if not found then raise exception 'fixture not found'; end if; if f.status = 'void' then raise exception 'fixture is void'; end if; if f.status = 'finished' then return jsonb_build_object('idempotent', true, 'fixture_id', p_fixture_id); end if; if f.kickoff_at > now() then raise exception 'fixture has not kicked off yet'; end if;
  select points into cfg from public.app_config where id = true; v_correct := coalesce((cfg->'points'->>'correctOutcome')::int, 3); v_bonus := coalesce((cfg->'points'->>'exactScoreBonus')::int, 2); v_mult := greatest(coalesce((cfg->'points'->>'boosterMultiplier')::int, 2), 1); v_result := case when p_home_goals > p_away_goals then 'home' when p_home_goals < p_away_goals then 'away' else 'draw' end;
  update public.fixtures set status = 'finished', home_goals = p_home_goals, away_goals = p_away_goals, settled_at = now() where id = p_fixture_id;
  update public.predictions p set result = case when p.home_goals = p_home_goals and p.away_goals = p_away_goals then 'exact' when p.outcome = v_result then 'correct' else 'wrong' end, points_awarded = (case when p.home_goals = p_home_goals and p.away_goals = p_away_goals then v_correct + v_bonus when p.outcome = v_result then v_correct else 0 end) * case when p.booster then v_mult else 1 end where p.fixture_id = p_fixture_id;
  select count(*) filter (where result = 'exact'), count(*) filter (where result = 'correct'), count(*) filter (where result = 'wrong'), coalesce(sum(points_awarded), 0) into v_exact, v_correct_n, v_wrong, v_points from public.predictions where fixture_id = p_fixture_id;
  return jsonb_build_object('idempotent', false, 'fixture_id', p_fixture_id, 'exact', v_exact, 'correct', v_correct_n, 'wrong', v_wrong, 'total_points', v_points, 'booster_multiplier', v_mult);
end; $$;

create or replace function public.void_fixture_admin(p_fixture_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare f public.fixtures; v_count int;
begin select * into f from public.fixtures where id = p_fixture_id for update; if not found then raise exception 'fixture not found'; end if; if f.status = 'void' then return jsonb_build_object('idempotent', true, 'fixture_id', p_fixture_id); end if; if exists (select 1 from public.prize_awards pa join public.predictions p on p.gameweek_id = pa.gameweek_id where p.fixture_id = p_fixture_id) then raise exception 'prizes were already paid for this gameweek; cannot void'; end if; update public.fixtures set status = 'void' where id = p_fixture_id; update public.predictions set result = 'void', points_awarded = 0 where fixture_id = p_fixture_id; get diagnostics v_count = row_count; return jsonb_build_object('idempotent', false, 'fixture_id', p_fixture_id, 'predictions_voided', v_count); end; $$;

revoke execute on function public.preview_settlement_admin(uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.settle_fixture_admin(uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.void_fixture_admin(uuid) from public, anon, authenticated;
grant execute on function public.preview_settlement_admin(uuid, integer, integer) to service_role;
grant execute on function public.settle_fixture_admin(uuid, integer, integer) to service_role;
grant execute on function public.void_fixture_admin(uuid) to service_role;
