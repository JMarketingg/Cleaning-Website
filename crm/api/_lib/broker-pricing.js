
export const MARKUP_NUMERATOR = 12;
export const MARKUP_DENOMINATOR = 10;

export function parseMoney(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().replace(/[$,\s]/g, '');
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export function minSellPrice(subPrice) {
  const sub = parseMoney(subPrice);
  if (sub === null) return null;
  const cents = Math.round(sub * 100);
  const markedUpCents = Math.round((cents * MARKUP_NUMERATOR) / MARKUP_DENOMINATOR);
  return Math.ceil(markedUpCents / 100);
}

export function spread(subPrice, sellPrice) {
  const sub = parseMoney(subPrice);
  const sell = parseMoney(sellPrice);
  if (sub === null || sell === null) return null;
  return Math.round((sell - sub) * 100) / 100;
}

export function checkSellPrice(subPrice, sellPrice, override) {
  const sub = parseMoney(subPrice);
  const sell = parseMoney(sellPrice);
  const min = minSellPrice(sub);
  if (sub === null) return { ok: false, error: 'Enter the subcontractor price first.' };
  if (sell === null) return { ok: false, error: 'Enter a sell price.' };
  const belowMin = sell < min;
  if (belowMin && !override) {
    return { ok: false, belowMin: true, min, error: `Sell price is below the $${min} minimum (20 percent over the $${sub} sub price). Tick the override to save it anyway.` };
  }
  return { ok: true, belowMin, min, sub, sell, spread: spread(sub, sell) };
}
