// Owner-approved assessment URL while Never Fails is built on its temporary site.
// Remove the override when the completed site transfers to the business domain.
// Never Fails moved to neverfailstvmounting.com on 2026-10-11.
const PREVIEW_URLS = {};
// Sites that embed their own /booking-widget.js on /book instead of the CRM widget.
export const OWN_WIDGET_SLUGS = new Set([]);
export function launchAssessmentUrl(business) {
  return PREVIEW_URLS[business.slug] || business.url || null;
}
export function isLaunchPreview(business) {
  return !!PREVIEW_URLS[business.slug];
}
export function previewHasWidget(html, slug) {
  return slug === 'neverfailstvmounting'
    && /<script\b[^>]*\bsrc=["']\/booking-widget\.js["'][^>]*\bdata-business=["']neverfailstvmounting["']/i.test(html);
}
