-- Jiyah's QA audit redesign (owner-approved 2026-10-13).
-- 1) Conflict check: every save bumps version; a stale version is refused (409).
alter table app.call_audits add column if not exists version integer not null default 1;
-- 2) Server-side drafts: one row per call, deleted when the audit is saved.
create table if not exists app.audit_drafts (
  call_id uuid primary key,
  body jsonb not null,
  saved_by text,
  updated_at timestamptz not null default now()
);
alter table app.audit_drafts enable row level security;
-- 3) QA settings: one row. Labels and drop threshold; checklist = per-question list of call types it applies to (null = built-in rule).
create table if not exists app.audit_settings (
  id smallint primary key default 1 check (id = 1),
  label_excellent numeric not null default 95,
  label_good numeric not null default 85,
  label_needs numeric not null default 70,
  drop_threshold numeric not null default 5,
  checklist jsonb,
  updated_at timestamptz not null default now()
);
alter table app.audit_settings enable row level security;
insert into app.audit_settings (id) values (1) on conflict (id) do nothing;
