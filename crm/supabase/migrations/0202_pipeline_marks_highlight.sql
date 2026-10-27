-- Glow a pipeline card on the board (owner 2026-10-13).
alter table app.pipeline_marks
  add column if not exists highlight boolean not null default false,
  add column if not exists highlight_by text,
  add column if not exists highlight_at timestamptz;
