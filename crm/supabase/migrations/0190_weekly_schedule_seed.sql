-- Weekly per-day coverage (owner 2026-10-08). staff_schedules rows ARE the
-- schedule: row = working that Mountain-time weekday on business_slug's group,
-- no row = off. Gates access + lead texts (api/_lib/staff-access.js).
-- Alex: Mon Handy Andy, Tue-Thu Dom's. Joe: Sun, Mon, Fri, Sat Dom's.
-- (Applied by hand 2026-10-08.)
set search_path to app, public;
insert into staff_schedules (name,business_slug,day_of_week,start_time,end_time,timezone,phone,priority,updated_at)
  select name,business_slug,3,start_time,end_time,timezone,phone,priority,now() from staff_schedules where name='Alex' and day_of_week=2
  on conflict (name,day_of_week) do nothing;
update staff_schedules set business_slug='handy-andy', updated_at=now() where name='Alex' and day_of_week=1;
insert into staff_schedules (name,business_slug,day_of_week,start_time,end_time,timezone,phone,priority,updated_at)
  select name,business_slug,1,start_time,end_time,timezone,phone,priority,now() from staff_schedules where name='Joe' and day_of_week=0
  on conflict (name,day_of_week) do nothing;
delete from staff_schedules where name='Joe' and day_of_week=3;
