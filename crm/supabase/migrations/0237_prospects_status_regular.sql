-- Prospects: 'regular' status for pushed customers who hire us all the time and
-- should not be called (owner 2026-10-23). Callers see no Call button for them.
alter table app.prospects drop constraint if exists prospects_status_check;
alter table app.prospects add constraint prospects_status_check
  check (status in ('new','calling','callback','interested','quote','booked','won','not_interested','dnc','regular'));
