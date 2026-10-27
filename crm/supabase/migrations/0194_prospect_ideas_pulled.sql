-- Prospects "Got an idea?" box (owner 2026-10-09): owner marks an idea Pulled.
alter table app.prospect_ideas add column if not exists pulled_at timestamptz;
