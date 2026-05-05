import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sms-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SMS_SECRET = Deno.env.get("SMS_FORWARD_SECRET")!;

// --- Parsing helpers ---------------------------------------------------------

// CBE refs typically: FT26123GT4Z5 (FT + 10+ alphanumerics)
// Telebirr refs: alphanumeric, often starts with letters/digits, 10+ chars
const REF_PATTERNS: RegExp[] = [
  /(?:Ref(?:erence)?\s*No\.?|transaction\s*id|txn\s*id|trx\s*id|receipt\s*no\.?|conf(?:irmation)?\s*(?:code|no\.?))[\s:#-]*([A-Z0-9]{8,})/i,
  /\bFT[A-Z0-9]{8,}\b/,                // CBE
  /\b[A-Z]{2}[A-Z0-9]{8,}\b/,          // generic alpha-prefixed
  /\b[A-Z0-9]{10,}\b/,                 // generic long token
];

const AMOUNT_PATTERNS: RegExp[] = [
  /(?:ETB|Birr)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
  /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s*(?:ETB|Birr)/i,
  /(?:credited|received|deposited|amount of)[^\d]{0,12}([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
];

function detectBank(text: string): string | null {
  if (/CBE|Commercial Bank|apps\.cbe\.com\.et/i.test(text)) return "CBE";
  if (/telebirr|tele\s*birr/i.test(text)) return "Telebirr";
  return null;
}

function parseSms(text: string): { reference: string | null; amount: number | null; bank: string | null } {
  const t = (text || "").trim();
  let reference: string | null = null;
  for (const p of REF_PATTERNS) {
    const m = t.match(p);
    if (m) { reference = (m[1] || m[0]).trim().toUpperCase(); break; }
  }
  let amount: number | null = null;
  for (const p of AMOUNT_PATTERNS) {
    const m = t.match(p);
    if (m && m[1]) {
      const n = parseFloat(m[1].replace(/,/g, ""));
      if (!Number.isNaN(n)) { amount = n; break; }
    }
  }
  return { reference, amount, bank: detectBank(t) };
}

function refsMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

// --- Handler -----------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth: shared secret in header (x-sms-secret) or Authorization: Bearer
  const provided =
    req.headers.get("x-sms-secret") ||
    (req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  if (!SMS_SECRET || provided !== SMS_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const message: string = body?.message || body?.text || "";
  if (!message || typeof message !== "string") {
    return new Response(JSON.stringify({ error: "Missing message" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = parseSms(message);
  if (!parsed.reference) {
    return new Response(JSON.stringify({ ok: true, action: "ignored", reason: "no_reference", parsed }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Duplicate guard
  const { data: dup } = await supabase
    .from("processed_tx").select("id").eq("tx_id", parsed.reference).maybeSingle();
  if (dup) {
    return new Response(JSON.stringify({ ok: true, action: "duplicate", tx_id: parsed.reference }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find pending deposits — fuzzy reference match
  const { data: pending } = await supabase
    .from("deposits")
    .select("id, user_id, amount, reference, status, bank")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(200);

  const candidate = (pending || []).find((d) => d.reference && refsMatch(d.reference, parsed.reference!));

  if (!candidate) {
    // record processed to avoid re-processing same SMS later
    await supabase.from("processed_tx").insert({
      tx_id: parsed.reference, amount: parsed.amount, bank: parsed.bank, raw_message: message,
    });
    return new Response(JSON.stringify({ ok: true, action: "no_match", parsed }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const amountMatches =
    parsed.amount != null && Math.abs(Number(candidate.amount) - parsed.amount) < 0.01;
  const newStatus = amountMatches ? "auto_verified" : "needs_review";

  await supabase.from("deposits").update({ status: newStatus }).eq("id", candidate.id);
  await supabase.from("processed_tx").insert({
    tx_id: parsed.reference,
    amount: parsed.amount,
    bank: parsed.bank,
    deposit_id: candidate.id,
    raw_message: message,
  });

  return new Response(JSON.stringify({
    ok: true,
    action: newStatus,
    deposit_id: candidate.id,
    tx_id: parsed.reference,
    sms_amount: parsed.amount,
    deposit_amount: Number(candidate.amount),
  }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
