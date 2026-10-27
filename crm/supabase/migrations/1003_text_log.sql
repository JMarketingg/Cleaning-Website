-- Every text the CRM sends through Semaphore (api/_lib/semaphore.js). Server-only.
create table if not exists app.text_log (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  booking_id uuid, kind text not null, phone text not null, body text not null,
  status text not null, provider_id text, error text
);
create index if not exists text_log_booking on app.text_log (booking_id, kind);
alter table app.text_log enable row level security;
grant all on app.text_log to service_role;
grant usage, select on sequence app.text_log_id_seq to service_role;
