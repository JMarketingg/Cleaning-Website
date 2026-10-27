-- One-off, date-specific overrides of the weekly staff_schedules (owner 2026-10-09:
-- Joe no-show, Alex covers Dom's). business_slug NULL = OFF that date; a slug =
-- works that group that date (phone/priority used for call routing). Expires by
-- date automatically (only today's row is ever read). Weekly rows untouched.
-- Off days also drop one STAFF_DAY_RATE_PHP day from Alex/Joe payroll.
create table if not exists app.staff_schedule_exceptions (
  name text not null, on_date date not null, business_slug text, phone text, priority int not null default 9,
  reason text, created_by text, created_at timestamptz not null default now(),
  primary key (name, on_date));
alter table app.staff_schedule_exceptions enable row level security;
insert into app.staff_schedule_exceptions (name,on_date,business_slug,phone,priority,reason,created_by) values
 ('Joe','2026-10-09',null,'+13035782634',2,'No-show 10/9','Owner'),
 ('Alex','2026-10-09','doms','+13032253146',1,'Covering Dom''s for Joe no-show 10/9','Owner')
on conflict (name,on_date) do nothing;
insert into app.secretary_schedule_changes (business_id,changed_by,kind,exception_date,is_available,previous_available)
 select id,'Owner (for Joe): No-show 10/9, 1 day pay removed','exception','2026-10-09',false,true from app.businesses where slug='doms';
insert into app.secretary_schedule_changes (business_id,changed_by,kind,exception_date,is_available,previous_available)
 select id,'Owner (for Alex): covers Dom''s 10/9 for Joe no-show','exception','2026-10-09',true,false from app.businesses where slug='doms';
