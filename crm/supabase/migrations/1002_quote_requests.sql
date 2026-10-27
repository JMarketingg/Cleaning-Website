-- Quote requests sent from the tidyhausph.com quote form (api/quote.js). Server-only.
create table if not exists app.quote_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new','contacted','booked','declined')),
  name text, phone text, area text, service text, place text,
  bedrooms text, bathrooms text, office_size text, frequency text,
  preferred_date date, preferred_time text, building text, notes text,
  channel text, referrer text, visitor_id text, booking_id uuid
);
create index if not exists quote_requests_created on app.quote_requests (created_at desc);
alter table app.quote_requests enable row level security;
grant all on app.quote_requests to service_role;
