-- Jiyah 2026-10-09: plain "Skip" in Start Auditing must persist. Separate from
-- audit_skips (voicemail / not a call), which also removes calls from counts.
-- A queue skip only hides the call from her queue; it is never a grade.
create table if not exists app.audit_queue_skips (
  call_id uuid primary key,
  skipped_by text,
  created_at timestamptz not null default now()
);
alter table app.audit_queue_skips enable row level security;
