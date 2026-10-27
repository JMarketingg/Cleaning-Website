-- 0239 (owner 2026-10-24): bracket purchases
--  1. Canceled/returned order reverses its delivery credit (trigger, any path).
--     Key cancel:<purchase id>, reverses the NET of delivery + delivery_reversal.
--  2. Proof of receipt: stock posts only when the tech (or office) confirms
--     counts via bracket_receive(). Shortfall stored on the purchase.

alter table app.bracket_purchases
  add column if not exists received_at timestamptz,
  add column if not exists received_by text,
  add column if not exists received_flat integer,
  add column if not exists received_tilting integer,
  add column if not exists received_full_motion integer,
  add column if not exists short_flat integer not null default 0,
  add column if not exists short_tilting integer not null default 0,
  add column if not exists short_full_motion integer not null default 0;

-- Everything already assigned was credited the old way (ledger or pre-ledger).
update app.bracket_purchases
   set received_at = coalesce(delivered_date::timestamptz, created_at), received_by = 'legacy'
 where technician_id is not null and received_at is null and status not in ('canceled','returned');

create or replace function app.bracket_reverse_purchase(p_purchase_id uuid, p_actor text, p_reason text)
returns app.bracket_moves language plpgsql security definer
set search_path to 'app','public','extensions' as $$
declare
  v_p bracket_purchases;
  v_f int; v_t int; v_fm int; v_tech uuid;
begin
  select * into v_p from bracket_purchases where id = p_purchase_id;
  if not found then return null; end if;
  select m.technician_id, sum(m.flat_delta), sum(m.tilting_delta), sum(m.full_motion_delta)
    into v_tech, v_f, v_t, v_fm
    from bracket_moves m
   where m.kind in ('delivery','delivery_reversal')
     and (m.purchase_id = v_p.id or (v_p.walmart_order_num is not null and m.order_num = v_p.walmart_order_num))
   group by m.technician_id
   order by sum(m.flat_delta)+sum(m.tilting_delta)+sum(m.full_motion_delta) desc
   limit 1;
  if v_tech is null or (coalesce(v_f,0) <= 0 and coalesce(v_t,0) <= 0 and coalesce(v_fm,0) <= 0) then return null; end if;
  return bracket_move(v_p.business_id, v_tech, 'delivery_reversal',
    -greatest(v_f,0), -greatest(v_t,0), -greatest(v_fm,0),
    'cancel:' || v_p.id::text, null, v_p.id, v_p.walmart_order_num,
    coalesce(p_reason, 'order ' || v_p.status), p_actor);
end $$;

create or replace function app.trg_bracket_purchase_cancel()
returns trigger language plpgsql security definer
set search_path to 'app','public','extensions' as $$
begin
  if new.status in ('canceled','returned') and old.status is distinct from new.status then
    perform bracket_reverse_purchase(new.id, 'system:purchase-' || new.status,
      'Walmart order ' || coalesce(new.walmart_order_num, new.id::text) || ' ' || new.status);
  end if;
  return new;
end $$;

drop trigger if exists trg_bracket_purchase_cancel on app.bracket_purchases;
create trigger trg_bracket_purchase_cancel after update of status on app.bracket_purchases
  for each row execute function app.trg_bracket_purchase_cancel();

create or replace function app.bracket_receive(p_purchase_id uuid, p_flat int, p_tilting int, p_full_motion int, p_actor text)
returns app.bracket_purchases language plpgsql security definer
set search_path to 'app','public','extensions' as $$
declare
  v_p bracket_purchases; v_f int; v_t int; v_fm int; v_key text; v_skip boolean;
begin
  select * into v_p from bracket_purchases where id = p_purchase_id for update;
  if not found then raise exception 'bracket_receive: not found'; end if;
  if v_p.received_at is not null then return v_p; end if;
  if v_p.technician_id is null then raise exception 'bracket_receive: not assigned'; end if;
  if v_p.status in ('canceled','returned') then raise exception 'bracket_receive: order %', v_p.status; end if;
  v_f  := least(greatest(coalesce(p_flat, v_p.flat_qty), 0), coalesce(v_p.flat_qty,0));
  v_t  := least(greatest(coalesce(p_tilting, v_p.tilting_qty), 0), coalesce(v_p.tilting_qty,0));
  v_fm := least(greatest(coalesce(p_full_motion, v_p.full_motion_qty), 0), coalesce(v_p.full_motion_qty,0));
  v_key := 'delivery:' || coalesce(v_p.walmart_order_num, v_p.id::text);
  select coalesce(skip_inventory,false) into v_skip from technicians where id = v_p.technician_id;
  if not coalesce(v_skip,false) and (v_f + v_t + v_fm) > 0
     and not exists (select 1 from bracket_moves where idempotency_key = v_key) then
    perform bracket_move(v_p.business_id, v_p.technician_id, 'delivery', v_f, v_t, v_fm, v_key,
      null, v_p.id, v_p.walmart_order_num, 'Received', p_actor);
  end if;
  update bracket_purchases set
    received_at = now(), received_by = p_actor,
    received_flat = v_f, received_tilting = v_t, received_full_motion = v_fm,
    short_flat = coalesce(flat_qty,0) - v_f, short_tilting = coalesce(tilting_qty,0) - v_t,
    short_full_motion = coalesce(full_motion_qty,0) - v_fm
  where id = v_p.id returning * into v_p;
  return v_p;
end $$;

revoke all on function app.bracket_receive(uuid,int,int,int,text) from public, anon, authenticated;
revoke all on function app.bracket_reverse_purchase(uuid,text,text) from public, anon, authenticated;
grant execute on function app.bracket_receive(uuid,int,int,int,text) to service_role;
grant execute on function app.bracket_reverse_purchase(uuid,text,text) to service_role;

-- Backfill: every canceled/returned purchase still holding a delivery credit.
select app.bracket_reverse_purchase(id, 'system:0239-backfill',
  'Walmart order ' || coalesce(walmart_order_num, id::text) || ' ' || status || ' (owner 2026-10-24: fake stock reversal)')
  from app.bracket_purchases where status in ('canceled','returned');
