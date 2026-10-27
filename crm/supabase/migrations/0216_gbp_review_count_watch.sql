-- Google listing review-count watch (owner 2026-10-17). Daily snapshot per
-- listing from Places API; a drop opens a drop row until the owner taps Seen.
create table if not exists app.gbp_count_snapshots (
  id bigserial primary key,
  location_key text not null,
  place_id text,
  review_count int not null,
  rating numeric,
  recent jsonb,
  taken_at timestamptz not null default now()
);
create index if not exists gbp_count_snapshots_key on app.gbp_count_snapshots (location_key, taken_at desc);
alter table app.gbp_count_snapshots enable row level security;

create table if not exists app.gbp_count_drops (
  id bigserial primary key,
  location_key text not null,
  old_count int not null,
  new_count int not null,
  removed jsonb,
  detected_at timestamptz not null default now(),
  seen_at timestamptz,
  seen_by text
);
create index if not exists gbp_count_drops_open on app.gbp_count_drops (detected_at desc) where seen_at is null;
alter table app.gbp_count_drops enable row level security;
