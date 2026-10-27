-- Calendar task times carry their zone (owner 2026-10-07): day/start_min are
-- wall-clock in tz; the UI shows them in the viewer's zone (Andrew Bangkok,
-- Jiyah Manila). Seed: Japan visa meeting 12:00 PM Manila.
set search_path = app, public;
alter table cal_tasks add column if not exists tz text not null default 'Asia/Bangkok' check (tz in ('Asia/Bangkok','Asia/Manila'));
update cal_tasks set start_min = 720, tz = 'Asia/Manila' where title = 'Japan visa meeting' and day = '2026-10-08';
