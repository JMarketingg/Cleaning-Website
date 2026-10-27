-- Calendar v2 (Jiyah's request 2026-10-09). Purely additive; no existing row touched.
-- Events stay in cal_tasks (category/location/color/reminder/recurrence/multi-day added).
-- Separate task list with checklists = cal_todos. Per-person settings = cal_prefs.
set search_path = app, public;
alter table cal_tasks add column if not exists category text not null default 'appointment' check (category in ('appointment','reminder','birthday','custom'));
alter table cal_tasks add column if not exists end_day date;
alter table cal_tasks add column if not exists location text;
alter table cal_tasks add column if not exists color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$');
alter table cal_tasks add column if not exists remind_min int check (remind_min is null or remind_min between 0 and 20160);
alter table cal_tasks add column if not exists rrule jsonb;
alter table cal_tasks add column if not exists exdates date[] not null default '{}';
alter table cal_tasks add column if not exists series_id uuid references cal_tasks(id) on delete set null;
alter table cal_trips add column if not exists note text;
create table if not exists cal_todos (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  who        text not null default 'both' check (who in ('andrew','jiyah','both')),
  due_day    date,
  due_min    int check (due_min between 0 and 1439),
  tz         text not null default 'Asia/Bangkok' check (tz in ('Asia/Bangkok','Asia/Manila')),
  done       boolean not null default false,
  note       text,
  items      jsonb not null default '[]'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cal_todos_due on cal_todos(due_day);
create table if not exists cal_prefs (
  who        text primary key check (who in ('andrew','jiyah')),
  prefs      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table cal_todos enable row level security;
alter table cal_prefs enable row level security;
revoke all on cal_todos, cal_prefs from anon, authenticated;
grant all on cal_todos, cal_prefs to service_role;
