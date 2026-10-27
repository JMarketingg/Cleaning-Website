-- Analytics > Website: rollup tables (2026-10-19). Reading raw web_events for
-- 90 days took ~27s (cold heap), so sessions and per-day page counts are
-- rolled up once and the screen reads those (ms). web_hub_refresh() re-rolls
-- yesterday + today at most once every 5 minutes, called from the read.
-- Same US-only + bot + preview-tool filters as before. Additive only.
create table if not exists public.web_hub_sessions (
  src text not null, sid text not null, t0 timestamptz not null,
  n int not null, dur real not null default 0, booked boolean not null default false,
  entry text, exit text, ref text, channel text, source text, utm text,
  tz text, lang text, device text, browser text, os text,
  primary key (src, sid, t0)
);
create index if not exists web_hub_sessions_src_t0_idx on public.web_hub_sessions (src, t0);
alter table public.web_hub_sessions enable row level security;
create table if not exists public.web_hub_pages (
  src text not null, day date not null, path text not null, views int not null, visitors int not null,
  primary key (src, day, path)
);
alter table public.web_hub_pages enable row level security;
create table if not exists public.web_hub_meta (id int primary key default 1, refreshed_at timestamptz);
alter table public.web_hub_meta enable row level security;
insert into public.web_hub_meta(id, refreshed_at) values (1, null) on conflict do nothing;

-- Re-roll Denver days [p_d0, p_d1] (inclusive) for every site.
create or replace function public.web_hub_roll(p_d0 date, p_d1 date)
returns void language plpgsql volatile security definer set search_path to 'public' as $$
declare f timestamptz := (p_d0::timestamp at time zone 'America/Denver');
        t timestamptz := ((p_d1 + 1)::timestamp at time zone 'America/Denver');
        bot text := '(bot\M|bot/|robot|crawl|spider|slurp|ahrefs|semrush|majestic|dotbot|dataprovider|screaming ?frog|sitecheck|siteaudit|uptime|pingdom|gtmetrix|lighthouse|pagespeed|ptst/|headless|phantomjs|puppeteer|playwright|selenium|webdriver|python-requests|python-urllib|curl/|wget/|libwww|okhttp|java/|go-http|node-fetch|axios/|got/|scrapy|facebookexternalhit|externalhit|externalagent|webindexer|whatsapp|embedly|feedfetcher|apis-google|mediapartners|google-agent|google-inspectiontool|googleother|google-read-aloud|yandex|sogou|Claude/|ClaudeSEO|Electron/|vercel-screenshot|vercel-favicon)';
        us text := '^(America/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Juneau|Sitka|Nome|Yakutat|Metlakatla|Menominee|Adak|Indianapolis|Louisville|Indiana/.*|Kentucky/.*|North_Dakota/.*)|Pacific/Honolulu)$';
