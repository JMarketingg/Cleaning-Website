// One-time Google Ads clean-up the owner approved on 2026-10-15, run by the owner
// from the Google Ads panel ("Apply fixes"). Safe to re-run: lists that already
// exist are reused, attaches/removals that already happened just report errors.
//   - master negative lists (TV + handyman) on every running campaign, all accounts
//   - 7 entries removed from HA's old lists that blocked HA's own keywords
//   - old TV lists taken off the handyman campaigns (they blocked ikea/wayfair assembly)
//   - goals: calls count at 3 min+, clicks/forms become secondary
//   - "CRM booking" upload action (secondary) per account for booking uploads
import { gadsQuery, gadsMutate } from './gads.js';

const L = (s) => s.trim().split('\n').map(x => x.trim()).filter(Boolean);

const TV = L(`how to
how do
diy
do it yourself
myself
yourself
tutorial
video
youtube
instructions
manual
guide
tips
ideas
pictures
reddit
can you
should i
how high
what height
template
putting tv on wall
walmart
amazon
home depot
lowes
lowe's
menards
costco
sams club
sam's club
target
best buy
ikea
wayfair
ebay
craigslist
facebook marketplace
offerup
for sale
coupon
deals
cheap tv
price of tv
review
reviews
best tv mount
vs
sanus
mounting dream
mountingdream
echogear
vivo
pipishell
usx
peerless
chief mount
kanto
onn
rocketfish
insignia mount
member's mark
members mark
mm700
perlesmith
e306530
motorized
pull down
drop down
waterproof
weatherproof
enclosure
screws
bolts
anchors
stud finder
drill
replacement
parts
tv stand
tv stands
tv cart
floor stand
repair
fix
broken
not working
recycling
disposal
donate
sell
trade in
antenna
satellite
dish
directv
xfinity
spectrum
comcast
security camera
rv
camper
boat
truck
tv stores
tv store
electronics store
television technicians
tv technician
home services near me
home service company
job
jobs
hiring
career
careers
salary
wage
employment
apply
indeed
ziprecruiter
glassdoor
training
course
school
certification
license
franchise
free
rent
rental
puls
angi
angie's list
thumbtack
yelp
porch
hero tv mounting
w&j electronic
handyman near me
handyman houston
handyman denver
handyman austin
handyman dallas
handyman fort worth
local handyman
handyman services`);

// Owner does: home repairs, furniture assembly, art/mirror/shelf mounting, minor
// plumbing, smart home, drywall, light electrical, home cleaning. Big licensed
// trades and unrelated services stay blocked.
const HANDYMAN = L(`how to
diy
youtube
video
tutorial
job openings
jobs hiring
jobs near me hiring
[handyman jobs]
[handyman jobs near me]
[handyman job]
[handyman jobs hiring]
amazon jobs
hiring
career
careers
salary
pay
wage
employment
apply
indeed
ziprecruiter
glassdoor
training
course
school
certification
license
insurance
franchise
business for sale
start a
free
home depot
lowes
lowe's
menards
ace hardware
harbor freight
walmart
tools
tool
tool kit
tool belt
tool box
truck
van
shirt
logo
names
app
software
invoice
template
flyer
business cards
marketing
website
taskrabbit
task rabbit
angi
angie's list
thumbtack
yelp
nextdoor
craigslist
mr handyman
mr. handyman
ace handyman
handyman connection
house doctors
emergency plumber
licensed plumber
master electrician
drain cleaning
repipe
slab leak
rewire
panel upgrade
roofer
roofing
roof repair
hvac
ac repair
air conditioning
furnace
water heater
septic
sewer
foundation repair
pest control
exterminator
termite
house cleaning
maid
carpet cleaning
cleaning service
janitorial
movers
moving company
junk removal
landscaping
lawn
tree service
tree removal
pool cleaning
pool service
appliance repair
locksmith
garage door
mold
asbestos
general contractor
home builder
concrete
paving
asphalt
window cleaning
auto repair
car repair
mechanic
computer repair
phone repair
tv repair
towing
tv mounting
tv mount
mount tv
tv installation
tv install`);

