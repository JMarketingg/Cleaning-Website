-- Photo bonus (owner 2026-10-14): owner pays a tech for a great photo/video
-- from the Photos tab; the tech's bonus popup shows that picture.
alter table app.tech_bonuses add column if not exists photo_url text;
alter table app.tech_bonuses add column if not exists photo_id uuid;
