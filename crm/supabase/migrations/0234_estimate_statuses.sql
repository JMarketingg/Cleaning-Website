-- 0234: clear estimate statuses (owner 2026-10-22).
-- unsent, sent, approved, booked, lost, expired, out_of_area.
-- legacy_status keeps the old value; closed_reason says why it was lost.
alter table app.estimates add column if not exists legacy_status text;
alter table app.estimates add column if not exists closed_reason text;
update app.estimates set legacy_status = status where legacy_status is null;

update app.estimates set status = 'booked' where booked_booking_id is not null;
update app.estimates set status = 'approved' where status = 'scheduled';
update app.estimates set status = 'out_of_area' where status = 'declined';
update app.estimates set status = 'sent' where status = 'contacted';
update app.estimates set status = 'unsent' where status = 'new';
update app.estimates set status = 'lost', closed_reason = coalesce(closed_reason, 'Closed') where status = 'closed';
-- archived: never sent -> expired; sent, no approval -> lost (auto, or the staff reason in notes)
update app.estimates set status = 'expired', closed_reason = coalesce(closed_reason, 'Never sent')
 where status = 'archived' and approved_at is null and texted_at is null and emailed_at is null and contacted_at is null;
update app.estimates set status = 'lost',
       closed_reason = coalesce(closed_reason, substring(notes from 'Closed: ([^(\n]+?) \('), 'auto')
 where status = 'archived' and approved_at is null;
update app.estimates set status = 'lost', closed_reason = coalesce(closed_reason, 'Archived after approval')
 where status = 'archived';

alter table app.estimates alter column status set default 'unsent';
-- Old names written by any stale code path are mapped, never rejected, so a
-- lead can't be lost to a status error.
create or replace function app.estimates_normalize_status() returns trigger
language plpgsql as $$
begin
  new.status := case new.status
    when 'new' then 'unsent' when 'contacted' then 'sent'
    when 'scheduled' then case when new.booked_booking_id is not null then 'booked' else 'approved' end
    when 'declined' then 'out_of_area'
    when 'archived' then case when new.booked_booking_id is not null then 'booked'
      when new.texted_at is null and new.emailed_at is null and new.contacted_at is null then 'expired' else 'lost' end
    when 'closed' then 'lost'
    else coalesce(new.status, 'unsent') end;
  return new;
end $$;
drop trigger if exists trg_estimates_normalize_status on app.estimates;
create trigger trg_estimates_normalize_status before insert or update of status on app.estimates
  for each row execute function app.estimates_normalize_status();

-- A booking closes the customer's open estimates as 'booked' (was 'archived', 0217).
create or replace function app.close_estimates_on_booking() returns trigger
language plpgsql security definer set search_path = app, public as $$
declare p10 text; em text;
begin
  if new.status = 'cancelled' then return new; end if;
  select right(regexp_replace(coalesce(c.phone,''), '\D', '', 'g'), 10), lower(nullif(trim(c.email),''))
    into p10, em from app.customers c where c.id = new.customer_id;
  if coalesce(length(p10),0) < 10 and em is null then return new; end if;
  update app.estimates e set status = 'booked', booked_booking_id = new.id, booked_at = new.created_at
   where e.business_id = new.business_id
     and e.booked_booking_id is null
     and e.deleted_at is null
     and e.status in ('unsent','sent','approved','lost','expired')
     and e.created_at <= coalesce(new.created_at, now())
     and ((length(p10) = 10 and right(regexp_replace(coalesce(e.customer_phone,''), '\D', '', 'g'), 10) = p10)
          or (em is not null and lower(trim(e.customer_email)) = em));
  return new;
exception when others then return new;
end $$;
