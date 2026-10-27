-- Owner "call this customer back" banners (2026-10-08). Shown to the targeted
-- secretaries + owner until an outbound bridge call (call_attempts) to the
-- phone starts after created_at, or the owner dismisses it.
set search_path to app, public;
create table if not exists callback_requests (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  name text,
  business_slug text,
  booking_id uuid,
  note text,
  targets text[] not null default '{}',
  created_by text,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  done_by text,
  done_how text
);
create index if not exists callback_requests_open on callback_requests (created_at) where done_at is null;
alter table callback_requests enable row level security;
revoke all on callback_requests from anon, authenticated;
grant all on callback_requests to service_role;

insert into callback_requests (phone, name, business_slug, booking_id, note, targets, created_by)
select '5129136645', 'Jeanine Henry', 'atxmountpros', '218d846d-e580-406b-978d-673621df3f82',
  'wants to know if she can move to Sunday if the TV delivery is late', array['Joey','Heather'], 'Owner'
where not exists (select 1 from callback_requests where phone = '5129136645' and done_at is null);

notify pgrst, 'reload schema';
