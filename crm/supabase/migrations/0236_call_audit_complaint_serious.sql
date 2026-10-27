-- Jiyah marks a call-audit complaint serious (owner 2026-10-23). Serious
-- complaints show in red on the secretary's My Call Performance.
alter table app.call_audits
  add column if not exists complaint_serious boolean not null default false,
  add column if not exists complaint_serious_by text,
  add column if not exists complaint_serious_at timestamptz;
