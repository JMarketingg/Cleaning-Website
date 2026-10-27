-- "Red alert" notes (owner 2026-10-09). An owner-made, red, sticky banner
-- with a step checklist for one business's secretaries. Shared progress: the
-- FIRST person to mark a step done wins (red_alert_step() locks the row) and
-- everyone else sees "✓ Joe · 7:42 PM". A step with needs_prev unlocks only
-- after the step right before it. Shown to the targeted secretaries + owner
-- until every step is done, then as a small "✓ Done" line for the rest of
-- that day (in the alert's tz). The owner can edit or close it any time.
-- API: api/_lib/red-alerts.js (action red_alerts). A step's Call button goes
-- through call_start source 'red_alert' -- the number is read from this row.
-- Additive only: one new table + one function. Nothing is seeded here (see
-- the commented block at the bottom / supabase/seeds/red_alert_jarred.sql).
set search_path to app, public;

create table if not exists red_alerts (
  id uuid primary key default gen_random_uuid(),
  business_slug text not null,
  title text not null,
  body text,
  targets text[] not null default '{}',        -- staff names; empty = everyone covering business_slug
  steps jsonb not null default '[]'::jsonb,    -- [{id, text, phone, due_at, needs_prev, done_by, done_at}]
  info text[] not null default '{}',           -- read-only lines (no checkbox)
  tz text not null default 'America/Denver',   -- due-by times + "rest of the day" are judged here
  rev integer not null default 0,              -- bumped on every write (owner edits merge on it)
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by text,
  constraint red_alerts_steps_is_array check (jsonb_typeof(steps) = 'array')
);
create index if not exists red_alerts_open on red_alerts (created_at) where closed_at is null;
alter table red_alerts enable row level security;
revoke all on red_alerts from anon, authenticated;
grant all on red_alerts to service_role;

-- Mark (p_done) or un-mark one step, atomically. First marker wins: a second
-- "Mark done" gets reason 'already' + who did it. Undo: only whoever marked
-- it, or the owner.
create or replace function red_alert_step(p_alert uuid, p_step text, p_by text, p_done boolean, p_owner boolean)
returns jsonb
language plpgsql
set search_path = app, public
as $$
declare
  v_steps jsonb; v_closed timestamptz; v_idx integer; v_s jsonb; v_prev jsonb;
begin
  select steps, closed_at into v_steps, v_closed from red_alerts where id = p_alert for update;
  if not found or v_closed is not null then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;
  select (t.ord - 1)::integer, t.elem into v_idx, v_s
    from jsonb_array_elements(v_steps) with ordinality as t(elem, ord)
    where t.elem->>'id' = p_step limit 1;
  if v_idx is null then
    return jsonb_build_object('ok', false, 'reason', 'no_step');
  end if;
  if p_done then
    if coalesce(v_s->>'done_by', '') <> '' then
      return jsonb_build_object('ok', false, 'reason', 'already', 'done_by', v_s->>'done_by', 'done_at', v_s->>'done_at');
    end if;
    if coalesce((v_s->>'needs_prev')::boolean, false) and v_idx > 0 then
      v_prev := v_steps -> (v_idx - 1);
      if coalesce(v_prev->>'done_by', '') = '' then
        return jsonb_build_object('ok', false, 'reason', 'locked');
      end if;
    end if;
    v_s := v_s || jsonb_build_object('done_by', p_by, 'done_at', to_jsonb(now()));
  else
    if coalesce(v_s->>'done_by', '') = '' then
      return jsonb_build_object('ok', true, 'reason', 'not_done');
    end if;
    if not coalesce(p_owner, false) and lower(v_s->>'done_by') <> lower(coalesce(p_by, '')) then
      return jsonb_build_object('ok', false, 'reason', 'not_yours', 'done_by', v_s->>'done_by');
    end if;
    v_s := v_s || jsonb_build_object('done_by', null, 'done_at', null);
  end if;
  update red_alerts
     set steps = jsonb_set(steps, array[v_idx::text], v_s), rev = rev + 1, updated_at = now()
   where id = p_alert;
  return jsonb_build_object('ok', true, 'done_by', v_s->>'done_by', 'done_at', v_s->>'done_at');
end;
$$;
revoke all on function red_alert_step(uuid, text, text, boolean, boolean) from public, anon, authenticated;
grant execute on function red_alert_step(uuid, text, text, boolean, boolean) to service_role;

notify pgrst, 'reload schema';

-- ── First alert (NOT applied -- owner reviews first). Same SQL as
-- supabase/seeds/red_alert_jarred.sql; run that file to post it. ───────────
-- insert into app.red_alerts (business_slug, title, body, targets, steps, info, tz, created_by)
-- select 'doms',
--   '🚨 Jarred Davis — confirm tomorrow''s job',
--   'Jarred Davis spoke with Andrew about his appointment tomorrow (Fri Oct 9, 2–4 PM, Oklahoma City, 3016 Hunter Crest Dr). Andrew reassured him we''ll be there. Jarred asked us to CALL him in the morning, BEFORE the appointment, to confirm Miguel is coming.',
--   array['Joey', 'Alex', 'Joe'],
--   '[
--     {"id": "s1", "text": "Call Miguel NOW — make sure he''ll be at Jarred''s job tomorrow 2–4 PM.", "phone": "4055354020", "due_at": null, "needs_prev": false, "done_by": null, "done_at": null},
--     {"id": "s2", "text": "Call Jarred — reassure him Miguel will be there.", "phone": "5802849986", "due_at": null, "needs_prev": true, "done_by": null, "done_at": null},
--     {"id": "s3", "text": "Tomorrow morning, before 2 PM Central: call Jarred to confirm Miguel is on his way.", "phone": "5802849986", "due_at": "2026-10-09T18:00:00Z", "needs_prev": true, "done_by": null, "done_at": null}
--   ]'::jsonb,
--   array[
--     'Jarred texted ''Cancel'' — texts to him are blocked. Call only. He won''t get the on-the-way text, so text/call Miguel manually to keep things moving.',
--     'Watch Miguel''s jobs closely today (he is "Megale fails" in the CRM).'
--   ],
--   'America/Chicago', 'Andrew'
-- where not exists (select 1 from app.red_alerts where title like '%Jarred Davis%' and closed_at is null);
