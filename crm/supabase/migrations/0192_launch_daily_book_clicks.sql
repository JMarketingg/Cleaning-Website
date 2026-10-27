-- 0192: daily "Book clicks" for the Launch cards (owner 2026-10-09), keyed
-- EXACTLY like launch_daily_traffic (0175): lead-gen sites by
-- web_events_sites.site, Dom's by page ('doms' = home only, 'doms-okc',
-- 'doms-tulsa'), ihandyandy.com by page path. Same bot / US-time-zone /
-- localhost / blog filters as the page-view counts.
--
-- A book click = a click, on a page that is not itself a booking page, on:
--   * a link to /book, /handyman-booking or /book-handyman (any host, query ignored)
--   * an in-page "#book" anchor (Precision's widget lives on the home page)
--   * the ihandyandy city-page zip check ("Check Area", id dv-zip-btn*), which sends to /book
--   * the inline booking widget's "Continue" (id btn-next) -- Dom's home/OKC pages
--     embed the widget, so there is no link to click there
-- `sessions` = distinct visitors per day (double taps and widget steps count
-- once); `clicks` = raw clicks.
create or replace function public.launch_daily_book_clicks(p_days int default 30)
returns table (src text, key text, day date, sessions bigint, clicks bigint)
language sql stable security definer set search_path = public
as $$
  with bounds as (select now() - make_interval(days => p_days + 1) as since),
  bot as (select '(bot\M|bot/|robot|crawl|spider|slurp|ahrefs|semrush|majestic|dotbot|dataprovider|screaming ?frog|sitecheck|siteaudit|uptime|pingdom|gtmetrix|lighthouse|pagespeed|ptst/|headless|phantomjs|puppeteer|playwright|selenium|webdriver|python-requests|python-urllib|curl/|wget/|libwww|okhttp|java/|go-http|node-fetch|axios/|got/|scrapy|facebookexternalhit|externalhit|externalagent|webindexer|whatsapp|embedly|feedfetcher|apis-google|mediapartners|google-agent|google-inspectiontool|googleother|google-read-aloud|yandex|sogou|Claude/|ClaudeSEO|Electron/|vercel-screenshot|vercel-favicon)'::text as re),
  us as (select '^(America/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Juneau|Sitka|Nome|Yakutat|Metlakatla|Menominee|Adak|Indianapolis|Louisville|Indiana/.*|Kentucky/.*|North_Dakota/.*)|Pacific/Honolulu)$'::text as re),
  raw as (
    select 'sites'::text as t, s.site, s.session_id, s.created_at, s.page_url, s.metadata as m
      from public.web_events_sites s, bounds, bot, us
     where s.event_type = 'click' and s.created_at >= bounds.since
       and coalesce(s.user_agent, '') !~* bot.re
       and coalesce(s.metadata->>'timezone', '') ~ us.re
       and coalesce(s.page_url, '') !~* '^https?://(localhost|127\.0\.0\.1)'
    union all
    select 'doms', null, d.session_id, d.created_at, d.page_url, d.metadata
      from public.web_events_doms d, bounds, bot, us
     where d.event_type = 'click' and d.created_at >= bounds.since
       and coalesce(d.user_agent, '') !~* bot.re
       and coalesce(d.metadata->>'timezone', '') ~ us.re
       and coalesce(d.page_url, '') !~* '^https?://(localhost|127\.0\.0\.1)'
    union all
    select 'ha', null, e.session_id, e.created_at, e.page_url, e.metadata
      from public.web_events e, bounds, bot, us
     where e.event_type = 'click' and e.created_at >= bounds.since
       and e.page_url ~* '^https?://(www\.)?ihandyandy\.com'
       and coalesce(e.user_agent, '') !~* bot.re
       and coalesce(e.metadata->>'timezone', '') ~ us.re
  ),
  c as (
    select raw.*,
           regexp_replace(regexp_replace(coalesce(raw.page_url, ''), '^https?://[^/]+', ''), '[?#].*$|/+$', '', 'g') as path,
           regexp_replace(regexp_replace(coalesce(raw.m->>'target_url', ''), '^https?://[^/]+', ''), '[?#].*$|/+$', '', 'g') as tpath
      from raw
  ),
  b as (
    select c.t, c.site, c.session_id, c.created_at, c.path
      from c
     where c.path !~* '^/(book|handyman-booking|book-handyman)$'
       and (c.tpath ~* '^/(book|handyman-booking|book-handyman)$'
            or coalesce(c.m->>'target_url', '') ~* '#book$'
            or coalesce(c.m->>'element_id', '') ~ '^dv-zip-btn'
            or coalesce(c.m->>'element_id', '') = 'btn-next')
  )
  select 'site'::text, b.site, (b.created_at at time zone 'America/Chicago')::date,
         count(distinct b.session_id), count(*)
    from b where b.t = 'sites'
   group by 2, 3
  union all
  select 'site'::text,
         case when b.path ~* 'oklahoma-city' then 'doms-okc'
              when b.path ~* 'tulsa' then 'doms-tulsa'
              when b.path = '' then 'doms' end,
         (b.created_at at time zone 'America/Chicago')::date,
         count(distinct b.session_id), count(*)
    from b
   where b.t = 'doms'
     and not public.launch_is_blog_path(b.path)
     and (b.path = '' or b.path ~* 'oklahoma-city|tulsa')
   group by 2, 3
  union all
  select 'path'::text, coalesce(nullif(b.path, ''), '/'),
         (b.created_at at time zone 'America/Chicago')::date,
         count(distinct b.session_id), count(*)
    from b
   where b.t = 'ha' and not public.launch_is_blog_path(b.path)
   group by 2, 3;
$$;
revoke all on function public.launch_daily_book_clicks(int) from public, anon, authenticated;
grant execute on function public.launch_daily_book_clicks(int) to service_role;
