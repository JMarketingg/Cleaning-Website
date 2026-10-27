-- Google Ranking extras (owner 2026-10-20): keyword volume cache + Google Ads competitor snapshots.
create table if not exists app.rank_keywords (
  city text not null, keyword text not null,
  search_volume int, competition text, competition_index int, cpc numeric, low_bid numeric, high_bid numeric,
  fetched_at timestamptz not null default now(),
  primary key (city, keyword)
);
create table if not exists app.rank_kw_runs (
  id bigserial primary key, city text not null, run_at timestamptz not null default now(), cost numeric, kind text not null default 'volume'
);
create table if not exists app.rank_ads (
  id bigserial primary key, city text not null, run_at timestamptz not null default now(), cost numeric,
  ads jsonb not null default '[]'::jsonb, errors jsonb
);
create index if not exists rank_ads_city_run on app.rank_ads (city, run_at desc);
create index if not exists rank_kw_runs_city_run on app.rank_kw_runs (city, kind, run_at desc);
alter table app.rank_keywords enable row level security;
alter table app.rank_kw_runs enable row level security;
alter table app.rank_ads enable row level security;
revoke all on app.rank_keywords, app.rank_kw_runs, app.rank_ads from anon, authenticated;
grant all on app.rank_keywords, app.rank_kw_runs, app.rank_ads to service_role;
grant usage, select on sequence app.rank_kw_runs_id_seq, app.rank_ads_id_seq to service_role;
