-- Moving TVs (phone script, owner 2026-10-09): per-city take-down minimum
-- covering 1-3 TVs. Default = 3 x that city's Guaranteed Dismount price.
-- Editable in Other > Widget Pricing ("Moving TVs"). option_id is synthetic;
-- the public widget ignores ids it does not know.
insert into app.widget_prices (business_id, city_key, section_key, option_id, label, price, sort_order, row_key)
select w.business_id, w.city_key, 'moving', 'move_takedown_min',
       'Moving: take-down minimum (1-3 TVs)', 3 * w.price, 0, 'move_takedown_min'
from app.widget_prices w
where w.row_key = 'dismount_60'
  and not exists (select 1 from app.widget_prices x where x.business_id = w.business_id
                  and x.city_key = w.city_key and x.row_key = 'move_takedown_min');