begin
  drop table if exists _ev, _pv, _ent, _agg;
  create temp table _ev on commit drop as
  with raw as (
    select 'ha'::text src, e.session_id, e.created_at, e.event_type, e.page_url, e.referrer, e.metadata m, e.user_agent
      from web_events e where e.event_type in ('page_view','click','page_exit')
       and e.created_at >= f - interval '1 hour' and e.created_at < t + interval '2 hours'
       and e.page_url ~* '^https?://(www\.)?ihandyandy\.com'
    union all
    select 'doms', d.session_id, d.created_at, d.event_type, d.page_url, d.referrer, d.metadata, d.user_agent
      from web_events_doms d where d.event_type in ('page_view','click','page_exit')
       and d.created_at >= f - interval '1 hour' and d.created_at < t + interval '2 hours'
    union all
    select 'site:' || s.site, s.session_id, s.created_at, s.event_type, s.page_url, s.referrer, s.metadata, s.user_agent
      from web_events_sites s where s.site is not null and s.event_type in ('page_view','click','page_exit')
       and s.created_at >= f - interval '1 hour' and s.created_at < t + interval '2 hours'
  )
  select r.src, r.session_id sid, r.created_at, r.event_type, r.page_url, r.referrer, r.m,
         coalesce(nullif(regexp_replace(regexp_replace(regexp_replace(coalesce(r.page_url,''), '^https?://[^/]+', ''), '[?#].*$', ''), '/+$', ''), ''), '/') as path
    from raw r
   where r.session_id is not null
     and coalesce(r.user_agent, '') !~* bot
     and coalesce(r.m->>'timezone', '') ~ us
     and coalesce(r.page_url, '') !~* '^https?://(localhost|127\.0\.0\.1)';

  create temp table _pv on commit drop as
    select ev.*, row_number() over (partition by src, sid order by created_at) rn,
           row_number() over (partition by src, sid order by created_at desc) rd
      from _ev ev where event_type = 'page_view';

  create temp table _ent on commit drop as
    select p.src, p.sid, p.created_at t0, p.path, p.m,
      nullif(regexp_replace(lower(substring(coalesce(p.referrer,'') from '^https?://([^/?#]+)')), '^www\.', ''), '') as rh,
      regexp_replace(lower(coalesce(substring(coalesce(p.page_url,'') from '^https?://([^/?#]+)'),'')), '^www\.', '') as sh,
      substring(p.page_url from '[?&]utm_source=([^&#]*)') us_, substring(p.page_url from '[?&]utm_medium=([^&#]*)') um,
      substring(p.page_url from '[?&]utm_campaign=([^&#]*)') uc,
      (coalesce(p.page_url,'') ~ '[?&](gclid|gbraid|wbraid|gad_source|msclkid)=') paid
      from _pv p where p.rn = 1;
  -- Our own preview/testing tools are not visitors (owner 2026-09-24).
  delete from _ent where coalesce(rh,'') ~* 'mobileviewer|github|clone|vercel\.app';

  create temp table _agg on commit drop as
    select e.src, e.sid,
           count(*) filter (where e.event_type = 'page_view') n,
           extract(epoch from max(e.created_at) - min(e.created_at)) dur,
           bool_or(e.event_type = 'click'
                   and e.path !~* '^/(book|handyman-booking|book-handyman)$'
                   and (regexp_replace(regexp_replace(coalesce(e.m->>'target_url',''), '^https?://[^/]+', ''), '[?#].*$|/+$', '', 'g') ~* '^/(book|handyman-booking|book-handyman)$'
                        or coalesce(e.m->>'target_url','') ~* '#book$'
                        or coalesce(e.m->>'element_id','') ~ '^dv-zip-btn'
                        or coalesce(e.m->>'element_id','') = 'btn-next')) booked,
           (array_agg(e.path order by e.created_at desc) filter (where e.event_type = 'page_view'))[1] exit
      from _ev e group by 1, 2;

  delete from web_hub_sessions where t0 >= f and t0 < t;
  insert into web_hub_sessions(src, sid, t0, n, dur, booked, entry, exit, ref, channel, source, utm, tz, lang, device, browser, os)
  select s.src, s.sid, s.t0, coalesce(a.n, 1), least(coalesce(a.dur, 0), 1800), coalesce(a.booked, false),
         s.path, a.exit,
         s.ref,
         case when s.paid or coalesce(s.um,'') ~* 'cpc|ppc|paid' then 'Paid search'
              when coalesce(s.um,'') ~* 'email' then 'Email'
              when coalesce(s.ref,'') || ' ' || coalesce(s.us_,'') ~* 'chatgpt|openai|perplexity|claude\.ai|gemini|copilot' then 'AI'
              when coalesce(s.ref,'') ~* '(^|\.)(google|bing|yahoo|duckduckgo|ecosia|baidu|search\.brave|yandex)\.' then 'Organic search'
              when coalesce(s.ref,'') ~* 'facebook|instagram|^t\.co$|twitter|^x\.com$|linkedin|tiktok|youtube|reddit|pinterest|nextdoor' then 'Social'
              when s.ref is null then 'Direct' else 'Referral' end,
         coalesce(nullif(s.us_,''), s.ref, 'Direct'),
         nullif(concat_ws(' / ', nullif(s.us_,''), nullif(s.um,''), nullif(s.uc,'')), ''),
         s.m->>'timezone', nullif(s.m->>'language',''), nullif(s.m->>'device',''), nullif(s.m->>'browser',''), nullif(s.m->>'os','')
    from (select e.*, case when e.rh is null or e.rh = e.sh then null else e.rh end as ref from _ent e) s
    left join _agg a on a.src = s.src and a.sid = s.sid
   where s.t0 >= f and s.t0 < t
  on conflict (src, sid, t0) do nothing;

  delete from web_hub_pages where day between p_d0 and p_d1;
  insert into web_hub_pages(src, day, path, views, visitors)
  select p.src, (p.created_at at time zone 'America/Denver')::date d, p.path, count(*), count(distinct p.sid)
    from _pv p
   where p.created_at >= f and p.created_at < t
     and (p.src, p.sid) in (select e.src, e.sid from _ent e)
   group by 1, 2, 3;
