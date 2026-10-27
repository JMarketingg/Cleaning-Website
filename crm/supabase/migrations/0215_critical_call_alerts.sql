-- Critical call alarm (owner 2026-10-17): an existing customer (has a past job)
-- calls/leaves a voicemail about damage, safety or a complaint. In-app only.
create table if not exists app.critical_alerts (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null unique references app.calls(id) on delete cascade,
  caller_phone text,
  business_id uuid,
  booking_id uuid,
  technician_id uuid,
  customer_name text,
  reason text,
  excerpt text,
  created_at timestamptz not null default now(),
  handled_by text,
  handled_at timestamptz
);
create index if not exists critical_alerts_open on app.critical_alerts (created_at desc) where handled_at is null;
alter table app.critical_alerts enable row level security;

create or replace function app.critical_call_check(p_call uuid) returns void
language plpgsql security definer set search_path = app, public as $$
declare c record; t text; m text; b record; ph text;
begin
  select * into c from app.calls where id = p_call;
  if c is null or c.transcript is null or c.caller_phone is null then return; end if;
  ph := right(regexp_replace(c.caller_phone, '[^0-9]', '', 'g'), 10);
  if length(ph) < 10 then return; end if;
  -- Customer side only when the transcript is labelled (voicemails are not).
  t := c.transcript;
  if t ~ '(^|\n)Customer:' then
    select string_agg(l, ' ') into t from regexp_split_to_table(c.transcript, '\n') l where l like 'Customer:%';
  end if;
  t := lower(coalesce(t, ''));
  m := substring(t from '(fall(ing|en)? (off|down)|fell (off|down)|coming (off|out|down|loose|apart)|came (off|out|down|loose)|pulling (off|out|away)|pulled (off|out|away)|ripp(ed|ing) out|is loose|tv.{0,20}loose|wobbl[a-z]*|sagg?ing|leaning|crooked|not level|damag[a-z]*|broke[a-z]*|crack(ed|s)?|scratch(ed|es)?|dent(ed)?|leak[a-z]*|left (a |big )?holes?|big holes?|refund|money back|chargeback|angry|upset|furious|complain[a-z]*|unhappy|not happy|disappointed|terrible|horrible|unacceptable|lawyer|sue you|dangerous|unsafe|sparks?|electrocut[a-z]*|burning smell)');
  if m is null then return; end if;
  select bk.id, bk.technician_id, bk.business_id, cu.name into b
    from app.bookings bk join app.customers cu on cu.id = bk.customer_id
   where right(regexp_replace(cu.phone, '[^0-9]', '', 'g'), 10) = ph
     and bk.status <> 'cancelled' and bk.scheduled_at < c.occurred_at
   order by bk.scheduled_at desc limit 1;
  if b.id is null then return; end if;
  insert into app.critical_alerts (call_id, caller_phone, business_id, booking_id, technician_id, customer_name, reason, excerpt, created_at)
  values (c.id, ph, coalesce(b.business_id, c.business_id), b.id, b.technician_id, b.name, m, left(c.transcript, 400), c.occurred_at)
  on conflict (call_id) do nothing;
end $$;

create or replace function app.critical_call_trg() returns trigger
language plpgsql security definer set search_path = app, public as $$
begin
  if new.transcript is not null and (tg_op = 'INSERT' or new.transcript is distinct from old.transcript) then
    begin perform app.critical_call_check(new.id); exception when others then null; end;
  end if;
  return new;
end $$;
drop trigger if exists critical_call_trg on app.calls;
create trigger critical_call_trg after insert or update of transcript on app.calls
  for each row execute function app.critical_call_trg();

-- Backfill the last 30 days (catches (720) 429-4747, Oct 16).
do $$ declare r record; begin
  for r in select id from app.calls where transcript is not null and occurred_at > now() - interval '30 days' loop
    perform app.critical_call_check(r.id);
  end loop;
end $$;
