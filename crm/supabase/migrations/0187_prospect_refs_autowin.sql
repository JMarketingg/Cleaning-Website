-- Prospects v3 (owner 2026-10-08): reference clients (a line the caller can
-- say: "we work for Belmont Village..."), Senior living type, ZIP/state for
-- proper time zones, auto-Won switch (owner unwin turns it off per prospect).
set search_path = app, public;

alter table prospects
  add column if not exists zip text,
  add column if not exists state text,
  add column if not exists auto_link_off boolean not null default false;

create table if not exists prospect_refs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  kind       text,
  city       text,
  line       text not null,
  lat        double precision,
  lng        double precision,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table prospect_refs enable row level security;
revoke all on prospect_refs from anon, authenticated;
grant all on prospect_refs to service_role;

insert into prospect_refs (name, kind, city, line, lat, lng)
select 'Belmont Village Senior Living West University', 'Senior living', 'Houston',
  'We currently work for Belmont Village Senior Living in West University and we''re looking for more communities like them.',
  29.7057, -95.4233
where not exists (select 1 from prospect_refs where name ilike 'Belmont Village%');

update prospects set kind = 'Senior living'
 where kind ~* '(nursing|assisted|senior|memory care|retirement)';

notify pgrst, 'reload schema';
