-- =====================================================================
-- FreeBetNGN core backend (fixed and merged)
-- Run ONCE on an empty project in the Supabase SQL Editor.
-- Based on v0's migration, with fixes for: the enum LIKE error,
-- self-editable roles, signup trigger, leaderboard visibility,
-- policy recursion, RPC abuse, waived gameweeks, append-only tables,
-- and seed values matching your project config.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Types ----------
create type public.profile_role   as enum ('user','admin');
create type public.profile_status as enum ('active','suspended','banned','deactivated');
create type public.fixture_status as enum ('scheduled','live','finished','postponed','void');
create type public.prize_status   as enum ('open','paid');
create type public.ledger_type    as enum ('prize','offer','referral_general','referral_promo','spin','bonus','withdrawal','refund','adjustment');
create type public.ledger_status  as enum ('pending','available','reversed');

-- ---------- Tables ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique check (length(nickname) between 3 and 24),
  phone text unique,
  email text,
  phone_verified boolean not null default false,
  email_verified boolean not null default false,
  role public.profile_role not null default 'user',
  status public.profile_status not null default 'active',
  deactivated_at timestamptz,
  referral_code text not null unique,
  referred_by uuid references public.profiles(id),
  referred_program text check (referred_program in ('general','promo')),
  promo_campaign_id uuid,
  streak_count integer not null default 0 check (streak_count >= 0),
  last_visit_date date,
  boosters_bonus integer not null default 0 check (boosters_bonus >= 0),
  nickname_changed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  external_id text unique,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid references public.competitions(id) on delete set null,
  name text not null,
  external_id text unique,
  created_at timestamptz not null default now()
);

create table public.gameweeks (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  prize_status public.prize_status not null default 'open',
  qualification_waived boolean not null default false,
  check (ends_at > starts_at)
);

create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid references public.competitions(id) on delete set null,
  home_team_id uuid references public.teams(id),
  away_team_id uuid references public.teams(id),
  kickoff_at timestamptz not null,
  status public.fixture_status not null default 'scheduled',
  home_goals integer check (home_goals is null or home_goals >= 0),
  away_goals integer check (away_goals is null or away_goals >= 0),
  settled_at timestamptz,
  external_id text unique,
  created_at timestamptz not null default now()
);

create table public.predictions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  outcome text not null check (outcome in ('home','draw','away')),
  home_goals integer not null check (home_goals >= 0),
  away_goals integer not null check (away_goals >= 0),
  booster boolean not null default false,
  gameweek_id uuid not null references public.gameweeks(id) on delete cascade,
  points_awarded integer not null default 0,
  result text check (result in ('exact','correct','wrong','void')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, fixture_id)
);

create table public.daily_activity (
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_date date not null,
  logged_in boolean not null default false,
  predictions_count integer not null default 0,
  primary key (user_id, activity_date)
);

create table public.weekly_qualification (
  user_id uuid not null references public.profiles(id) on delete cascade,
  gameweek_id uuid not null references public.gameweeks(id) on delete cascade,
  active_days integer not null default 0,
  qualified boolean not null default false,
  computed_at timestamptz not null default now(),
  primary key (user_id, gameweek_id)
);

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create table public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_naira numeric(12,2) not null,
  type public.ledger_type not null,
  source_reference text not null,
  status public.ledger_status not null default 'pending',
  available_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create table public.prize_awards (
  id uuid primary key default gen_random_uuid(),
  gameweek_id uuid not null references public.gameweeks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rank integer not null,
  amount_naira numeric(12,2) not null,
  unique (gameweek_id, user_id)
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  fingerprint text not null,
  last_seen_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);

