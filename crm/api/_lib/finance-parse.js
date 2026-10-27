import { createHash } from 'crypto';


export function financeImportHash(row) {
  const key = `${row.date}|${row.amount.toFixed(2)}|${(row.description || '').trim().toLowerCase()}`;
  return createHash('sha256').update(row.dupIndex ? `${key}|dup${row.dupIndex}` : key).digest('hex');
}

export function withDupIndex(rows) {
  const seen = new Map();
  return rows.map(r => {
    const key = `${r.date}|${Number(r.amount).toFixed(2)}|${(r.description || '').trim().toLowerCase()}`;
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);
    return count > 1 ? { ...r, dupIndex: count } : r;
  });
}


function guessStatementYear(text) {
  const m = text.match(/\b(20\d{2})\b/);
  return m ? Number(m[1]) : new Date().getFullYear();
}

const MONEY = /\(?-?\$?[\d,]+\.\d{2}\)?-?/;
const LINE_RE = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+(.+?)\s+(\(?-?\$?[\d,]+\.\d{2}\)?-?)\s*$/;

function parseMoney(tok) {
  const neg = /^\(/.test(tok) || /\)$/.test(tok) || /^-/.test(tok) || /-$/.test(tok);
  const n = Number(tok.replace(/[()$,\-]/g, ''));
  return neg ? -n : n;
}

function parseGenericLines(text, { year, invertSign = false, skipIf = null } = {}) {
  const out = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(LINE_RE);
    if (!m) continue;
    const [, mm, dd, yy, desc, amtTok] = m;
    if (skipIf && skipIf(desc)) continue;
    const yr = yy ? (yy.length === 2 ? 2000 + Number(yy) : Number(yy)) : year;
    const mmN = Number(mm), ddN = Number(dd);
    if (mmN < 1 || mmN > 12 || ddN < 1 || ddN > 31) continue;
    let amount = parseMoney(amtTok);
    if (invertSign) amount = -amount;
    out.push({
      date: `${yr}-${String(mmN).padStart(2, '0')}-${String(ddN).padStart(2, '0')}`,
      description: desc.replace(/\s+/g, ' ').trim(),
      amount,
    });
  }
  return out;
}

export function parseBankStatementText(text) {
  const year = guessStatementYear(text);
  return parseGenericLines(text, {
    year,
    skipIf: (desc) => /^(beginning balance|ending balance|total (deposits|withdrawals|fees)|annual percentage yield|interest rate|fees charged)/i.test(desc.trim()),
  });
}

export function parseCreditCardStatementText(text) {
  const year = guessStatementYear(text);
  return parseGenericLines(text, {
    year,
    invertSign: true,
    skipIf: (desc) => /^(previous balance|new balance|minimum payment|total (interest|fees) charged|interest charge calculation)/i.test(desc.trim()),
  });
}

const CATEGORY_RULES = [
  { category: 'income', test: (d, amt) => amt > 0 && /stripe|payout|deposit.*(handy|doms|dom's)|merchant.*deposit/i.test(d) },
  { category: 'software', test: (d) => /gusto\s*fee/i.test(d) },
  { category: 'tech_payroll', test: (d) => /payroll|gusto|direct dep.*(tech|kregg|steve|zach|juan|heather|joey)|zelle.*(tech|kregg|steve|zach|juan)/i.test(d) },
  { category: 'materials', test: (d) => /home depot|lowe'?s|ace hardware|menards|bracket|hardware store/i.test(d) },
  { category: 'fuel_vehicle', test: (d) => /shell|chevron|exxon|mobil|conoco|texaco|circle k|fuel|gas station|auto ?zone|discount tire|jiffy lube|valvoline/i.test(d) },
  { category: 'marketing', test: (d) => /google ads|facebook ads|meta ads|adwords|yelp ads|angi|thumbtack|nextdoor ads|landingsite/i.test(d) },
  { category: 'software', test: (d) => /vercel|supabase|twilio|resend|openai|anthropic|stripe fee|zoom|microsoft 365|google workspace|godaddy|namecheap|adobe|quickbooks|grasshopper/i.test(d) },
  { category: 'insurance', test: (d) => /insurance|geico|progressive|state farm|allstate|liability ins/i.test(d) },
  { category: 'fees_interest', test: (d) => /overdraft|maintenance fee|service charge|interest charge|late fee|annual fee|nsf fee/i.test(d) },
  { category: 'tax_set_aside', test: (d) => /irs|estimated tax|eftps|tax payment/i.test(d) },
];

export function categorize(description) {
  const d = (description || '');
  for (const rule of CATEGORY_RULES) {
    if (rule.test(d, 0)) return rule.category;
  }
  return 'uncategorized';
}
export function categorizeRow(row) {
  const d = row.description || '';
  for (const rule of CATEGORY_RULES) {
    if (rule.test(d, row.amount)) return rule.category;
  }
  return 'uncategorized';
}

const TRANSFER_MATCH_WINDOW_DAYS = 4;

export function detectTransfers(transactions) {
  const outflows = transactions.filter(t => t.amount < 0 && !t.is_transfer);
  const inflows = transactions.filter(t => t.amount > 0 && !t.is_transfer);
  const usedInflow = new Set();
  const pairs = [];
  for (const out of outflows) {
    const outMs = Date.parse(out.posted_date + 'T00:00:00Z');
    let best = null, bestDiff = Infinity;
    for (const inf of inflows) {
      if (usedInflow.has(inf.id)) continue;
      if (inf.account_id === out.account_id) continue;
      if (Math.abs(inf.amount + out.amount) > 0.005) continue;
      const diffDays = Math.abs(Date.parse(inf.posted_date + 'T00:00:00Z') - outMs) / 86400000;
      if (diffDays > TRANSFER_MATCH_WINDOW_DAYS) continue;
      if (diffDays < bestDiff) { bestDiff = diffDays; best = inf; }
    }
    if (best) {
      usedInflow.add(best.id);
      pairs.push([out.id, best.id]);
    }
  }
  return pairs;
}
