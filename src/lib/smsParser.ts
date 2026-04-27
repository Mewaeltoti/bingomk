// Parses Ethiopian bank SMS notifications to extract transaction reference + amount.
// Supports: CBE, Awash, Dashen, Bank of Abyssinia, Telebirr, CBE Birr.
// Returns best-effort fields; callers should still verify against the deposit row.

export interface ParsedSms {
  reference: string | null;
  amount: number | null;
  bank: string | null;
  raw: string;
}

const BANK_HINTS: { name: string; patterns: RegExp[] }[] = [
  { name: 'Commercial Bank of Ethiopia', patterns: [/\bCBE\b/i, /Commercial Bank/i, /apps\.cbe\.com\.et/i] },
  { name: 'Awash Bank', patterns: [/Awash/i] },
  { name: 'Dashen Bank', patterns: [/Dashen/i] },
  { name: 'Bank of Abyssinia', patterns: [/Abyssinia/i, /\bBoA\b/] },
  { name: 'Telebirr', patterns: [/telebirr/i, /tele\s*birr/i] },
  { name: 'CBE Birr', patterns: [/CBE\s*Birr/i] },
];

// Reference / transaction-id patterns seen in Ethiopian bank SMS.
// Order matters — most specific first.
const REFERENCE_PATTERNS: RegExp[] = [
  /(?:transaction|txn|trx|ref(?:erence)?|receipt|confirmation)[\s#:.\-]*([A-Z0-9]{6,})/i,
  /\bFT[A-Z0-9]{8,}\b/,                 // CBE FT references
  /\b[A-Z]{2,4}\d{6,}\b/,               // generic alpha-num codes
  /\b\d{10,}\b/,                        // long numeric receipt IDs
];

const AMOUNT_PATTERNS: RegExp[] = [
  /(?:ETB|Birr)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
  /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s*(?:ETB|Birr)/i,
  /(?:credited|received|deposited|amount of)[^\d]{0,12}([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
];

export function parseBankSms(input: string): ParsedSms {
  const text = (input || '').trim();
  const result: ParsedSms = { reference: null, amount: null, bank: null, raw: text };
  if (!text) return result;

  for (const b of BANK_HINTS) {
    if (b.patterns.some((p) => p.test(text))) { result.bank = b.name; break; }
  }

  for (const p of REFERENCE_PATTERNS) {
    const m = text.match(p);
    if (m) { result.reference = (m[1] || m[0]).trim(); break; }
  }

  for (const p of AMOUNT_PATTERNS) {
    const m = text.match(p);
    if (m && m[1]) {
      const num = parseFloat(m[1].replace(/,/g, ''));
      if (!Number.isNaN(num)) { result.amount = num; break; }
    }
  }

  return result;
}

// Loose comparison so admins still match when player typed slightly different ref.
export function referencesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const norm = (s: string) => s.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}
