export function demoMode() {
  const v = (process.env.DEMO_MODE || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function demoStripeResponse(path, method = 'POST', body = null) {
  const p = String(path || '');
  const card = { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 };
  if (p.startsWith('/balance')) {
    return { available: [{ currency: 'usd', amount: 812300 }], pending: [{ currency: 'usd', amount: 154200 }] };
  }
  if (p.startsWith('/payment_intents')) {
    if (method === 'GET') return { id: 'pi_demo', status: 'succeeded', amount: 999999, latest_charge: { id: 'ch_demo', amount: 999999, amount_refunded: 0 } };
    return { id: 'pi_demo', status: 'succeeded', amount: (body && body.amount) || 0, charges: { data: [{ id: 'ch_demo', payment_method_details: { card } }] } };
  }
  if (p.startsWith('/charges'))         return { id: 'ch_demo', status: 'succeeded', amount: (body && body.amount) || 0, paid: true };
  if (p.startsWith('/refunds'))         return { id: 're_demo', status: 'succeeded', amount: (body && body.amount) || 0 };
  if (p.startsWith('/disputes'))        return { data: [] };
  if (p.startsWith('/payment_methods')) {
    if (/\/payment_methods\/[^/]+$/.test(p)) return { id: 'pm_demo', card, customer: 'cus_demo' };
    return { data: [{ id: 'pm_demo', card, customer: 'cus_demo' }] };
  }
  if (p.startsWith('/customers')) {
    if (method === 'GET' && /\/customers\?/.test(p)) return { data: [{ id: 'cus_demo', invoice_settings: { default_payment_method: 'pm_demo' } }] };
    if (/\/customers\/[^/?]+/.test(p))              return { id: 'cus_demo', invoice_settings: { default_payment_method: 'pm_demo' } };
    return { id: 'cus_demo', invoice_settings: { default_payment_method: 'pm_demo' } };
  }
  return { id: 'demo', object: 'demo' };
}
