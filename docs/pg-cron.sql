-- Optional database schedules. Enable pg_cron first, then paste this into Supabase SQL Editor.
-- This is intentionally not a migration and does not run automatically.
select cron.schedule('freebet-spin-tick', '* * * * *', $$select public.spin_tick()$$);
select cron.schedule('freebet-release-pending-ledger', '*/15 * * * *', $$select public.release_pending_ledger()$$);
select cron.schedule('freebet-evaluate-general-referrals', '0 * * * *', $$select public.evaluate_general_referrals()$$);
