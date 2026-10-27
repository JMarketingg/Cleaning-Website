-- 0214: Jiyah's cycle tracker (Calendar > Cycle tab). Server-only (service_role); RLS on, no policies.
-- Actual periods stay separate from predictions. Legacy app.cal_period_days is kept untouched.
create table if not exists app.cal_periods (
  id uuid primary key default gen_random_uuid(),
  start_day date not null unique,
  end_day date,                      -- null = still ongoing
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cal_periods_end_ok check (end_day is null or end_day >= start_day)
);
create table if not exists app.cal_cycle_days (
  day date primary key,
  flow text check (flow in ('spotting','light','medium','heavy')),
  moods text[] not null default '{}',
  symptoms jsonb not null default '{}'::jsonb,   -- {"cramps":1..3}
  note text,                                      -- private, never shared
  updated_at timestamptz not null default now()
);
create table if not exists app.cal_cycle_preds (   -- prediction history: auto snapshots + manual edits
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('auto','manual')),
  start_day date not null,
  end_day date not null,
  auto_start date,
  auto_end date,
  actual_start date,                 -- filled when a real period arrives
  active boolean not null default false,
  created_at timestamptz not null default now(),
  cleared_at timestamptz
);
create index if not exists cal_cycle_preds_active on app.cal_cycle_preds (active, created_at desc);
create table if not exists app.cal_cycle_settings (
  id int primary key default 1 check (id = 1),
  share_dots boolean not null default true,       -- Jiyah 10/16: dots stay visible to Andrew
  share_next boolean not null default false,
  share_started boolean not null default false,
  share_mood boolean not null default false,
  share_symptoms boolean not null default false,
  heads_up text,
  remind_on boolean not null default false,
  remind_days int not null default 2 check (remind_days between 0 and 14),
  updated_at timestamptz not null default now()
);
insert into app.cal_cycle_settings (id) values (1) on conflict do nothing;
-- copy legacy day list into period runs (consecutive days = one period)
insert into app.cal_periods (start_day, end_day)
select min(day), max(day) from (
  select day, day - (row_number() over (order by day))::int as grp from app.cal_period_days
) s group by grp
on conflict (start_day) do nothing;
do $$ declare t text; begin
  foreach t in array array['cal_periods','cal_cycle_days','cal_cycle_preds','cal_cycle_settings'] loop
    execute format('alter table app.%I enable row level security', t);
    execute format('revoke all on app.%I from anon, authenticated', t);
    execute format('grant all on app.%I to service_role', t);
  end loop; end $$;
notify pgrst, 'reload schema';
