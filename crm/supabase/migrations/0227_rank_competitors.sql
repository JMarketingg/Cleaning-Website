-- Rank grid (2026-10-20): competitor table and spend totals computed in the DB.
-- rank_competitors: every listing/domain seen in the given scans' full result
-- lists. One row per listing per point (Local Finder page 2 can repeat page 1's
-- last listing). Maps position = place in the list (ads already dropped, so the
-- stored rank_group can be 1-3 too high); organic keeps its own rank.
-- avg_rank counts "not found" as 21, same rule as the page's average tile.
create or replace function app.rank_competitors(p_scan_ids bigint[])
returns table(key text, name text, you text, n int, top3 int, found int, avg_rank numeric, rating numeric, reviews int, website text)
language sql stable
set search_path = app, public
as $$
  with pts as (
    select p.id, s.kind, p.results
    from app.rank_points p join app.rank_scans s on s.id = p.scan_id
    where p.scan_id = any(p_scan_ids) and jsonb_typeof(p.results) = 'array'
  ),
  tot as (select count(*)::int n from pts),
  raw as (
    select pts.id pid, pts.kind, e.ord, e.r,
      case when pts.kind = 'maps' then coalesce(nullif(e.r->>'cid', ''), 'n:' || lower(coalesce(e.r->>'name', '')))
           else lower(regexp_replace(coalesce(e.r->>'domain', ''), '^www\.', '')) end k
    from pts, jsonb_array_elements(pts.results) with ordinality e(r, ord)
  ),
  dedup as (
    select distinct on (pid, k) pid, kind, ord, r, k from raw where k <> '' and k <> 'n:' order by pid, k, ord
  ),
  pos as (
    select k, r,
      case when kind = 'maps' then (row_number() over (partition by pid order by ord))::int
           else coalesce(nullif(r->>'rank', '')::int, ord::int) end pos
    from dedup
  ),
  agg as (
    select k,
      (array_agg(r->>'name' order by pos))[1] name,
      max(r->>'you') you,
      count(*)::int found,
      (count(*) filter (where pos <= 3))::int top3,
      sum(pos)::int possum,
      max(nullif(r->>'rating', '')::numeric) rating,
      max(nullif(r->>'reviews', '')::int) reviews,
      max(nullif(r->>'website', '')) website
    from pos group by k
  )
  select a.k, a.name, a.you, t.n, a.top3, a.found,
    round((a.possum + 21 * greatest(t.n - a.found, 0))::numeric / nullif(t.n, 0), 1),
    a.rating, a.reviews, a.website
  from agg a cross join tot t;
$$;

create or replace function app.rank_spend()
returns table(city text, usd numeric)
language sql stable
set search_path = app, public
as $$
  select city, coalesce(sum(cost), 0) from app.rank_scans where cost > 0 group by city;
$$;

revoke all on function app.rank_competitors(bigint[]) from public, anon, authenticated;
revoke all on function app.rank_spend() from public, anon, authenticated;
grant execute on function app.rank_competitors(bigint[]) to service_role;
grant execute on function app.rank_spend() to service_role;
