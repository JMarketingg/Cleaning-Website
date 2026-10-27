-- Rank grid speed + pickup lock (2026-10-20). Additive only.
alter table app.rank_settings add column if not exists collect_at timestamptz;
create index if not exists rank_scans_city_kind_kw_run on app.rank_scans (city, kind, keyword, run_at desc);
