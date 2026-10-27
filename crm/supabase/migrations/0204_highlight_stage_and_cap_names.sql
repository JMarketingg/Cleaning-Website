-- ============================================================================
-- Migration 0204 (applied 2026-10-13 via MCP; recorded here)
--   * pipeline_marks.highlight_stage: the glow ends when the card changes stage
--   * app.cap_name + cap_names triggers: customer names start with a capital
--     (only lowercase first letters change; "McDonald" stays as typed)
-- ============================================================================
set search_path = app, public, extensions;

alter table pipeline_marks add column if not exists highlight_stage text;

create or replace function cap_name(t text) returns text language plpgsql immutable as $$
declare out text := ''; p1 text := ' '; p2 text := ' '; ch text; i int;
begin
  if t is null or position('@' in t) > 0 then return t; end if;
  for i in 1..length(t) loop
    ch := substr(t, i, 1);
    if p1 in (' ', '-', '.') or (p1 = '''' and lower(p2) = 'o') then out := out || upper(ch); else out := out || ch; end if;
    p2 := p1; p1 := ch;
  end loop;
  return out;
end $$;

create or replace function trg_cap_names() returns trigger language plpgsql as $$
begin
  if TG_TABLE_NAME = 'customers' then
    new.name := cap_name(new.name); new.first_name := cap_name(new.first_name); new.last_name := cap_name(new.last_name);
  elsif TG_TABLE_NAME in ('estimates', 'booking_authorizations') then
    new.customer_name := cap_name(new.customer_name);
  elsif TG_TABLE_NAME = 'call_audits' then
    new.caller_name := cap_name(new.caller_name);
  elsif TG_TABLE_NAME = 'callback_requests' then
    new.name := cap_name(new.name);
  end if;
  return new;
end $$;

drop trigger if exists cap_names on customers;
create trigger cap_names before insert or update of name, first_name, last_name on customers for each row execute function trg_cap_names();
drop trigger if exists cap_names on estimates;
create trigger cap_names before insert or update of customer_name on estimates for each row execute function trg_cap_names();
drop trigger if exists cap_names on booking_authorizations;
create trigger cap_names before insert or update of customer_name on booking_authorizations for each row execute function trg_cap_names();
drop trigger if exists cap_names on call_audits;
create trigger cap_names before insert or update of caller_name on call_audits for each row execute function trg_cap_names();
drop trigger if exists cap_names on callback_requests;
create trigger cap_names before insert or update of name on callback_requests for each row execute function trg_cap_names();
