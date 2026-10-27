-- Prospects v2 (owner 2026-10-08): cold-calling as Handy Andy.
-- 30-day lock per business, dedupe, customer block, park after 5 dead tries,
-- 90-day not-interested snooze, do-not-call, call-hours by local time zone,
-- quick-help talking points (owner-editable), quotes linked to a prospect
-- (> $2,000 waits for the owner), bridge-call attempts tied to a prospect.
set search_path = app, public;

alter table prospects drop constraint if exists prospects_status_check;
alter table prospects add constraint prospects_status_check check (status in
  ('new','calling','callback','interested','quote','booked','won','not_interested','dnc'));
alter table prospects alter column status set default 'new';
alter table prospects
  add column if not exists name_norm text,
  add column if not exists addr_norm text,
  add column if not exists tz text,
  add column if not exists locked_by text,
  add column if not exists locked_at timestamptz,
  add column if not exists last_activity_at timestamptz,
  add column if not exists dead_streak int not null default 0,
  add column if not exists parked_at timestamptz,
  add column if not exists snooze_until timestamptz,
  add column if not exists is_customer boolean not null default false,
  add column if not exists quote_estimate_id uuid,
  add column if not exists quote_total numeric,
  add column if not exists quote_status text check (quote_status in ('needs_ok','approved','sent'));
create index if not exists prospects_name_norm on prospects (name_norm) where deleted_at is null;
create index if not exists prospects_quote on prospects (quote_estimate_id) where quote_estimate_id is not null;

alter table prospect_calls drop constraint if exists prospect_calls_outcome_check;
alter table prospect_calls add constraint prospect_calls_outcome_check check (outcome in
  ('no_answer','voicemail','gatekeeper','call_back','interested','quote','booked','not_interested','dnc','note','claim',
   'follow_up','proceed','wrong_number'));
alter table prospect_calls add column if not exists attempt_id uuid;

alter table call_attempts add column if not exists prospect_id uuid;
create index if not exists call_attempts_prospect on call_attempts (prospect_id) where prospect_id is not null;

create table if not exists prospect_tips (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  sort       int not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table if not exists prospect_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table prospect_tips enable row level security;
alter table prospect_settings enable row level security;
revoke all on prospect_tips, prospect_settings from anon, authenticated;
grant all on prospect_tips, prospect_settings to service_role;

insert into prospect_settings (key, value) values ('access', '{"enabled": false}'), ('focus', '{}')
  on conflict (key) do nothing;
insert into prospect_tips (title, body, sort)
select * from (values
  ('Pitch', 'We make it extremely easy. Book online in a minute, we show up and get it done.', 1),
  ('Online booking', 'Book online any time: pick the TVs, pick a time, done.', 2),
  ('Same-day', 'Same-day and next-day slots most days.', 3),
  ('Upfront prices', 'Price is shown before you book. No surprises.', 4),
  ('Lifetime warranty', 'Lifetime warranty on every mount we install.', 5),
  ('Insured', 'Fully insured. Certificate on request.', 6),
  ('Invoices', 'We invoice businesses. Card or invoice.', 7),
  ('Multi-TV', 'Lobbies, rooms, whole buildings: we handle multi-TV jobs.', 8),
  ('After hours', 'We can come after hours or weekends so we don''t disturb you.', 9)
) v(title, body, sort)
where not exists (select 1 from prospect_tips);

notify pgrst, 'reload schema';
