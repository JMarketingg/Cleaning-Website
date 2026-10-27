-- 0232: who created an estimate (staff name), so the unsent alarm texts that person.
alter table app.estimates add column if not exists created_by text;
-- Soft delete (step 3 of the estimates overhaul); added here so the unsent filter can read it.
alter table app.estimates add column if not exists deleted_at timestamptz, add column if not exists deleted_reason text, add column if not exists deleted_by text;