const BRANDS = L(`doms tv mounting
dom's tv mounting
a1 tv mounting
handy andy
ihandyandy
houston mounting pros
houston tv mounting pros
h town tv mounting
htown tv mounting
perfectview
astraea
mile high tv mounting
atx mount pros
precision tv installation`);

const HA = '4038873594', DOMS = '4616306123', A1 = '2893668990';
// HA old-list entries that block HA's own keywords (samsung frame, 100 inch, taskrabbit...).
const HA_BAD = ['inch tv|PHRASE', 'frame tv installation|EXACT', 'samsung|PHRASE', 'tv mounting pearland|EXACT', 'screen|PHRASE', 'taskrabbit|BROAD'];
const kw = (t) => t.startsWith('[') ? { text: t.slice(1, -1), matchType: 'EXACT' } : { text: t, matchType: 'PHRASE' };
const errOf = (r) => r.error || r.partialFailureError?.message || null;

async function ensureList(db, cid, name, keywords, campaignIds) {
  const ex = await gadsQuery(db, cid, `SELECT shared_set.resource_name FROM shared_set WHERE shared_set.name = '${name}' AND shared_set.status = 'ENABLED'`);
  let set = ex.rows?.[0]?.sharedSet?.resourceName;
  if (!set) {
    const s = await gadsMutate(db, cid, 'sharedSets', [{ create: { name, type: 'NEGATIVE_KEYWORDS' } }]);
    if (errOf(s)) return { name, error: errOf(s) };
    set = s.results[0].resourceName;
    const k = await gadsMutate(db, cid, 'sharedCriteria', keywords.map(x => ({ create: { sharedSet: set, keyword: x } })));
    if (errOf(k)) return { name, error: 'keywords: ' + errOf(k) };
  }
  const a = await gadsMutate(db, cid, 'campaignSharedSets', campaignIds.map(id => ({ create: { campaign: `customers/${cid}/campaigns/${id}`, sharedSet: set } })));
  return { name, keywords: keywords.length, attached: (a.results || []).filter(x => x.resourceName).length, attachNote: errOf(a) };
}

async function convFix(db, cid, edits) {
  const r = await gadsQuery(db, cid, "SELECT conversion_action.resource_name, conversion_action.name FROM conversion_action WHERE conversion_action.status = 'ENABLED'");
  const byName = Object.fromEntries((r.rows || []).map(x => [x.conversionAction.name, x.conversionAction.resourceName]));
  const ops = [];
  for (const [name, change] of edits) {
    if (!byName[name]) continue;
    if (change === 'secondary') ops.push({ update: { resourceName: byName[name], primaryForGoal: false }, updateMask: 'primaryForGoal' });
    else ops.push({ update: { resourceName: byName[name], phoneCallDurationSeconds: String(change) }, updateMask: 'phoneCallDurationSeconds' });
  }
  if (!byName['CRM booking']) ops.push({ create: { name: 'CRM booking', type: 'UPLOAD_CLICKS', category: 'BOOK_APPOINTMENT', status: 'ENABLED', primaryForGoal: false, valueSettings: { defaultValue: 1, alwaysUseDefaultValue: false } } });
  const m = ops.length ? await gadsMutate(db, cid, 'conversionActions', ops) : {};
  const again = await gadsQuery(db, cid, "SELECT conversion_action.resource_name FROM conversion_action WHERE conversion_action.name = 'CRM booking' AND conversion_action.status = 'ENABLED'");
  return { changes: ops.length, note: errOf(m), crmBooking: again.rows?.[0]?.conversionAction?.resourceName || null };
}

