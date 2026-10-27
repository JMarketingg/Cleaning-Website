import { capName } from './name-case.js';
import { serviceClient } from './supabase.js';
import { signToken } from './auth.js';
import { canonicalizeLineItems, bumpLiRev } from './line-items.js';

function first(...vals) { for (const v of vals) if (v != null && v !== '') return v; return null; }

function isTechSlotRaceErr(e) { return !!(e && e.code === '23505' && /bookings_tech_slot_unique/.test(e.message || '')); }

export async function mirrorBooking(ctx = {}) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
    const db = serviceClient();
    const job = ctx.zbkJob || {};

    const { data: biz } = await db.from('businesses').select('id, name, slug, timezone').eq('slug', ctx.businessSlug).single();
    if (!biz) return;

    let service_area_id = null;
    if (ctx.territory_id) {
      const { data: area } = await db.from('service_areas')
        .select('id').eq('business_id', biz.id)
        .eq('zenbooker_territory_id', String(ctx.territory_id)).maybeSingle();
      service_area_id = area?.id || null;
    }

    const assigned = (job.assigned_providers || job.providers || [])[0] || {};
    const providerName = first(ctx.technician_name, assigned.name, assigned.display_name);
    let technician_id = ctx.technician_id || null;
    const providerId = first(ctx.technician_provider_id, assigned.id, assigned.provider_id);
    if (!technician_id && providerId) {
      const { data: t } = await db.from('technicians').select('id')
        .eq('business_id', biz.id).eq('zenbooker_provider_id', String(providerId)).maybeSingle();
      technician_id = t?.id || null;
    }
    if (!technician_id && providerName) {
      const { data: t } = await db.from('technicians').select('id')
        .eq('business_id', biz.id).ilike('name', `%${providerName.split(' ')[0]}%`).maybeSingle();
      technician_id = t?.id || null;
    }

    let service_id = null;
    if (ctx.service_name) {
      const { data: s } = await db.from('services').select('id')
        .eq('business_id', biz.id).ilike('name', ctx.service_name).maybeSingle();
      service_id = s?.id || null;
    }

    const c = ctx.customer || {};
    const a = ctx.address || {};
    const custRow = {
      business_id: biz.id,
      name: capName(first(c.name, `${c.first_name || ''} ${c.last_name || ''}`.trim(), 'Customer')),
      first_name: capName(c.first_name) || null, last_name: capName(c.last_name) || null,
      phone: c.phone || null, email: c.email || null,
      address_line1: a.line1 || null, address_line2: a.line2 || null, city: a.city || null, state: a.state || null, postal_code: a.postal_code || null,
      stripe_customer_id: ctx.stripe_customer_id || null,
      zenbooker_customer_id: ctx.zenbooker_customer_id ? String(ctx.zenbooker_customer_id) : null,
    };
    let customer_id = null;
    if (custRow.zenbooker_customer_id) {
      const { data } = await db.from('customers')
        .upsert(custRow, { onConflict: 'business_id,zenbooker_customer_id' }).select('id').single();
      customer_id = data?.id || null;
    } else if (custRow.email) {
      const { data: foundRows } = await db.from('customers').select('id')
        .eq('business_id', biz.id).eq('email', custRow.email).order('created_at', { ascending: false }).limit(1);
      const found = foundRows?.[0] || null;
      if (found) {
        const { data } = await db.from('customers').update(custRow).eq('id', found.id).select('id').single();
        customer_id = data?.id || found.id;
      } else {
        customer_id = (await db.from('customers').insert(custRow).select('id').single()).data?.id || null;
      }
    } else {
      customer_id = (await db.from('customers').insert(custRow).select('id').single()).data?.id || null;
    }
    if (!customer_id) return;

    const scheduled_at = first(ctx.scheduled_at, job.start_time, job.scheduled_at, job.starts_at, job.start,
                               job.appointment && job.appointment.start_time);
    const price = Number(first(ctx.price, job.total, job.price, job.amount, 0)) || 0;

    const bookingRow = {
      business_id: biz.id, customer_id, technician_id, service_id,
      service_area_id: ctx.service_area_id || service_area_id,
      status: ctx.status || (technician_id ? 'assigned' : 'confirmed'),
      source: ctx.source || 'widget',
      scheduled_at: scheduled_at || null,
      ...(ctx.scheduled_end ? { scheduled_end: ctx.scheduled_end } : {}),
      ...(ctx.duration_minutes ? { duration_minutes: Number(ctx.duration_minutes) } : {}),
      ...(ctx.subtotal != null ? { subtotal: Number(ctx.subtotal) || 0 } : {}),
      ...(ctx.payment_status ? { payment_status: ctx.payment_status } : {}),
      ...(ctx.sms_consent != null ? { sms_consent: !!ctx.sms_consent } : {}),
      ...(ctx.stripe_customer_id ? { stripe_customer_id: ctx.stripe_customer_id } : {}),
      ...(ctx.stripe_payment_method_id ? { stripe_payment_method_id: ctx.stripe_payment_method_id } : {}),
      ...(ctx.stripe_account ? { stripe_account: ctx.stripe_account } : {}),
      price, tip: Number(ctx.tip) || 0,
      address_line1: a.line1 || null, address_line2: a.line2 || null, city: a.city || null, state: a.state || null, postal_code: a.postal_code || null,
      notes: first(ctx.notes, providerName && `Zenbooker tech: ${providerName}`),
      customer_notes: ctx.customer_notes || null,
      zenbooker_job_id: ctx.zenbooker_job_id ? String(ctx.zenbooker_job_id) : null,
      zenbooker_job_number: job.job_number ? String(job.job_number) : null,
      metadata: {
        mirrored_at: new Date().toISOString(), source: ctx.source || 'widget',
        ...(typeof ctx.landing_page === 'string' && ctx.landing_page ? { landing_page: ctx.landing_page.slice(0, 300) } : {}),
        ...(typeof ctx.traffic_source === 'string' && ctx.traffic_source ? { traffic_source: ctx.traffic_source.slice(0, 300) } : {}),
        ...(typeof ctx.source_page === 'string' && /^\/[A-Za-z0-9/_.~-]{0,299}$/.test(ctx.source_page)
          ? { source_page: ctx.source_page,
              ...(['referrer', 'last_page'].includes(ctx.source_page_basis) ? { source_page_basis: ctx.source_page_basis } : {}) }
          : {}),
        ...((() => {
          const src = ctx.ad_click; if (!src || typeof src !== 'object' || Array.isArray(src)) return {};
          const ac = {};
          for (const k of ['gclid', 'gbraid', 'wbraid', 'gad_campaignid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term']) {
            if (typeof src[k] === 'string' && /^[A-Za-z0-9._~-]{1,200}$/.test(src[k])) ac[k] = src[k];
          }
          return Object.keys(ac).length ? { ad_click: ac } : {};
        })()),
        ...(typeof ctx.site_session_id === 'string' && /^session_\d{13}_[a-z0-9]{1,12}$/.test(ctx.site_session_id) ? { site_session_id: ctx.site_session_id } : {}),
      },
    };
    let booking_id = null;
    let hadReviewToken = false;
    if (bookingRow.zenbooker_job_id) {
      const { data: prev } = await db.from('bookings')
        .select('id, status, completed_at, metadata, review_token')
        .eq('business_id', biz.id).eq('zenbooker_job_id', bookingRow.zenbooker_job_id).maybeSingle();
      if (prev && (['completed', 'cancelled', 'no_show'].includes(prev.status) || prev.completed_at)) {
        return { booking_id: prev.id, customer_id, business_id: biz.id, technician_id };
      }
      if (prev) {
        delete bookingRow.status;
        bookingRow.metadata = { ...(prev.metadata || {}), ...bookingRow.metadata };
        hadReviewToken = !!prev.review_token;
      }
      let up = await db.from('bookings')
        .upsert(bookingRow, { onConflict: 'business_id,zenbooker_job_id' }).select('id').single();
      if (isTechSlotRaceErr(up.error)) {
        console.warn('[mirror] tech/slot race lost (zenbooker upsert), booking unassigned instead:', up.error.message);
        technician_id = null;
        bookingRow.technician_id = null;
        if (bookingRow.status === 'assigned') bookingRow.status = 'confirmed';
        up = await db.from('bookings')
          .upsert(bookingRow, { onConflict: 'business_id,zenbooker_job_id' }).select('id').single();
      }
      booking_id = up.data?.id || null;
    } else if (ctx.idempotency_key) {
      bookingRow.idempotency_key = String(ctx.idempotency_key);
      let ins = await db.from('bookings').insert(bookingRow).select('id').single();
      if (isTechSlotRaceErr(ins.error)) {
        console.warn('[mirror] tech/slot race lost, booking unassigned instead:', ins.error.message);
        technician_id = null;
        bookingRow.technician_id = null;
        if (bookingRow.status === 'assigned') bookingRow.status = 'confirmed';
        ins = await db.from('bookings').insert(bookingRow).select('id').single();
      }
      if (!ins.error) {
        booking_id = ins.data?.id || null;
      } else if (ins.error.code === '23505' || /duplicate key|idempotency/i.test(ins.error.message || '')) {
        const { data: existing } = await db.from('bookings').select('id, technician_id, status')
          .eq('business_id', biz.id).eq('idempotency_key', String(ctx.idempotency_key)).maybeSingle();
        if (existing?.id) return { booking_id: existing.id, customer_id, business_id: biz.id, technician_id: existing.technician_id || null, status: existing.status, duplicate: true };
        return;
      } else if (/idempotency_key/.test(ins.error.message || '')) {
        delete bookingRow.idempotency_key;
        booking_id = (await db.from('bookings').insert(bookingRow).select('id').single()).data?.id || null;
      } else {
        return;
      }
    } else {
      let ins = await db.from('bookings').insert(bookingRow).select('id').single();
      if (isTechSlotRaceErr(ins.error)) {
        console.warn('[mirror] tech/slot race lost, booking unassigned instead:', ins.error.message);
        technician_id = null;
        bookingRow.technician_id = null;
        if (bookingRow.status === 'assigned') bookingRow.status = 'confirmed';
        ins = await db.from('bookings').insert(bookingRow).select('id').single();
      }
      booking_id = ins.data?.id || null;
    }
    if (!booking_id) return;

    try {

    if (!hadReviewToken) {
      const reviewToken = signToken({ kind: 'review', booking_id }, 2592000);
      await db.from('bookings').update({ review_token: reviewToken }).eq('id', booking_id);
    }

    const lines = Array.isArray(ctx.line_items) ? ctx.line_items.filter(Boolean) : [];
    if (lines.length) {
      await db.from('booking_line_items').delete().eq('booking_id', booking_id);
      const rows = canonicalizeLineItems(lines.map(li => ({
        booking_id, business_id: biz.id,
        kind: li.kind || 'service', name: String(li.name || 'Item').slice(0, 200),
        quantity: Number(li.quantity) || 1,
        unit_price: Number(li.unit_price) || 0,
        line_total: Number(li.line_total != null ? li.line_total : li.unit_price) || 0,
      }))).map((r, i) => ({ ...r, sort_order: i }));
      let { error: liErr } = await db.from('booking_line_items').insert(rows);
      if (liErr && /sort_order/.test(liErr.message || '')) {
        ({ error: liErr } = await db.from('booking_line_items').insert(rows.map(({ sort_order, ...r }) => r)));
      }
      if (liErr) console.warn('[mirror] line items insert failed:', liErr.message);
      await bumpLiRev(db, booking_id);
    }

    await db.from('booking_status_events').insert({
      booking_id, business_id: biz.id, technician_id,
      status: bookingRow.status, note: `Mirrored from ${ctx.source || 'widget'} booking`,
    });


    } catch (e) {
      console.warn('[mirror] post-insert step failed (booking kept):', e.message);
    }

    return { booking_id, customer_id, business_id: biz.id, technician_id };
  } catch (e) {
    console.warn('[mirror] non-fatal:', e.message);
  }
}
