-- Jiyah's QA framework redesign (2026-10-13). Additive only: every existing
-- audit keeps its answers/ratings/complaint/notes/flag exactly as saved.
--   call_outcome  what kind of call it was (booked, declined price, follow-up...)
--                 so only the questions that apply are asked and scored.
--   answer_notes  per question: { key: { note, at, src } } -- the auditor's
--                 evidence/explanation, transcript timestamp, and whether the
--                 answer is the AI's suggestion she kept ('ai') or her own ('human').
--   ai_answers    what the AI suggested, kept so a suggestion and a
--                 human-confirmed answer can always be told apart.
--   findings      timestamped issues: [{ at, said, wrong, should }].
-- answers now also allows 'partial' (half credit); old rows never contain it,
-- so no historical score changes.
alter table app.call_audits
  add column if not exists call_outcome text,
  add column if not exists answer_notes jsonb,
  add column if not exists ai_answers jsonb,
  add column if not exists findings jsonb;
