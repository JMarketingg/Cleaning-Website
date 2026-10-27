-- Private calendar (owner 2026-10-07): Andrew + Jiyah only. Tasks (hourly,
-- drag to reschedule), trips/locations, Jiyah's period days, custom trackers.
-- Server gate: api/_lib/calendar.js (owner role or auditor token only).
set search_path = app, public;
create table if not exists cal_tasks (
  id         uuid primary key default gen_random_uuid(),
  day        date not null,
  start_min  int check (start_min between 0 and 1439),
  dur_min    int not null default 60 check (dur_min between 15 and 1440),
  title      text not null,
  who        text not null default 'both' check (who in ('andrew','jiyah','both')),
  done       boolean not null default false,
  note       text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cal_tasks_day on cal_tasks(day);
create table if not exists cal_trips (
  id         uuid primary key default gen_random_uuid(),
  who        text not null check (who in ('andrew','jiyah')),
  place      text not null,
  start_day  date not null,
  end_day    date not null,
  created_at timestamptz not null default now(),
  check (end_day >= start_day)
);
create table if not exists cal_period_days (
  day        date primary key,
  created_at timestamptz not null default now()
);
create table if not exists cal_trackers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  icon       text not null default '*',
  color      text not null default '#6366f1',
  created_at timestamptz not null default now()
);
create table if not exists cal_tracker_logs (
  tracker_id uuid not null references cal_trackers(id) on delete cascade,
  day        date not null,
  primary key (tracker_id, day)
);
alter table cal_tasks enable row level security;
alter table cal_trips enable row level security;
alter table cal_period_days enable row level security;
alter table cal_trackers enable row level security;
alter table cal_tracker_logs enable row level security;
revoke all on cal_tasks, cal_trips, cal_period_days, cal_trackers, cal_tracker_logs from anon, authenticated;
grant all on cal_tasks, cal_trips, cal_period_days, cal_trackers, cal_tracker_logs to service_role;

-- Seed (owner 2026-10-07)
insert into cal_period_days(day) values ('2026-10-05'),('2026-10-06'),('2026-10-07') on conflict do nothing;
insert into cal_tasks(day, title, who, created_by)
  select '2026-10-08', 'Japan visa meeting', 'jiyah', 'owner'
  where not exists (select 1 from cal_tasks where title = 'Japan visa meeting');