create table public.fraud_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  severity text not null default 'medium',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.app_config (
  id boolean primary key default true check (id),
  points jsonb not null default '{}'::jsonb,
  boosters jsonb not null default '{}'::jsonb,
  streak_days integer not null default 7,
  prize_tiers jsonb not null default '[]'::jsonb,
  minimum_predictions integer not null default 5,
  qualification_rules jsonb not null default '{}'::jsonb,
  withdrawal_rules jsonb not null default '{}'::jsonb,
  general_referral_rules jsonb not null default '{}'::jsonb,
  weekly_budget_naira numeric(12,2) not null default 0,
  prizes_paused boolean not null default false
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Indexes ----------
create index predictions_gameweek_idx on public.predictions (gameweek_id, user_id);
create index predictions_fixture_idx  on public.predictions (fixture_id);
create index fixtures_kickoff_idx     on public.fixtures (kickoff_at);
create index ledger_user_idx          on public.wallet_ledger (user_id, status);
create index daily_activity_date_idx  on public.daily_activity (activity_date);
create index audit_log_created_idx    on public.audit_log (created_at desc);

-- ---------- Seed settings (matches your project config) ----------
insert into public.app_config (
  id, points, boosters, streak_days, prize_tiers, minimum_predictions,
  qualification_rules, withdrawal_rules, general_referral_rules,
  weekly_budget_naira, prizes_paused
) values (
  true,
  '{"correctOutcome":3,"exactScoreBonus":2,"boosterMultiplier":2,"wrong":0}',
  '{"perWeek":1,"bonusPerStreak":1}',
  3,
  '[{"rank":1,"naira":5000},{"rank":2,"naira":3000},{"rank":3,"naira":2000},{"rank":4,"naira":1000},{"rank":5,"naira":500},{"rank":6,"naira":300},{"rank":7,"naira":250},{"rank":8,"naira":200},{"rank":9,"naira":150},{"rank":10,"naira":100}]',
  5,
  '{"minActiveDays":6,"minPredictionsPerActiveDay":4,"minFixturesForDayToCount":4,"withdrawalRequiresQualification":true}',
  '{"minAirtimeNaira":100,"minCashNaira":2000,"cashFeeNaira":0,"bankAccountChangeCooldownDays":7,"onePendingRequestAtATime":true}',
  '{"rewardNaira":50,"activeDaysRequired":24,"windowDays":28,"minPredictions":10}',
  15000,
  false
) on conflict (id) do nothing;

-- ---------- Functions ----------

-- Admin check. SECURITY DEFINER avoids infinite recursion in profiles policies.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin' and status = 'active'
  );
$$;

-- Weekly qualification (respects waived gameweeks)
create or replace function public.compute_weekly_qualification(p_user_id uuid, p_gameweek_id uuid)
returns public.weekly_qualification
language plpgsql security invoker set search_path = public as $$
declare
  min_days int; min_preds int; min_fixtures int;
  g public.gameweeks;
  v_days int; v_qualified boolean;
  result public.weekly_qualification;
begin
  select coalesce((qualification_rules->>'minActiveDays')::int, 6),
         coalesce((qualification_rules->>'minPredictionsPerActiveDay')::int, 4),
         coalesce((qualification_rules->>'minFixturesForDayToCount')::int, 4)
    into min_days, min_preds, min_fixtures
  from public.app_config where id = true;

  select * into g from public.gameweeks where id = p_gameweek_id;
  if not found then
    raise exception 'gameweek % not found', p_gameweek_id;
  end if;

  select count(*)::int into v_days
  from public.daily_activity d
  where d.user_id = p_user_id
    and d.activity_date between (g.starts_at at time zone 'Africa/Lagos')::date
                            and (g.ends_at   at time zone 'Africa/Lagos')::date
    and d.logged_in
    and d.predictions_count >= min_preds
    and (select count(*) from public.fixtures f
         where (f.kickoff_at at time zone 'Africa/Lagos')::date = d.activity_date
           and f.status <> 'void') >= min_fixtures;

  v_qualified := g.qualification_waived or v_days >= min_days;

  insert into public.weekly_qualification as q (user_id, gameweek_id, active_days, qualified, computed_at)
  values (p_user_id, p_gameweek_id, v_days, v_qualified, now())
  on conflict (user_id, gameweek_id) do update
    set active_days = excluded.active_days,
        qualified   = excluded.qualified,
        computed_at = excluded.computed_at
  returning * into result;

  return result;
end;
$$;

-- Counts a prediction toward today's activity (server use only)
create or replace function public.record_prediction_activity(p_user_id uuid, p_activity_date date)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.daily_activity (user_id, activity_date, logged_in, predictions_count)
  values (p_user_id, p_activity_date, false, 1)
  on conflict (user_id, activity_date)
  do update set predictions_count = public.daily_activity.predictions_count + 1;
end;
$$;

