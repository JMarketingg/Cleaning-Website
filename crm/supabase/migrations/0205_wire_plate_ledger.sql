-- ============================================================================
-- Migration 0205: wire concealment plates join the bracket_moves ledger
-- ----------------------------------------------------------------------------
-- Owner 2026-10-13 "lets fix Wire Concealment Plates inventory". Plates were
-- the last uncoordinated counter: 6 direct read-modify-write helpers, no
-- signed history, consumption guessed from line-item names (the "Wall
-- already has a plug behind the TV" answer deducted a plate on every job
-- until 9e899d2). Same cure as brackets (0088):
--   * bracket_moves gets wire_plate_delta / clamped_wire_plate
--   * plate_move() is the one writer of bracket_inventory.wire_plate_qty:
--     ledger row + atomic counter change, keyed by idempotency_key
--   * opening balance = today's counter, so ledger sum == counter from here
--   * plate_drift view; the direct-write audit trigger now watches plates too
-- Changes no counts.
-- ============================================================================
set search_path = app, public, extensions;

alter table bracket_moves add column if not exists wire_plate_delta integer not null default 0;
alter table bracket_moves add column if not exists clamped_wire_plate integer not null default 0;
alter table bracket_moves add column if not exists plate_purchase_id uuid references wire_plate_purchases(id) on delete set null;

alter table bracket_direct_writes add column if not exists old_wire_plate integer;
alter table bracket_direct_writes add column if not exists new_wire_plate integer;

create or replace function plate_move(
  p_business_id       uuid,
  p_technician_id     uuid,
  p_kind              text,
  p_qty               integer,
  p_idempotency_key   text,
  p_booking_id        uuid default null,
  p_plate_purchase_id uuid default null,
  p_order_num         text default null,
  p_reason            text default null,
  p_actor             text default null
) returns bracket_moves
language plpgsql
security definer
set search_path = app, public, extensions
as $$
declare
  v_existing bracket_moves;
  v_inv      bracket_inventory;
  v_delta    integer;
  v_clamp    integer := 0;
  v_row      bracket_moves;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'plate_move: idempotency_key is required';
  end if;
  if p_kind not in ('opening','delivery','delivery_reversal','job_use','job_reversal','adjust','recount') then
    raise exception 'plate_move: invalid kind %', p_kind;
  end if;
  if p_kind in ('adjust','recount') and (p_reason is null or length(trim(p_reason)) = 0) then
    raise exception 'plate_move: reason is required for kind=%', p_kind;
  end if;

  select * into v_existing from bracket_moves where idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  -- Stock lives on the tech's home-business row (same rule as bracket_move).
  p_business_id := coalesce((select business_id from technicians where id = p_technician_id), p_business_id);

  select * into v_inv from bracket_inventory
    where business_id = p_business_id and technician_id = p_technician_id
    for update;
  if not found then
    insert into bracket_inventory (business_id, technician_id, flat_qty, tilting_qty, full_motion_qty, wire_plate_qty)
      values (p_business_id, p_technician_id, 0, 0, 0, 0)
      returning * into v_inv;
  end if;

  if p_kind = 'recount' then
    v_delta := coalesce(p_qty, coalesce(v_inv.wire_plate_qty, 0)) - coalesce(v_inv.wire_plate_qty, 0);
  else
    v_delta := coalesce(p_qty, 0);
  end if;
  if coalesce(v_inv.wire_plate_qty, 0) + v_delta < 0 then
    v_clamp := -(coalesce(v_inv.wire_plate_qty, 0) + v_delta);
    v_delta := -coalesce(v_inv.wire_plate_qty, 0);
  end if;

  perform set_config('app.via_bracket_move', '1', true);
  update bracket_inventory set
    wire_plate_qty = coalesce(wire_plate_qty, 0) + v_delta,
    updated_at = now()
  where id = v_inv.id;
  perform set_config('app.via_bracket_move', '', true);

  insert into bracket_moves (
    business_id, technician_id, kind, wire_plate_delta, clamped_wire_plate,
    booking_id, plate_purchase_id, order_num, idempotency_key, reason, actor
  ) values (
    p_business_id, p_technician_id, p_kind, v_delta, v_clamp,
    p_booking_id, p_plate_purchase_id, p_order_num, p_idempotency_key, p_reason, p_actor
  ) returning * into v_row;

  return v_row;
