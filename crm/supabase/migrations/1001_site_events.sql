-- Website analytics for tidyhausph.com (api/log-event.js). Server-only: RLS on, no policies.
create table if not exists app.site_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  session_id text not null,
  visitor_id text,
  event text not null,
  path text, title text, label text,
  referrer text, source text,
  utm_source text, utm_medium text, utm_campaign text,
  device text, browser text, country text, city text, timezone text, screen text,
  duration_ms integer, scroll_pct smallint
);
create index if not exists site_events_created on app.site_events (created_at);
alter table app.site_events enable row level security;
grant all on app.site_events to service_role;
grant usage, select on sequence app.site_events_id_seq to service_role;
