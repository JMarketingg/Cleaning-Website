-- Launch traffic charts: daily rollup (2026-10-18). The live functions took
-- 0.6s + 3.3s and hit the statement timeout in prod (57014), so the cards
-- lost their graphs. The old bodies are kept as *_live; the public RPC names
-- now read public.launch_traffic_rollup and re-roll today + yesterday at most
-- once every 5 minutes (no pg_cron on this project). Read: ~3ms.
alter function public.launch_daily_traffic(integer) rename to launch_daily_traffic_live;
alter function public.launch_daily_book_clicks(integer) rename to launch_daily_book_clicks_live;

create table if not exists public.launch_traffic_rollup (
  kind text not null, src text not null, key text not null, day date not null,
  sessions bigint not null default 0, n bigint not null default 0,
  primary key (kind, src, key, day)
);
alter table public.launch_traffic_rollup enable row level security;
create table if not exists public.launch_traffic_rollup_meta (id int primary key default 1, refreshed_at timestamptz);
alter table public.launch_traffic_rollup_meta enable row level security;
insert into public.launch_traffic_rollup_meta(id, refreshed_at) values (1, null) on conflict do nothing;

create or replace function public.launch_traffic_refresh(p_days integer default 1, p_force boolean default false)
returns void language plpgsql volatile security definer set search_path to 'public' as $$
declare cutoff date := ((now() at time zone 'America/Chicago')::date - p_days); last timestamptz;
begin
  select refreshed_at into last from launch_traffic_rollup_meta where id = 1;
  if not p_force and last is not null and last > now() - interval '5 minutes' then return; end if;
  if not pg_try_advisory_xact_lock(hashtext('launch_traffic_refresh')) then return; end if;
  delete from launch_traffic_rollup where day >= cutoff;
  insert into launch_traffic_rollup(kind, src, key, day, sessions, n)
    select 'views', t.src, t.key, t.day, t.sessions, t.views from launch_daily_traffic_live(p_days) t
     where t.day >= cutoff and t.key is not null
    on conflict (kind, src, key, day) do update set sessions = excluded.sessions, n = excluded.n;
  insert into launch_traffic_rollup(kind, src, key, day, sessions, n)
    select 'clicks', c.src, c.key, c.day, c.sessions, c.clicks from launch_daily_book_clicks_live(p_days) c
     where c.day >= cutoff and c.key is not null
    on conflict (kind, src, key, day) do update set sessions = excluded.sessions, n = excluded.n;
  update launch_traffic_rollup_meta set refreshed_at = now() where id = 1;
end $$;

create or replace function public.launch_daily_traffic(p_days integer default 30)
returns table(src text, key text, day date, sessions bigint, views bigint)
language plpgsql volatile security definer set search_path to 'public' as $$
begin
  perform launch_traffic_refresh(1, false);
  return query select r.src, r.key, r.day, r.sessions, r.n from launch_traffic_rollup r
   where r.kind = 'views' and r.day >= (now() at time zone 'America/Chicago')::date - (p_days + 1);
end $$;

create or replace function public.launch_daily_book_clicks(p_days integer default 30)
returns table(src text, key text, day date, sessions bigint, clicks bigint)
language plpgsql volatile security definer set search_path to 'public' as $$
begin
  perform launch_traffic_refresh(1, false);
  return query select r.src, r.key, r.day, r.sessions, r.n from launch_traffic_rollup r
   where r.kind = 'clicks' and r.day >= (now() at time zone 'America/Chicago')::date - (p_days + 1);
end $$;

revoke all on function public.launch_traffic_refresh(integer, boolean) from public, anon, authenticated;
revoke all on function public.launch_daily_traffic(integer) from public, anon, authenticated;
revoke all on function public.launch_daily_book_clicks(integer) from public, anon, authenticated;
revoke all on function public.launch_daily_traffic_live(integer) from public, anon, authenticated;
revoke all on function public.launch_daily_book_clicks_live(integer) from public, anon, authenticated;
grant execute on function public.launch_daily_traffic(integer), public.launch_daily_book_clicks(integer) to service_role;

-- Backfill (run once, 62 days): select public.launch_traffic_refresh(62, true);
