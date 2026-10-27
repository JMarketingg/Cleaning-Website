const PREVIEW_URLS = {};
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
