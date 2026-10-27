-- Prospects (owner 2026-10-07): secretaries cold-call businesses for new
-- clients. Profiles + call log + shared scripts. A won prospect links to a
-- customer; that customer's completed bookings earn the winner 10% of the
-- ticket (excl. tax/tip), computed on the fly in weekly payroll.
set search_path = app, public;
create table if not exists prospects (
  id              uuid primary key default gen_random_uuid(),
  business_name   text not null,
  kind            text,
  contact_name    text,
  phone           text,
  phone_digits    text,
  email           text,
  address         text,
  city            text,
  notes           text,
  status          text not null default 'new' check (status in ('new','called','follow_up','proceed','won','not_interested')),
  follow_up_at    timestamptz,
  assigned_to     text,
  push_kind       text check (push_kind in ('customer','commercial')),
  push_note       text,
  push_summary    jsonb,
  pushed_at       timestamptz,
  source_customer_id uuid references customers(id) on delete set null,
  customer_id     uuid references customers(id) on delete set null,
  won_by          text,
  won_at          timestamptz,
  created_by      text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index if not exists prospects_phone on prospects (phone_digits) where deleted_at is null;
create index if not exists prospects_customer on prospects (customer_id) where customer_id is not null;
create table if not exists prospect_calls (
  id           uuid primary key default gen_random_uuid(),
  prospect_id  uuid not null references prospects(id) on delete cascade,
  caller       text not null,
  outcome      text not null check (outcome in ('no_answer','voicemail','follow_up','proceed','not_interested','wrong_number','note')),
  note         text,
  follow_up_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists prospect_calls_p on prospect_calls (prospect_id, created_at);
create table if not exists prospect_ideas (
  id          uuid primary key default gen_random_uuid(),
  author      text not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
alter table prospects enable row level security;
alter table prospect_calls enable row level security;
alter table prospect_ideas enable row level security;
revoke all on prospects, prospect_calls, prospect_ideas from anon, authenticated;
grant all on prospects, prospect_calls, prospect_ideas to service_role;
notify pgrst, 'reload schema';
