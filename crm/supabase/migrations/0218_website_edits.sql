-- Joey's "Website edit" requests (owner 2026-10-18). Never shown in the
-- owner's portal; Claude reads them via SQL when the owner says "Joey has edits".
create table if not exists app.website_edits (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  body text not null,
  photo_urls text[] not null default '{}',
  created_by text not null,
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','done')),
  reply text,
  replied_by text,
  replied_at timestamptz,
  done_at timestamptz,
  deleted_at timestamptz
);
create index if not exists website_edits_open_idx on app.website_edits (status, created_at) where deleted_at is null;
alter table app.website_edits enable row level security;
grant all on app.website_edits to service_role;
