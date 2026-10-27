-- Secretary review-bonus popup (owner 2026-10-14): one row per bonus the
-- secretary has closed, so each ₱500 popup shows exactly once.
create table if not exists app.review_bonus_seen (
  booking_id uuid not null, name text not null, seen_at timestamptz not null default now(),
  primary key (booking_id, name));
alter table app.review_bonus_seen enable row level security;