end $$;

create or replace function public.web_hub_refresh(p_force boolean default false)
returns void language plpgsql volatile security definer set search_path to 'public' as $$
declare last timestamptz; today date := (now() at time zone 'America/Denver')::date;
begin
  select refreshed_at into last from web_hub_meta where id = 1;
  if not p_force and last is not null and last > now() - interval '5 minutes' then return; end if;
  if not pg_try_advisory_xact_lock(hashtext('web_hub_refresh')) then return; end if;
  perform web_hub_roll(today - 1, today);
  update web_hub_meta set refreshed_at = now() where id = 1;
end $$;

-- One call = every number the screen needs for one site and one window.
drop function if exists public.web_hub_stats(text, timestamptz, timestamptz, boolean);
create or replace function public.web_hub_stats(p_src text, p_from timestamptz, p_to timestamptz, p_hourly boolean default false)
returns jsonb language plpgsql volatile security definer set search_path to 'public' as $$
declare r jsonb; d0 date := (p_from at time zone 'America/Denver')::date; d1 date := ((p_to - interval '1 second') at time zone 'America/Denver')::date;
begin
  perform web_hub_refresh(false);
  with ses as (select * from web_hub_sessions where src = p_src and t0 >= p_from and t0 < p_to),
  sb as (select date_trunc(case when p_hourly then 'hour' else 'day' end, t0 at time zone 'America/Denver') bk,
                count(*) v, sum(n) pv, count(*) filter (where n = 1) b1, avg(dur) d, count(*) filter (where booked) c
           from ses group by 1),
  pg as (select path, sum(views) c, sum(visitors) v from web_hub_pages where src = p_src and day between d0 and d1 group by 1),
  kv as (select 'entry' k, entry x from ses union all select 'exit', exit from ses union all select 'sources', source from ses
         union all select 'channels', channel from ses union all select 'referrers', ref from ses union all select 'utm', utm from ses
         union all select 'timezones', tz from ses union all select 'languages', coalesce(lang,'Unknown') from ses
         union all select 'devices', coalesce(device,'Unknown') from ses union all select 'browsers', coalesce(browser,'Unknown') from ses
         union all select 'os', coalesce(os,'Unknown') from ses),
  kc as (select k, x, count(*) c, row_number() over (partition by k order by count(*) desc) i from kv where x is not null group by 1, 2)
  select jsonb_build_object(
    'totals', (select jsonb_build_object('visitors', count(*), 'views', coalesce(sum(n),0), 'bounces', count(*) filter (where n = 1),
                 'duration', round(coalesce(avg(dur),0)::numeric,1), 'book', count(*) filter (where booked)) from ses),
    'series', coalesce((select jsonb_agg(jsonb_build_object('b', to_char(bk, case when p_hourly then 'YYYY-MM-DD"T"HH24' else 'YYYY-MM-DD' end),
                 'v', v, 'pv', pv, 'b1', b1, 'd', round(coalesce(d,0)::numeric,1), 'c', c) order by bk) from sb), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(jsonb_build_array(path, c, v) order by c desc) from (select * from pg order by c desc limit 15) t), '[]'::jsonb)
  ) || coalesce((select jsonb_object_agg(k, a) from (select k, jsonb_agg(jsonb_build_array(x, c) order by c desc) a from kc where i <= 15 group by k) z), '{}'::jsonb)
  into r;
  return r;
end $$;
revoke all on function public.web_hub_stats(text, timestamptz, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public.web_hub_roll(date, date) from public, anon, authenticated;
revoke all on function public.web_hub_refresh(boolean) from public, anon, authenticated;
grant execute on function public.web_hub_stats(text, timestamptz, timestamptz, boolean) to service_role;

-- Site list for the picker: whatever has rolled-up traffic.
create or replace function public.web_hub_sites()
returns table(site text) language sql stable security definer set search_path to 'public' as $$
  select distinct src from web_hub_pages where day > (now() at time zone 'America/Denver')::date - 90;
$$;
revoke all on function public.web_hub_sites() from public, anon, authenticated;
grant execute on function public.web_hub_sites() to service_role;

-- Backfill (run once, in chunks): select public.web_hub_roll(d, d + 6) for 90 days.
