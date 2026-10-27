// The one business this CRM runs. The internal slug stays 'handy-andy' because
// much of the code uses it as the main business id.
export const NATIVE_BUSINESS = {
  'handy-andy': { name: 'TidyHaus', legalName: 'TidyHaus Home Cleaning' },
};
export const NATIVE_SLUGS = Object.keys(NATIVE_BUSINESS);
export const ALL_BUSINESS_SLUGS = [...NATIVE_SLUGS];