exception
  when unique_violation then
    select * into v_row from bracket_moves where idempotency_key = p_idempotency_key;
    return v_row;
end;
$$;
revoke all on function plate_move(uuid, uuid, text, integer, text, uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function plate_move(uuid, uuid, text, integer, text, uuid, uuid, text, text, text) to service_role;

-- Audit trigger: plates now count as a guarded column too.
create or replace function bracket_inventory_audit_direct_write() returns trigger
language plpgsql security definer set search_path = app, public, extensions as $$
begin
  if coalesce(current_setting('app.via_bracket_move', true), '') = '1' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if coalesce(new.flat_qty,0) = 0 and coalesce(new.tilting_qty,0) = 0 and coalesce(new.full_motion_qty,0) = 0 and coalesce(new.wire_plate_qty,0) = 0 then
      return new;
    end if;
    insert into bracket_direct_writes(op, business_id, technician_id, new_flat, new_tilting, new_full_motion, new_wire_plate)
      values ('INSERT', new.business_id, new.technician_id, new.flat_qty, new.tilting_qty, new.full_motion_qty, new.wire_plate_qty);
  elsif (new.flat_qty, new.tilting_qty, new.full_motion_qty, new.wire_plate_qty) is distinct from (old.flat_qty, old.tilting_qty, old.full_motion_qty, old.wire_plate_qty) then
    insert into bracket_direct_writes(op, business_id, technician_id, old_flat, old_tilting, old_full_motion, new_flat, new_tilting, new_full_motion, old_wire_plate, new_wire_plate)
      values ('UPDATE', new.business_id, new.technician_id, old.flat_qty, old.tilting_qty, old.full_motion_qty, new.flat_qty, new.tilting_qty, new.full_motion_qty, old.wire_plate_qty, new.wire_plate_qty);
  end if;
  return new;
end $$;
drop trigger if exists trg_bracket_inventory_audit_direct on bracket_inventory;
create trigger trg_bracket_inventory_audit_direct
  after insert or update of flat_qty, tilting_qty, full_motion_qty, wire_plate_qty on bracket_inventory
  for each row execute function bracket_inventory_audit_direct_write();

-- Opening balance: whatever the counter says right now. Ledger only, no
-- counter change, so the sum of wire_plate_delta per row equals the counter.
insert into bracket_moves (business_id, technician_id, kind, wire_plate_delta, idempotency_key, reason, actor)
select bi.business_id, bi.technician_id, 'opening', bi.wire_plate_qty,
       'plate-opening:' || bi.technician_id || ':' || bi.business_id,
       'wire plate opening balance (counter when plates joined the ledger)', 'migration 0205'
from bracket_inventory bi
where coalesce(bi.wire_plate_qty, 0) <> 0
on conflict (idempotency_key) do nothing;

create or replace view plate_drift as
select t.name as technician, bi.business_id, bi.technician_id,
       coalesce(bi.wire_plate_qty, 0) as counter_wire_plate,
       coalesce(m.sum_wp, 0) as ledger_wire_plate,
       coalesce(bi.wire_plate_qty, 0) - coalesce(m.sum_wp, 0) as drift_wire_plate
from bracket_inventory bi
join technicians t on t.id = bi.technician_id
left join (select technician_id, business_id, sum(wire_plate_delta) as sum_wp from bracket_moves group by technician_id, business_id) m
  on m.technician_id = bi.technician_id and m.business_id = bi.business_id
where coalesce(bi.wire_plate_qty, 0) <> coalesce(m.sum_wp, 0);
grant select on plate_drift to service_role;
