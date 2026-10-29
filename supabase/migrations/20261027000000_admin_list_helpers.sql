-- Admin list helpers: per-fixture prediction stats and list indexes.
-- Run in the Supabase SQL Editor. Safe to run more than once.

create or replace function public.admin_fixture_prediction_stats(p_fixture_ids uuid[])
returns table (
  fixture_id uuid,
  prediction_count integer,
  exact_count integer,
  correct_count integer,
  wrong_count integer,
  total_points integer
)
language sql stable security definer set search_path = public as $$
  select p.fixture_id,
         count(*)::int,
         (count(*) filter (where p.result = 'exact'))::int,
         (count(*) filter (where p.result = 'correct'))::int,
         (count(*) filter (where p.result = 'wrong'))::int,
         coalesce(sum(p.points_awarded), 0)::int
  from public.predictions p
  where p.fixture_id = any(p_fixture_ids)
  group by p.fixture_id;
$$;

-- Only the server (service role) may call it
revoke execute on function public.admin_fixture_prediction_stats(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_fixture_prediction_stats(uuid[]) to service_role;

-- Faster filtering and paging
create index if not exists fixtures_status_kickoff_idx on public.fixtures (status, kickoff_at desc);
create index if not exists predictions_fixture_result_idx on public.predictions (fixture_id, result);
create index if not exists profiles_created_idx on public.profiles (created_at desc);
