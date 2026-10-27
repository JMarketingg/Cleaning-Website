-- Per-secretary business coverage (owner 2026-10-08). NULL = default from
-- api/_lib/staff-access.js SECRETARY_EXTRA_BUSINESSES (the seed), so nothing
-- changes until the owner edits someone on Other -> Secretaries -> Team.
-- Drives dashboard access + lead-alert texts. Home business is always kept.
set search_path to app, public;
alter table staff_users add column if not exists covered_businesses text[];
