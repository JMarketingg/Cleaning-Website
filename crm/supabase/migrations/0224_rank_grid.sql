-- Local rank grid (owner 2026-10-20): DataForSEO Maps + organic scans on a
-- 5x5 GPS grid per city. Additive only.
create table if not exists app.rank_scans (
  id bigserial primary key,
  run_at timestamptz not null default now(),
  city text not null,
  keyword text not null,
  kind text not null check (kind in ('maps','organic')),
  cost numeric not null default 0,
  status text not null default 'pending',
  points_total int not null default 0,
  points_done int not null default 0,
  dry boolean not null default false
);
create index if not exists rank_scans_city_run on app.rank_scans (city, run_at desc);
alter table app.rank_scans enable row level security;
create table if not exists app.rank_points (
  id bigserial primary key,
  scan_id bigint not null references app.rank_scans(id) on delete cascade,
  idx int not null,
  lat double precision not null,
  lng double precision not null,
  task_id text,
  our_rank jsonb,
  top3 jsonb,
  done_at timestamptz
);
create index if not exists rank_points_scan on app.rank_points (scan_id);
create index if not exists rank_points_open on app.rank_points (task_id) where done_at is null;
alter table app.rank_points enable row level security;
create table if not exists app.rank_settings (
  id int primary key default 1,
  weekly_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table app.rank_settings enable row level security;
insert into app.rank_settings(id) values (1) on conflict do nothing;
grant all on app.rank_scans, app.rank_points, app.rank_settings to service_role;
grant usage, select on all sequences in schema app to service_role;
