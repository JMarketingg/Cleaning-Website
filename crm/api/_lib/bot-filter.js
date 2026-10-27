
const BOT_UA = /(bot\b|bot\/|robot|crawl|spider|slurp|ahrefs|semrush|majestic|moz\.com|dotbot|dataprovider|screaming ?frog|sitecheck|siteaudit|uptime|pingdom|gtmetrix|lighthouse|pagespeed|ptst\/|headless|phantomjs|puppeteer|playwright|selenium|webdriver|python-requests|python-urllib|curl\/|wget\/|libwww|okhttp|java\/|go-http|node-fetch|axios\/|got\/|scrapy|facebookexternalhit|externalhit|externalagent|webindexer|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|slackbot|embedly|feedfetcher|apis-google|mediapartners|adsbot|google-agent|google-inspectiontool|googleother|google-read-aloud|petalbot|bytespider|amazonbot|applebot|yandex|baiduspider|duckduckbot|sogou)/i;

const INTERNAL_UA = /(Claude\/|ClaudeSEO|Electron\/|vercel-screenshot|vercel-favicon)/i;

const US_TZ = /^Asia\/Manila$/;
export function isUsTimezone(tz) { return US_TZ.test(String(tz || '')); }

const BLOG_ROOT_PAGES = new Set([
  '/dolby-atmos-flexconnect-wireless-surround-sound', '/how-to-connect-tv-to-wifi-without-remote',
  '/how-to-mount-a-tv-on-a-brick-or-concrete-wall', '/micro-rgb-vs-oled-2026', '/mounting-tv-in-apartment',
  '/qned-vs-oled', '/tv-above-fireplace-heat', '/tv-height-calculator', '/tv-technology-guide-2026',
]);
export function isBlogPath(path) {
  const p = String(path || '').replace(/\/+$/, '');
  return /^\/blog(\/|-posts|$)/i.test(p) || BLOG_ROOT_PAGES.has(p);
}

export function isBotUserAgent(ua) {
  if (!ua) return false;
  const s = String(ua);
  return BOT_UA.test(s) || INTERNAL_UA.test(s);
}

const DEFAULT_INTERNAL_CONTACTS = ['owner@example.invalid', '0000000000'];

function normPhone(v) { return String(v || '').replace(/\D/g, ''); }

function internalContactSet() {
  const extra = (process.env.INTERNAL_TEST_CONTACTS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const out = new Set();
  for (const raw of [...DEFAULT_INTERNAL_CONTACTS, ...extra]) {
    const v = String(raw).toLowerCase();
    out.add(v);
    const digits = normPhone(v);
    if (digits.length >= 10) { out.add(digits); out.add(digits.slice(-10)); }
  }
  return out;
}

export function isInternalContact(contact) {
  if (!contact) return false;
  const set = internalContactSet();
  const email = String(contact.email || '').trim().toLowerCase();
  if (email && set.has(email)) return true;
  const digits = normPhone(contact.phone);
  if (digits && (set.has(digits) || set.has(digits.slice(-10)))) return true;
  return false;
}

export const BOT_UA_SQL = '(bot\\M|bot/|robot|crawl|spider|slurp|ahrefs|semrush|majestic|moz\\.com|dotbot|dataprovider|screaming ?frog|sitecheck|siteaudit|uptime|pingdom|gtmetrix|lighthouse|pagespeed|headless|phantomjs|puppeteer|playwright|selenium|webdriver|python-requests|python-urllib|curl/|wget/|libwww|okhttp|java/|go-http|node-fetch|axios/|got/|scrapy|facebookexternalhit|externalhit|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|slackbot|embedly|preview|feedfetcher|apis-google|mediapartners|adsbot|google-agent|petalbot|bytespider|amazonbot|applebot|yandex|baiduspider|duckduckbot|sogou|Claude/|Electron/|vercel-screenshot|vercel-favicon)';
