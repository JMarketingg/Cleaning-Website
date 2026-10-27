-- TidyHaus setup: turns the TV-mounting starter data into one cleaning business.
-- The internal slug stays 'handy-andy' because the code uses it as the main
-- business id in many places. Only the name, contact info and data change.
set search_path = app, public, extensions;

-- 1. Remove the old company's people and private data.
delete from app.loan_payments; delete from app.loans;
delete from app.cal_tasks; delete from app.cal_period_days; delete from app.cal_periods; delete from app.cal_cycle_settings;
delete from app.owner_habits; delete from app.callback_requests; delete from app.silent_numbers;
delete from app.secretary_schedule_changes; delete from app.secretary_availability;
delete from app.staff_schedule_exceptions; delete from app.staff_call_tasks; delete from app.staff_users;
delete from app.tech_bonuses; delete from app.technicians;
delete from app.bracket_purchases; delete from app.prospect_refs;

-- 2. Old services, areas and prices.
delete from app.service_options; delete from app.service_option_groups; delete from app.services;
delete from app.service_area_zips; delete from app.service_areas;
delete from app.widget_prices;

-- 3. One business: TidyHaus. Dom's is switched off.
update app.businesses set active = false where slug = 'doms';
update app.businesses set
  name = 'TidyHaus', legal_name = 'TidyHaus Home Cleaning', url = 'https://tidyhausph.com',
  support_phone = '+639923095621', support_email = null, timezone = 'Asia/Manila',
  brand_navy = '#1f3a3d', brand_orange = '#e8a33d',
  settings = '{"currency":"PHP","currency_symbol":"₱","country":"PH"}'::jsonb,
  analytics_config = '{"funnel_backend":"tidyhaus","site":"tidyhausph.com"}'::jsonb,
  feedback_email = null, active = true, updated_at = now()
where slug = 'handy-andy';

-- 4. Service areas.
with b as (select id from app.businesses where slug in ('handy-andy','tidyhaus')),
a as (
  insert into app.service_areas (business_id, name, state, timezone, active)
  select b.id, x.name, 'Metro Manila', 'Asia/Manila', true from b,
    (values ('Makati'), ('BGC (Taguig)')) x(name)
  returning id, name, business_id
)
insert into app.service_area_zips (business_id, service_area_id, postal_code, surcharge, tech_payout)
select a.business_id, a.id, z, 0, 0 from a
cross join lateral unnest(case when a.name = 'Makati'
  then array['1200','1201','1202','1203','1204','1205','1206','1207','1208','1209','1210','1211','1212','1213','1214','1215','1218','1219','1220','1221','1222','1223','1224','1225','1226','1227','1228','1229','1230','1231','1232','1233','1234','1235']
  else array['1630','1634','1635'] end) z;

-- 5. Services (placeholder prices in pesos; edit in CRM: Other -> Cleaning Prices).
insert into app.services (business_id, name, description, base_price, duration_minutes, category, active, sort_order)
select b.id, s.name, s.descr, s.price, s.mins, 'cleaning', true, s.ord
from app.businesses b,
(values
  ('Standard Home Cleaning', 'Houses, townhouses and apartments', 1500, 180, 1),
  ('Condo Cleaning',         'Studios up to 3 bedrooms',          1200, 150, 2),
  ('Deep Cleaning',          'Top-to-bottom clean',               3000, 300, 3),
  ('Move-in / Move-out',     'Empty houses and condos',           3500, 300, 4),
  ('Airbnb & Rental',        'Turnover between guests',           1300, 150, 5),
  ('Office Cleaning',        'Small offices',                     2500, 240, 6)
) s(name, descr, price, mins, ord)
where b.slug in ('handy-andy','tidyhaus');

-- 6. Placeholder price list. city_key = area, section_key = price group.
insert into app.widget_prices (business_id, city_key, section_key, option_id, label, price, sort_order, row_key)
select b.id, c.city, p.section, p.opt, p.label, p.price, p.ord, p.section || ':' || p.opt
from app.businesses b
cross join (values ('makati'), ('bgc')) c(city)
cross join (values
  ('service','standard','Standard Home Cleaning (base)',1500,1),
  ('service','condo','Condo Cleaning (base)',1200,2),
  ('service','deep','Deep Cleaning (base)',3000,3),
  ('service','move','Move-in / Move-out (base)',3500,4),
  ('service','airbnb','Airbnb & Rental (base)',1300,5),
  ('service','office','Office Cleaning (base)',2500,6),
  ('bedrooms','studio','Studio',0,10),
  ('bedrooms','1','1 bedroom',0,11),
  ('bedrooms','2','2 bedrooms',400,12),
  ('bedrooms','3','3 bedrooms',800,13),
  ('bedrooms','4','4+ bedrooms',1200,14),
  ('bathrooms','1','1 bathroom',0,20),
  ('bathrooms','2','2 bathrooms',300,21),
  ('bathrooms','3','3+ bathrooms',600,22),
  ('office_size','small','Small office (up to 50 sqm)',0,30),
  ('office_size','medium','Medium office (50-150 sqm)',1500,31),
  ('office_size','large','Large office (150+ sqm)',3500,32),
  ('addons','fridge','Inside fridge',300,40),
  ('addons','oven','Inside oven',300,41),
  ('addons','windows','Inside windows',500,42),
  ('addons','laundry','Laundry (wash and fold)',300,43),
  ('frequency','once','One time (discount ₱)',0,50),
  ('frequency','weekly','Weekly (discount ₱ per visit)',200,51),
  ('frequency','biweekly','Every 2 weeks (discount ₱ per visit)',150,52),
  ('frequency','monthly','Monthly (discount ₱ per visit)',100,53),
  ('rules','minimum','Minimum job price',1200,60)
) p(section, opt, label, price, ord)
where b.slug in ('handy-andy','tidyhaus');

-- 7. Only TidyHaus remains (Manila, one location). Old sample content removed.
delete from app.businesses where slug <> 'handy-andy';
delete from app.prospect_tips; delete from app.multi_tv_discount_config; delete from app.launch_snapshots;

-- 8. Internal business id is 'tidyhaus' (was the starter kit's id).
update app.businesses set slug = 'tidyhaus' where slug = 'handy-andy';