-- New-user trigger: creates the profile, saves phone, links the referrer
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (
    id, nickname, email, phone, referral_code, email_verified, referred_by, referred_program
  )
  select
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nickname', ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data->>'phone', ''),
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    new.email_confirmed_at is not null,
    r.id,
    case when r.id is not null then 'general' end
  from (select 1) s
  left join public.profiles r
    on r.referral_code = upper(nullif(new.raw_user_meta_data->>'referralCode', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the profile's verified flag in sync when email gets confirmed
create or replace function public.sync_email_verified()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.profiles set email_verified = true where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update on auth.users
  for each row execute function public.sync_email_verified();

-- ---------- Append-only protection ----------
create or replace function public.block_ledger_changes()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'wallet_ledger rows cannot be deleted';
  end if;
  if new.user_id <> old.user_id
     or new.amount_naira <> old.amount_naira
     or new.type <> old.type
     or new.source_reference <> old.source_reference then
    raise exception 'wallet_ledger money fields cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists wallet_ledger_protect on public.wallet_ledger;
create trigger wallet_ledger_protect
  before update or delete on public.wallet_ledger
  for each row execute function public.block_ledger_changes();

create or replace function public.block_audit_changes()
returns trigger language plpgsql as $$
begin
  -- allow only the automatic "actor deleted" nulling
  if tg_op = 'UPDATE' and new.actor_id is null and old.actor_id is not null
     and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id') then
    return new;
  end if;
  raise exception 'audit_log is append-only';
end;
$$;

drop trigger if exists audit_log_protect on public.audit_log;
create trigger audit_log_protect
  before update or delete on public.audit_log
  for each row execute function public.block_audit_changes();

-- ---------- Views ----------

-- Everyone signed in can read the leaderboard (only safe columns)
create or replace view public.weekly_leaderboard with (security_invoker = false) as
select
  p.id as user_id,
  p.nickname,
  pr.gameweek_id,
  coalesce(sum(pr.points_awarded), 0)::int as points,
  count(*) filter (where pr.result = 'exact')::int as exact_scores,
  count(*) filter (where pr.result = 'correct')::int as correct_results,
  min(pr.created_at) as first_prediction_at,
  count(*)::int as predictions_count,
  coalesce(q.qualified, false) as qualified
from public.profiles p
join public.predictions pr on pr.user_id = p.id
left join public.weekly_qualification q
  on q.user_id = p.id and q.gameweek_id = pr.gameweek_id
where p.status = 'active'
group by p.id, p.nickname, pr.gameweek_id, q.qualified;

-- Each user sees only their own balances (RLS applies)
create or replace view public.user_balances with (security_invoker = true) as
select
  user_id,
  coalesce(sum(amount_naira) filter (where status = 'available'), 0) as available,
  coalesce(sum(amount_naira) filter (where status = 'pending'), 0) as pending,
  coalesce(sum(amount_naira) filter (where type = 'prize' and status <> 'reversed'), 0) as prize_total,
  coalesce(sum(amount_naira) filter (where type::text like 'referral%' and status <> 'reversed'), 0) as referral_total
from public.wallet_ledger
group by user_id;

-- ---------- Row Level Security ----------
alter table public.profiles             enable row level security;
alter table public.competitions         enable row level security;
alter table public.teams                enable row level security;
alter table public.fixtures             enable row level security;
alter table public.gameweeks            enable row level security;
alter table public.predictions          enable row level security;
alter table public.daily_activity       enable row level security;
alter table public.weekly_qualification enable row level security;
alter table public.leagues              enable row level security;
alter table public.league_members       enable row level security;
alter table public.wallet_ledger        enable row level security;
alter table public.prize_awards         enable row level security;
alter table public.devices              enable row level security;
alter table public.fraud_flags          enable row level security;
alter table public.app_config           enable row level security;
alter table public.audit_log            enable row level security;

-- Read policies only. Users never write directly: all writes go through server routes.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy competitions_read on public.competitions for select to authenticated using (true);
create policy teams_read        on public.teams        for select to authenticated using (true);
create policy fixtures_read     on public.fixtures     for select to authenticated using (true);
create policy gameweeks_read    on public.gameweeks    for select to authenticated using (true);

create policy predictions_self on public.predictions
  for select to authenticated using (user_id = (select auth.uid()));
create policy activity_self on public.daily_activity
  for select to authenticated using (user_id = (select auth.uid()));
create policy qualification_self on public.weekly_qualification
  for select to authenticated using (user_id = (select auth.uid()));

create policy leagues_read on public.leagues
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.league_members m
      where m.league_id = leagues.id and m.user_id = (select auth.uid())
    )
  );
create policy membership_self on public.league_members
  for select to authenticated using (user_id = (select auth.uid()));

create policy wallet_self on public.wallet_ledger
  for select to authenticated using (user_id = (select auth.uid()));
create policy awards_self on public.prize_awards
  for select to authenticated using (user_id = (select auth.uid()));
create policy devices_self on public.devices
  for select to authenticated using (user_id = (select auth.uid()));
create policy fraud_self on public.fraud_flags
  for select to authenticated using (user_id = (select auth.uid()));

create policy config_read on public.app_config for select to authenticated using (true);
create policy audit_admin on public.audit_log  for select to authenticated using (public.is_admin());

-- ---------- Privileges (defense in depth) ----------
-- No direct writes from the browser, on any table, now or in future tables.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke insert, update, delete on tables from anon, authenticated;

-- The browser cannot read anything as an anonymous visitor
revoke select on all tables in schema public from anon;

grant select on public.weekly_leaderboard to authenticated;
grant select on public.user_balances      to authenticated;

-- Sensitive functions: callable only by the server (service role)
revoke execute on function public.record_prediction_activity(uuid, date) from public, anon, authenticated;
revoke execute on function public.compute_weekly_qualification(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_email_verified() from public, anon, authenticated;
revoke execute on function public.block_ledger_changes() from public, anon, authenticated;
revoke execute on function public.block_audit_changes() from public, anon, authenticated;
grant execute on function public.record_prediction_activity(uuid, date) to service_role;
grant execute on function public.compute_weekly_qualification(uuid, uuid) to service_role;

-- is_admin() must stay callable by signed-in users because policies use it
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
