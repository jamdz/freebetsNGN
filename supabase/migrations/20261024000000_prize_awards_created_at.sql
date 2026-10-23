alter table public.prize_awards add column if not exists created_at timestamptz not null default now();
