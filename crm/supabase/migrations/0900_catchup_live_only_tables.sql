-- Catch-up (2026-10-26): tables that exist in the live database but were created
-- outside these migration files. Run this LAST, after 0001..0239.
-- Generated from the live schema (columns, defaults, primary keys only).

create table if not exists app.ask_knowledge (
  id uuid not null default gen_random_uuid(),
  topic text,
  body text not null,
  source text not null default 'owner'::text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (id)
);
create table if not exists app.ask_questions (
  id uuid not null default gen_random_uuid(),
  asked_by text,
  role text,
  business_slug text,
  question text not null,
  answer text,
  known boolean not null default true,
  draft jsonb,
  created_at timestamp with time zone not null default now(),
  seen_at timestamp with time zone,
  taught_answer text,
  taught_at timestamp with time zone,
  primary key (id)
);
create table if not exists app.backlink_runs (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  targets text[],
  ours text,
  result jsonb,
  primary key (id)
);
create table if not exists app.call_events (
  id uuid not null default gen_random_uuid(),
  call_id uuid,
  business_id uuid,
  actor text,
  event text not null,
  step text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  primary key (id)
);
create table if not exists app.coupons (
  id uuid not null default gen_random_uuid(),
  business_id uuid not null,
  code text not null,
  amount numeric not null default 0,
  active boolean not null default true,
  note text,
  expires_on date,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (id)
);
create table if not exists app.integration_tokens (
  provider text not null,
  value text not null,
  updated_at timestamp with time zone not null default now(),
  primary key (provider)
);
create table if not exists app.markets (
  id uuid not null default gen_random_uuid(),
  slug text not null,
  name text not null,
  parent_business_slug text not null,
  url text,
  settings jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  address text,
  primary key (id)
);
create table if not exists app.schedule_proposals (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  active boolean not null default true,
  title text,
  people text[] not null,
  options jsonb not null,
  primary key (id)
);
create table if not exists app.schedule_votes (
  proposal_id uuid not null,
  name text not null,
  choice text,
  agreed boolean not null default false,
  note text,
  voted_at timestamp with time zone not null default now(),
  primary key (proposal_id, name)
);
create table if not exists app.secretary_schedule_changes (
  id uuid not null default gen_random_uuid(),
  business_id uuid not null,
  changed_by text,
  kind text not null,
  day_of_week integer,
  exception_date date,
  is_available boolean not null,
  previous_available boolean,
  seen_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  primary key (id)
);
create table if not exists app.tech_sms_log (
  id uuid not null default gen_random_uuid(),
  booking_id uuid,
  technician_id uuid,
  business_id uuid,
  kind text not null default 'assigned'::text,
  status text not null default 'pending'::text,
  skip_reason text,
  error text,
  to_phone text,
  sent_at timestamp with time zone not null default now(),
  delivered_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  confirmed_at timestamp with time zone,
  reply_body text,
  primary key (id)
);
create table if not exists app.widget_prices (
  id uuid not null default gen_random_uuid(),
  business_id uuid not null,
  city_key text not null,
  section_key text not null,
  option_id text not null,
  label text not null,
  price numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  row_key text,
  primary key (id)
);
create table if not exists app.wire_plate_ignored_orders (
  amazon_order_num text not null,
  ignored_at timestamp with time zone not null default now(),
  primary key (amazon_order_num)
);
