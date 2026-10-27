-- Owner 2026-10-12: Stripe payouts for ANY business the owner did jobs for that
-- week (not just Handy Andy + Dom's). { "<business slug>": amount }, one row per
-- pay_date. The legacy doms_stripe_payout / handy_andy_stripe_payout columns
-- stay and are still written for those two slugs; the API merges them in on read.
alter table app.actual_profit_weekly
  add column if not exists payouts_by_business jsonb not null default '{}'::jsonb;
