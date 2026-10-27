-- Analytics > Website (Ahrefs-style), 2026-10-19. One call returns every
-- number the screen needs for one site and one window, aggregated here so the
-- browser never downloads raw events. Same US-only + bot filter as the Launch
-- traffic functions. p_src: 'ha' (ihandyandy.com, web_events), 'doms'
-- (web_events_doms) or 'site:<key>' (web_events_sites).
create or replace function public.web_hub_stats(p_src text, p_from timestamptz, p_to timestamptz, p_hourly boolean default false)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with cfg as (select
    '(bot\M|bot/|robot|crawl|spider|slurp|ahrefs|semrush|majestic|dotbot|dataprovider|screaming ?frog|sitecheck|siteaudit|uptime|pingdom|gtmetrix|lighthouse|pagespeed|ptst/|headless|phantomjs|puppeteer|playwright|selenium|webdriver|python-requests|python-urllib|curl/|wget/|libwww|okhttp|java/|go-http|node-fetch|axios/|got/|scrapy|facebookexternalhit|externalhit|externalagent|webindexer|whatsapp|embedly|feedfetcher|apis-google|mediapartners|google-agent|google-inspectiontool|googleother|google-read-aloud|yandex|sogou|Claude/|ClaudeSEO|Electron/|vercel-screenshot|vercel-favicon)'::text as bot,
    '^(America/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Juneau|Sitka|Nome|Yakutat|Metlakatla|Menominee|Adak|Indianapolis|Louisville|Indiana/.*|Kentucky/.*|North_Dakota/.*)|Pacific/Honolulu)$'::text as us),
  raw as (
    select e.session_id, e.created_at, e.event_type, e.page_url, e.referrer, e.metadata m, e.user_agent
      from web_events e where p_src = 'ha' and e.event_type in ('page_view','click','page_exit')
       and e.created_at >= p_from and e.created_at < p_to and e.page_url ~* '^https?://(www\.)?ihandyandy\.com'
    union all
    select d.session_id, d.created_at, d.event_type, d.page_url, d.referrer, d.metadata, d.user_agent
      from web_events_doms d where p_src = 'doms' and d.event_type in ('page_view','click','page_exit')
       and d.created_at >= p_from and d.created_at < p_to
    union all
    select s.session_id, s.created_at, s.event_type, s.page_url, s.referrer, s.metadata, s.user_agent
      from web_events_sites s where p_src like 'site:%' and s.site = substr(p_src, 6)
       and s.event_type in ('page_view','click','page_exit') and s.created_at >= p_from and s.created_at < p_to
  ),
  ev as (
    select r.*, coalesce(nullif(regexp_replace(regexp_replace(coalesce(r.page_url,''), '^https?://[^/]+', ''), '[?#].*$|/+$', '', 'g'), ''), '/') as path,
           date_trunc(case when p_hourly then 'hour' else 'day' end, r.created_at at time zone 'America/Denver') as bk
      from raw r, cfg
     where r.session_id is not null
       and coalesce(r.user_agent, '') !~* cfg.bot
       and coalesce(r.m->>'timezone', '') ~ cfg.us
       and coalesce(r.page_url, '') !~* '^https?://(localhost|127\.0\.0\.1)'
  ),
  pv0 as (
    select ev.*, row_number() over (partition by session_id order by created_at) rn,
           row_number() over (partition by session_id order by created_at desc) rd
      from ev where event_type = 'page_view'
  ),
  ent as (
    select p.session_id, p.bk, p.path, p.m,
      nullif(regexp_replace(lower(substring(coalesce(p.referrer,'') from '^https?://([^/?#]+)')), '^www\.', ''), '') as rh,
      regexp_replace(lower(substring(coalesce(p.page_url,'') from '^https?://([^/?#]+)')), '^www\.', '') as sh,
      substring(p.page_url from '[?&]utm_source=([^&#]*)') us_, substring(p.page_url from '[?&]utm_medium=([^&#]*)') um,
      substring(p.page_url from '[?&]utm_campaign=([^&#]*)') uc,
      (p.page_url ~ '[?&](gclid|gbraid|wbraid|gad_source|msclkid)=') paid
      from pv0 p where p.rn = 1
  ),
  -- Our own preview/testing tools are not visitors (owner 2026-09-24).
  junk as (select session_id from ent where coalesce(rh,'') ~* 'mobileviewer|github|clone|vercel\.app'),
  pv as (select * from pv0 where session_id not in (select session_id from junk)),
  dur as (select session_id, extract(epoch from max(created_at) - min(created_at)) d from ev group by 1),
  pvn as (select session_id, count(*) n from pv group by 1),
  ses as (
    select s.*, pvn.n, least(coalesce(dur.d,0), 1800) as dur,
      case when s.paid or coalesce(s.um,'') ~* 'cpc|ppc|paid' then 'Paid search'
           when coalesce(s.um,'') ~* 'email' then 'Email'
           when coalesce(s.ref,'') ~* 'chatgpt|openai|perplexity|claude\.ai|gemini\.google|copilot' then 'AI'
           when coalesce(s.ref,'') ~* '(^|\.)(google|bing|yahoo|duckduckgo|ecosia|baidu|search\.brave|yandex)\.' then 'Organic search'
           when coalesce(s.ref,'') ~* 'facebook|instagram|^t\.co$|twitter|^x\.com$|linkedin|tiktok|youtube|reddit|pinterest|nextdoor' then 'Social'
           when s.ref is null then 'Direct' else 'Referral' end as channel,
      coalesce(nullif(s.us_,''), s.ref, 'Direct') as source
      from (select e.*, case when e.rh is null or e.rh = e.sh then null else e.rh end as ref
              from ent e where e.session_id not in (select session_id from junk)) s
      join pvn on pvn.session_id = s.session_id
      left join dur on dur.session_id = s.session_id
  ),
  booked as (
    select distinct ev.session_id, ev.bk from ev
     where ev.event_type = 'click' and ev.session_id in (select session_id from ses)
       and ev.path !~* '^/(book|handyman-booking|book-handyman)$'
       and (regexp_replace(regexp_replace(coalesce(ev.m->>'target_url',''), '^https?://[^/]+', ''), '[?#].*$|/+$', '', 'g') ~* '^/(book|handyman-booking|book-handyman)$'
            or coalesce(ev.m->>'target_url','') ~* '#book$'
            or coalesce(ev.m->>'element_id','') ~ '^dv-zip-btn'
            or coalesce(ev.m->>'element_id','') = 'btn-next')
  ),
  sb as (select bk, count(*) s, count(*) filter (where n = 1) b1, avg(dur) d from ses group by 1),
  bb as (select bk, count(distinct session_id) c from booked group by 1),
  vb as (select bk, count(distinct session_id) v, count(*) pv from pv group by 1)
  select jsonb_build_object(
    'totals', (select jsonb_build_object('visitors', count(*), 'views', coalesce(sum(n),0), 'bounces', count(*) filter (where n = 1),
                 'duration', round(coalesce(avg(dur),0)::numeric,1), 'book', (select count(distinct session_id) from booked)) from ses),
    'series', coalesce((select jsonb_agg(jsonb_build_object('b', to_char(vb.bk, case when p_hourly then 'YYYY-MM-DD"T"HH24' else 'YYYY-MM-DD' end),
                 'v', vb.v, 'pv', vb.pv, 's', coalesce(sb.s,0), 'b1', coalesce(sb.b1,0), 'd', round(coalesce(sb.d,0)::numeric,1), 'c', coalesce(bb.c,0)) order by vb.bk)
               from vb left join sb on sb.bk = vb.bk left join bb on bb.bk = vb.bk), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(jsonb_build_array(path, c, v) order by c desc) from (select path, count(*) c, count(distinct session_id) v from pv group by 1 order by 2 desc limit 15) t), '[]'::jsonb),
    'entry', coalesce((select jsonb_agg(jsonb_build_array(path, c) order by c desc) from (select path, count(*) c from ses group by 1 order by 2 desc limit 15) t), '[]'::jsonb),
    'exit', coalesce((select jsonb_agg(jsonb_build_array(path, c) order by c desc) from (select path, count(*) c from pv where rd = 1 group by 1 order by 2 desc limit 15) t), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(jsonb_build_array(k, c) order by c desc) from (select source k, count(*) c from ses group by 1 order by 2 desc limit 15) t), '[]'::jsonb),
    'channels', coalesce((select jsonb_agg(jsonb_build_array(k, c) order by c desc) from (select channel k, count(*) c from ses group by 1 order by 2 desc) t), '[]'::jsonb),
    'referrers', coalesce((select jsonb_agg(jsonb_build_array(k, c) order by c desc) from (select ref k, count(*) c from ses where ref is not null group by 1 order by 2 desc limit 15) t), '[]'::jsonb),
    'utm', coalesce((select jsonb_agg(jsonb_build_array(k, c) order by c desc) from (select concat_ws(' / ', nullif(us_,''), nullif(um,''), nullif(uc,'')) k, count(*) c from ses where coalesce(us_,um,uc) is not null group by 1 order by 2 desc limit 15) t), '[]'::jsonb),
    'timezones', coalesce((select jsonb_agg(jsonb_build_array(k, c) order by c desc) from (select m->>'timezone' k, count(*) c from ses group by 1 order by 2 desc limit 15) t), '[]'::jsonb),
    'languages', coalesce((select jsonb_agg(jsonb_build_array(k, c) order by c desc) from (select coalesce(nullif(m->>'language',''),'Unknown') k, count(*) c from ses group by 1 order by 2 desc limit 15) t), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(jsonb_build_array(k, c) order by c desc) from (select coalesce(nullif(m->>'device',''),'Unknown') k, count(*) c from ses group by 1 order by 2 desc) t), '[]'::jsonb),
    'browsers', coalesce((select jsonb_agg(jsonb_build_array(k, c) order by c desc) from (select coalesce(nullif(m->>'browser',''),'Unknown') k, count(*) c from ses group by 1 order by 2 desc limit 15) t), '[]'::jsonb),
    'os', coalesce((select jsonb_agg(jsonb_build_array(k, c) order by c desc) from (select coalesce(nullif(m->>'os',''),'Unknown') k, count(*) c from ses group by 1 order by 2 desc limit 15) t), '[]'::jsonb)
  );
$$;
revoke all on function public.web_hub_stats(text, timestamptz, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.web_hub_stats(text, timestamptz, timestamptz, boolean) to service_role;

create or replace function public.web_hub_sites()
returns table(site text) language sql stable security definer set search_path to 'public' as $$
  select distinct s.site from web_events_sites s
   where s.event_type = 'page_view' and s.created_at > now() - interval '90 days' and s.site is not null;
$$;
revoke all on function public.web_hub_sites() from public, anon, authenticated;
grant execute on function public.web_hub_sites() to service_role;
