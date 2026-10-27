-- Jiyah's portal: per-reply "Got it" for replies to notes SHE wrote.
-- Separate from reply_seen_at (the owner's Notes-page flag) so the owner
-- opening Notes never clears her banner. A reply edit bumps replied_at,
-- so author_ack_at < replied_at means a new, unacknowledged reply.
alter table app.staff_note_reads add column if not exists author_ack_at timestamptz;
grant all on app.staff_note_reads to service_role;
notify pgrst, 'reload schema';
