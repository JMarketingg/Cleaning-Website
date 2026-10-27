-- ============================================================================
-- Migration 0201: bracket_inventory direct-write AUDIT trigger
-- ----------------------------------------------------------------------------
-- 0088 made bracket_move() the intended sole writer of flat/tilting/full_motion.
-- This logs (does NOT reject) any write to those three columns that bypasses
-- it, so a stray raw-SQL fix or forgotten code path shows up in
-- bracket_direct_writes instead of silently drifting. Audit mode only; flip to
-- a raise once this table stays empty. Changes no counts.
-- bracket_move() is redefined only to set a transaction-local flag around its
-- own update; logic is otherwise identical to the live definition (0088 + home-business fix).
-- ============================================================================
set search_path = app, public, extensions;

create table if not exists bracket_direct_writes (
  id bigserial primary key,
  op text not null,
  business_id uuid, technician_id uuid,
  old_flat int, old_tilting int, old_full_motion int,
  new_flat int, new_tilting int, new_full_motion int,
  db_user text default current_user,
  app_name text default current_setting('application_name', true),
  created_at timestamptz not null default now()
);
alter table bracket_direct_writes enable row level security;
alter table bracket_direct_writes force row level security;
grant all on bracket_direct_writes to service_role;
grant usage, select on sequence bracket_direct_writes_id_seq to service_role;

create or replace function bracket_move(
  p_business_id     uuid,
  p_technician_id    uuid,
  p_kind            text,
  p_flat            integer,
  p_tilting         integer,
  p_full_motion     integer,
  p_idempotency_key text,
  p_booking_id      uuid default null,
  p_purchase_id     uuid default null,
  p_order_num       text default null,
  p_reason          text default null,
  p_actor           text default null
) returns bracket_moves
language plpgsql
security definer
set search_path = app, public, extensions
as $$
declare
  v_existing   bracket_moves;
  v_inv        bracket_inventory;
  v_flat_delta integer;
  v_tilt_delta integer;
  v_fm_delta   integer;
  v_clamp_flat integer := 0;
  v_clamp_tilt integer := 0;
  v_clamp_fm   integer := 0;
  v_row        bracket_moves;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'bracket_move: idempotency_key is required';
  end if;
  if p_kind not in ('opening','delivery','delivery_reversal','job_use','job_reversal','adjust','recount') then
    raise exception 'bracket_move: invalid kind %', p_kind;
  end if;
  if p_kind in ('adjust','recount') and (p_reason is null or length(trim(p_reason)) = 0) then
    raise exception 'bracket_move: reason is required for kind=%', p_kind;
  end if;

  -- Idempotent replay: same event, already recorded -- return it, change nothing.
  select * into v_existing from bracket_moves where idempotency_key = p_idempotency_key;
  if found then
    return v_existing;
  end if;

  -- Stock lives on the tech's HOME business row (as in the live definition).
  p_business_id := coalesce((select business_id from technicians where id = p_technician_id), p_business_id);

  -- Lock (or create) the tech's row so concurrent movers serialize instead of
  -- racing a read-modify-write (the "counter lost update" finding).
  select * into v_inv from bracket_inventory
    where business_id = p_business_id and technician_id = p_technician_id
    for update;
  if not found then
    insert into bracket_inventory (business_id, technician_id, flat_qty, tilting_qty, full_motion_qty)
      values (p_business_id, p_technician_id, 0, 0, 0)
      returning * into v_inv;
  end if;

  if p_kind = 'recount' then
    v_flat_delta := coalesce(p_flat, v_inv.flat_qty)        - v_inv.flat_qty;
    v_tilt_delta := coalesce(p_tilting, v_inv.tilting_qty)  - v_inv.tilting_qty;
    v_fm_delta   := coalesce(p_full_motion, v_inv.full_motion_qty) - v_inv.full_motion_qty;
  else
    v_flat_delta := coalesce(p_flat, 0);
    v_tilt_delta := coalesce(p_tilting, 0);
    v_fm_delta   := coalesce(p_full_motion, 0);
  end if;

  -- Clamp at zero (never go negative), but record what was clamped away --
  -- that's the drift-compounding-invisibly bug (TK, 2026-08-21) closed for good.
  if v_inv.flat_qty + v_flat_delta < 0 then
    v_clamp_flat := -(v_inv.flat_qty + v_flat_delta);
    v_flat_delta := -v_inv.flat_qty;
  end if;
  if v_inv.tilting_qty + v_tilt_delta < 0 then
    v_clamp_tilt := -(v_inv.tilting_qty + v_tilt_delta);
    v_tilt_delta := -v_inv.tilting_qty;
  end if;
  if v_inv.full_motion_qty + v_fm_delta < 0 then
    v_clamp_fm := -(v_inv.full_motion_qty + v_fm_delta);
    v_fm_delta := -v_inv.full_motion_qty;
  end if;

  perform set_config('app.via_bracket_move', '1', true);
  update bracket_inventory set
    flat_qty        = flat_qty        + v_flat_delta,
    tilting_qty     = tilting_qty     + v_tilt_delta,
    full_motion_qty = full_motion_qty + v_fm_delta,
    updated_at = now()
  where id = v_inv.id;
  perform set_config('app.via_bracket_move', '', true);

  insert into bracket_moves (
    business_id, technician_id, kind, flat_delta, tilting_delta, full_motion_delta,
    clamped_flat, clamped_tilting, clamped_full_motion,
    booking_id, purchase_id, order_num, idempotency_key, reason, actor
  ) values (
    p_business_id, p_technician_id, p_kind, v_flat_delta, v_tilt_delta, v_fm_delta,
    v_clamp_flat, v_clamp_tilt, v_clamp_fm,
    p_booking_id, p_purchase_id, p_order_num, p_idempotency_key, p_reason, p_actor
  ) returning * into v_row;

  return v_row;
exception
  when unique_violation then
    -- Concurrent caller won the race to insert the same idempotency_key first.
    select * into v_row from bracket_moves where idempotency_key = p_idempotency_key;
    return v_row;
end;
$$;

create or replace function bracket_inventory_audit_direct_write()
returns trigger language plpgsql security definer
set search_path = app, public, extensions as $$
begin
  if coalesce(current_setting('app.via_bracket_move', true), '') = '1' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if coalesce(new.flat_qty,0) = 0 and coalesce(new.tilting_qty,0) = 0 and coalesce(new.full_motion_qty,0) = 0 then
      return new;  -- empty row creation (wire-plate/appletv helpers) moves nothing
    end if;
    insert into bracket_direct_writes(op, business_id, technician_id, new_flat, new_tilting, new_full_motion)
      values ('INSERT', new.business_id, new.technician_id, new.flat_qty, new.tilting_qty, new.full_motion_qty);
  elsif (new.flat_qty, new.tilting_qty, new.full_motion_qty) is distinct from (old.flat_qty, old.tilting_qty, old.full_motion_qty) then
    insert into bracket_direct_writes(op, business_id, technician_id, old_flat, old_tilting, old_full_motion, new_flat, new_tilting, new_full_motion)
      values ('UPDATE', new.business_id, new.technician_id, old.flat_qty, old.tilting_qty, old.full_motion_qty, new.flat_qty, new.tilting_qty, new.full_motion_qty);
  end if;
  return new;  -- audit mode: never reject
end $$;

drop trigger if exists trg_bracket_inventory_audit_direct on bracket_inventory;
create trigger trg_bracket_inventory_audit_direct
  after insert or update of flat_qty, tilting_qty, full_motion_qty on bracket_inventory
  for each row execute function bracket_inventory_audit_direct_write();
