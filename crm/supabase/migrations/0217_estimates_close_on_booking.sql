-- Owner 2026-10-18: a customer who books is done -- their open estimate leaves
-- Estimates completely (every list, follow-up, badge, count). Trigger covers
-- every booking path (widget, call popup, admin, mirror).
alter table app.estimates add column if not exists booked_booking_id uuid;
alter table app.estimates add column if not exists booked_at timestamptz;

create or replace function app.close_estimates_on_booking() returns trigger
language plpgsql security definer set search_path = app, public as $$
declare p10 text; em text;
begin
  if new.status = 'cancelled' then return new; end if;
  select right(regexp_replace(coalesce(c.phone,''), '\D', '', 'g'), 10), lower(nullif(trim(c.email),''))
    into p10, em from app.customers c where c.id = new.customer_id;
  if coalesce(length(p10),0) < 10 and em is null then return new; end if;
  update app.estimates e set status = 'archived', booked_booking_id = new.id, booked_at = new.created_at
   where e.business_id = new.business_id
     and e.booked_booking_id is null
     and e.status in ('new','contacted','scheduled','archived')
     and e.created_at <= coalesce(new.created_at, now())
     and ((length(p10) = 10 and right(regexp_replace(coalesce(e.customer_phone,''), '\D', '', 'g'), 10) = p10)
          or (em is not null and lower(trim(e.customer_email)) = em));
  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_close_estimates_on_booking on app.bookings;
create trigger trg_close_estimates_on_booking after insert on app.bookings
  for each row execute function app.close_estimates_on_booking();

-- Backfill: open estimates whose customer already booked after the estimate.
with m as (
  select distinct on (e.id) e.id, b.id bid, b.created_at bat
  from app.estimates e
  join app.bookings b on b.business_id = e.business_id and b.status <> 'cancelled' and b.created_at >= e.created_at
  join app.customers c on c.id = b.customer_id
  where e.booked_booking_id is null and e.status in ('new','contacted','scheduled')
    and ((length(right(regexp_replace(coalesce(c.phone,''), '\D', '', 'g'), 10)) = 10
          and right(regexp_replace(coalesce(c.phone,''), '\D', '', 'g'), 10) = right(regexp_replace(coalesce(e.customer_phone,''), '\D', '', 'g'), 10))
      or (nullif(trim(c.email),'') is not null and lower(trim(c.email)) = lower(trim(e.customer_email))))
  order by e.id, b.created_at
)
update app.estimates e set status = 'archived', booked_booking_id = m.bid, booked_at = m.bat from m where e.id = m.id;
