-- 0221: expanded cycle sharing for Andrew (Jiyah approved, note aa3b272d).
-- ADDITIVE ONLY: new columns with defaults + one access-log table.
-- No UPDATE/DELETE. Existing settings columns and all rows (incl. legacy
-- cal_period_days) are untouched. Andrew only receives anything when the
-- env flag CYCLE_SHARE_OWNER is exactly 'on'.
alter table app.cal_cycle_settings
  add column if not exists share_flow boolean not null default true,
  add column if not exists share_logs boolean not null default true,
  add column if not exists share_notes boolean not null default true,
  add column if not exists share_heads_up boolean not null default true,
  add column if not exists andrew_remind_on boolean not null default false,
  add column if not exists andrew_remind_days integer not null default 2;

-- Who read cycle data and when. Never stores cycle data or notes.
create table if not exists app.cal_cycle_access_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  who text not null,
  route text not null,
  flag_state text not null
);
alter table app.cal_cycle_access_log enable row level security;
revoke all on app.cal_cycle_access_log from anon, authenticated;
grant all on app.cal_cycle_access_log to service_role;
grant usage, select on sequence app.cal_cycle_access_log_id_seq to service_role;

-- Rollback (only if asked): drop table app.cal_cycle_access_log;
-- alter table app.cal_cycle_settings drop column share_flow, drop column share_logs,
--   drop column share_notes, drop column share_heads_up, drop column andrew_remind_on,
--   drop column andrew_remind_days;
