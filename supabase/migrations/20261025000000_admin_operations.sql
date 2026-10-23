create or replace function public.settle_fixture_admin(p_fixture_id uuid, p_home_goals integer, p_away_goals integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare f public.fixtures; p public.predictions; cfg jsonb; multiplier integer; awarded integer := 0; result_name text;
begin
  select * into f from public.fixtures where id = p_fixture_id for update;
  if not found or f.status = 'void' then raise exception 'fixture unavailable'; end if;
  if f.status = 'finished' then return jsonb_build_object('idempotent', true, 'fixture_id', p_fixture_id); end if;
  result_name := case when p_home_goals > p_away_goals then 'home' when p_home_goals < p_away_goals then 'away' else 'draw' end;
  cfg := coalesce((select points from public.app_config where id = true), '{}'::jsonb);
  multiplier := greatest(coalesce((select (boosters->>'boosterMultiplier')::int from public.app_config where id = true), 2), 1);
  update public.fixtures set status = 'finished', home_goals = p_home_goals, away_goals = p_away_goals, settled_at = now() where id = p_fixture_id;
  for p in select * from public.predictions where fixture_id = p_fixture_id for update loop
    if p.home_goals = p_home_goals and p.away_goals = p_away_goals then
      update public.predictions set result = 'exact', points_awarded = (coalesce((cfg->>'correctOutcome')::int, 3) + coalesce((cfg->>'exactScoreBonus')::int, 2)) * case when p.booster then multiplier else 1 end where user_id = p.user_id and fixture_id = p.fixture_id;
    elsif p.outcome = result_name then
      update public.predictions set result = 'correct', points_awarded = coalesce((cfg->>'correctOutcome')::int, 3) * case when p.booster then multiplier else 1 end where user_id = p.user_id and fixture_id = p.fixture_id;
    else
      update public.predictions set result = 'wrong', points_awarded = 0 where user_id = p.user_id and fixture_id = p.fixture_id;
    end if;
    awarded := awarded + 1;
  end loop;
  return jsonb_build_object('idempotent', false, 'fixture_id', p_fixture_id, 'predictions', awarded, 'booster_multiplier', multiplier);
end; $$;

create or replace function public.weekly_payout_admin(p_gameweek_id uuid, p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g public.gameweeks; c public.app_config; total numeric := 0; count_awards integer := 0;
begin
  select * into g from public.gameweeks where id = p_gameweek_id for update;
  if not found then raise exception 'gameweek not found'; end if;
  select * into c from public.app_config where id = true for update;
  if c.prizes_paused then raise exception 'prizes are paused'; end if;
  select coalesce(sum((tier->>'naira')::numeric),0), count(*) into total, count_awards from jsonb_array_elements(c.prize_tiers) tier;
  if total > c.weekly_budget_naira then raise exception 'weekly prize tiers exceed budget'; end if;
  if exists (select 1 from public.prize_awards where gameweek_id = p_gameweek_id) and not p_dry_run then raise exception 'payout already run'; end if;
  if p_dry_run then return jsonb_build_object('dry_run', true, 'total', total, 'tier_count', count_awards); end if;
  insert into public.prize_awards(gameweek_id,user_id,rank,amount_naira)
  select p_gameweek_id, l.user_id, l.rank, (tier->>'naira')::numeric from (select wl.user_id, row_number() over(order by wl.points desc, wl.exact_scores desc, wl.correct_results desc) rank from public.weekly_leaderboard wl join public.weekly_qualification q on q.user_id=wl.user_id and q.gameweek_id=wl.gameweek_id where wl.gameweek_id=p_gameweek_id and (q.qualified or g.qualification_waived) and wl.predictions_count >= c.minimum_predictions) l join lateral (select value tier from jsonb_array_elements(c.prize_tiers) value where (value->>'rank')::int=l.rank) t on true;
  return jsonb_build_object('dry_run', false, 'total', total);
end; $$;
