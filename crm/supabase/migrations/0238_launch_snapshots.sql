-- Launch saved snapshot (owner 2026-10-24): the Launch screen paints ONLY from
-- the last saved scan, so opening it costs one row read and no live checks.
-- The Refresh button runs every scan from the browser (launch_status,
-- launch_health, launch_traffic) and stores the combined result here via
-- launch_snapshot_save. Only the last few rows are kept (pruned on save).
-- Small edits (checklist ticks, notes, scores) patch the latest row in place;
-- rev is the optimistic-lock counter for those patches. Additive only.
create table if not exists app.launch_snapshots (
  id bigserial primary key,
  data jsonb not null,
  rev integer not null default 0,
  refreshed_at timestamptz not null default now(),
  refreshed_by text
);
alter table app.launch_snapshots enable row level security;
revoke all on app.launch_snapshots from anon, authenticated;
grant all on app.launch_snapshots to service_role;
grant usage, select on sequence app.launch_snapshots_id_seq to service_role;

-- Rollback (only if asked): drop table app.launch_snapshots;