export async function gadsApplyFixes20261015(db) {
  const out = {};
  // HA: drop the self-blocking entries from the two old lists.
  const old = await gadsQuery(db, HA, "SELECT shared_set.name, shared_criterion.resource_name, shared_criterion.keyword.text, shared_criterion.keyword.match_type FROM shared_criterion WHERE shared_set.name IN ('NMS | General','Anti tv mounting')");
  const bad = (old.rows || []).filter(x => HA_BAD.includes(x.sharedCriterion.keyword.text.toLowerCase() + '|' + x.sharedCriterion.keyword.matchType));
  if (bad.length) { const r = await gadsMutate(db, HA, 'sharedCriteria', bad.map(x => ({ remove: x.sharedCriterion.resourceName }))); out.ha_removed_bad = { n: bad.length, note: errOf(r) }; }
  // Dom's gets HA's old lists too (minus the bad entries).
  const base = [...new Map((old.rows || []).filter(x => !bad.includes(x)).map(x => [x.sharedCriterion.keyword.text.toLowerCase() + '|' + x.sharedCriterion.keyword.matchType, { text: x.sharedCriterion.keyword.text, matchType: x.sharedCriterion.keyword.matchType }])).values()];

  const brands = (skip) => BRANDS.filter(b => !skip.test(b)).map(kw);
  out.ha_tv = await ensureList(db, HA, 'TV negatives (master) 2026-10', TV.map(kw).concat(brands(/handy ?andy/)), ['21404594624', '21408085376', '21614608481', '24327624932']);
  out.ha_handyman = await ensureList(db, HA, 'Handyman negatives (master) 2026-10', HANDYMAN.map(kw).concat(brands(/handy ?andy/)), ['24333537838', '24333542371', '24322344222', '24333888379']);
  // Old TV lists off the handyman campaigns.
  const att = await gadsQuery(db, HA, "SELECT campaign_shared_set.resource_name, campaign.name, shared_set.name FROM campaign_shared_set WHERE shared_set.name IN ('NMS | General','Anti tv mounting') AND campaign_shared_set.status = 'ENABLED'");
  const off = (att.rows || []).filter(x => /Handyman/i.test(x.campaign.name));
  if (off.length) { const r = await gadsMutate(db, HA, 'campaignSharedSets', off.map(x => ({ remove: x.campaignSharedSet.resourceName }))); out.ha_old_lists_off_handyman = { n: off.length, note: errOf(r) }; }

  const domsKw = [...new Map(TV.map(kw).concat(brands(/dom/), base).map(k => [k.text.toLowerCase() + '|' + k.matchType, k])).values()];
  out.doms_okc = await ensureList(db, DOMS, 'TV negatives (master) 2026-10', domsKw, ['24324893411']);
  out.a1 = await ensureList(db, A1, 'TV negatives (master) 2026-10', TV.map(kw).concat(brands(/a1/)), ['24328664876']);

  // Goals: calls count at 3 min+, clicks/forms are secondary, add CRM booking (secondary for now).
  out.ha_goals = await convFix(db, HA, [['Calls from Smart Campaign Ads', 180], ['Calls From DomsTVmounting', 180], ['Smart campaign ad clicks to call', 'secondary']]);
  out.doms_goals = await convFix(db, DOMS, [['Calls from ads', 180], ['Click to call Website', 'secondary'], ['Click Send Message', 'secondary'], ['Thank You Page', 'secondary'], ['Lead form - Submit', 'secondary']]);
  out.a1_goals = await convFix(db, A1, [['Lead form - Submit', 'secondary']]);

  const actions = {};
  if (out.ha_goals.crmBooking) actions['handy-andy'] = { customer: HA, action: out.ha_goals.crmBooking };
  if (out.doms_goals.crmBooking) actions.doms = { customer: DOMS, action: out.doms_goals.crmBooking };
  if (out.a1_goals.crmBooking) actions.a1tvmounting = { customer: A1, action: out.a1_goals.crmBooking };
  if (Object.keys(actions).length) await db.from('integration_tokens').upsert({ provider: 'google_ads_upload_actions', value: JSON.stringify(actions), updated_at: new Date().toISOString() }, { onConflict: 'provider' });
  out.upload_actions = Object.keys(actions);
  await db.from('integration_tokens').upsert({ provider: 'google_ads_fixes_20261015', value: JSON.stringify(out), updated_at: new Date().toISOString() }, { onConflict: 'provider' });
  return out;
}
