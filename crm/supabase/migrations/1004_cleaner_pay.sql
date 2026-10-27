-- Cleaner pay rules (editable in Other -> Cleaning Prices) and weekly payouts.
insert into app.widget_prices (business_id, city_key, section_key, option_id, label, price, sort_order, row_key)
select b.id, c.city, 'pay', p.opt, p.label, p.price, p.ord, 'pay:' || p.opt
from app.businesses b
cross join (values ('makati'), ('bgc')) c(city)
cross join (values ('percent', 'Cleaner share of each job (%)', 40, 70), ('minimum', 'Cleaner minimum pay per job (₱)', 500, 71)) p(opt, label, price, ord)
where b.slug = 'tidyhaus'
  and not exists (select 1 from app.widget_prices w where w.business_id = b.id and w.section_key = 'pay' and w.city_key = c.city and w.option_id = p.opt);

create table if not exists app.cleaner_payouts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  week_start date not null,
  technician_id uuid not null references app.technicians(id) on delete cascade,
  amount numeric not null,
  method text,
  note text,
  unique (week_start, technician_id)
);
alter table app.cleaner_payouts enable row level security;
grant all on app.cleaner_payouts to service_role;
