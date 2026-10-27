-- Jiyah's Notes redesign (owner OK 2026-10-17). Additive only.
-- Rollback: drop table app.staff_note_replies; alter table app.staff_notes drop column author_pinned_at;
-- Legacy one-reply-per-reader data in staff_note_reads is untouched.
alter table app.staff_notes add column if not exists author_pinned_at timestamptz;
create table if not exists app.staff_note_replies (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references app.staff_notes(id) on delete cascade,
  author text not null,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  author_ack_at timestamptz
);
create index if not exists staff_note_replies_note_idx on app.staff_note_replies(note_id, created_at);
grant all on app.staff_note_replies to service_role;
grant all on app.staff_notes to service_role;
notify pgrst, 'reload schema';
