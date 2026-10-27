-- Google listing posts (owner 2026-10-18). Read-only scrape of each listing's
-- public Maps "Updates"; refreshed by the daily gbp_count_watch cron + Scan.
create table if not exists app.gbp_posts (
  location_key text not null,
  post_id text not null,
  posted_at timestamptz,
  summary text,
  image_url text,
  url text,
  fetched_at timestamptz not null default now(),
  primary key (location_key, post_id)
);
create index if not exists gbp_posts_recent on app.gbp_posts (location_key, posted_at desc);
alter table app.gbp_posts enable row level security;
