import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type PatternName = "Full House" | "L Shape" | "T Shape" | "U Shape" | "X Shape";

function checkWin(numbers: number[][], markedNumbers: Set<number>, pattern: PatternName): boolean {
  const isMarked = (row: number, col: number) => {
    if (row === 2 && col === 2) return true;
    return markedNumbers.has(numbers[row]?.[col] ?? -1);
  };
  switch (pattern) {
    case "Full House":
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (!isMarked(r, c)) return false;
      return true;
    case "L Shape":
      for (let r = 0; r < 5; r++) if (!isMarked(r, 0)) return false;
      for (let c = 0; c < 5; c++) if (!isMarked(4, c)) return false;
      return true;
    case "T Shape":
      for (let c = 0; c < 5; c++) if (!isMarked(0, c)) return false;
      for (let r = 0; r < 5; r++) if (!isMarked(r, 2)) return false;
      return true;
    case "U Shape":
      for (let r = 0; r < 5; r++) if (!isMarked(r, 0)) return false;
      for (let r = 0; r < 5; r++) if (!isMarked(r, 4)) return false;
      for (let c = 0; c < 5; c++) if (!isMarked(4, c)) return false;
      return true;
    case "X Shape":
      for (let i = 0; i < 5; i++) { if (!isMarked(i, i)) return false; if (!isMarked(i, 4 - i)) return false; }
      return true;
    default: return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await userClient.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const adminId = claimsData.claims.sub;

    // Use service role for DB operations
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Check admin role
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", adminId).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const { action, claim_id, is_valid } = await req.json();

    if (action === "verify_single") {
      return await verifySingle(supabase, claim_id, is_valid);
    } else if (action === "verify_all") {
      return await verifyAll(supabase);
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});

async function verifySingle(supabase: any, claimId: string, isValid: boolean) {
  if (isValid) {
    await supabase.from("bingo_claims").update({ is_valid: true }).eq("id", claimId);
  } else {
    await supabase.from("bingo_claims").update({ is_valid: false }).eq("id", claimId);

    // Check remaining pending
    const { data: pending } = await supabase.from("bingo_claims").select("id").eq("game_id", "current").is("is_valid", null);
    if (!pending || pending.length === 0) {
      await supabase.from("games").update({ auto_draw: true }).eq("id", "current");
      // Re-invoke auto-draw
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/auto-draw`, {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
      }).catch(() => {});
    }
    return new Response(JSON.stringify({ ok: true, result: "invalid" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Check remaining pending (excluding just-validated)
  const { data: pending } = await supabase.from("bingo_claims").select("id").eq("game_id", "current").is("is_valid", null);
  if (pending && pending.length > 0) {
    return new Response(JSON.stringify({ ok: true, result: "valid_pending_remaining", remaining: pending.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // No more pending — resolve game
  return await resolveGame(supabase);
}

async function verifyAll(supabase: any) {
  const { data: pendingClaims } = await supabase.from("bingo_claims").select("*").eq("game_id", "current").is("is_valid", null);
  if (!pendingClaims || pendingClaims.length === 0) {
    return new Response(JSON.stringify({ ok: true, result: "no_pending" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: nums } = await supabase.from("game_numbers").select("number").eq("game_id", "current");
  const drawnSet = new Set((nums || []).map((n: any) => n.number));

  const { data: gameData } = await supabase.from("games").select("pattern").eq("id", "current").single();
  const pattern = gameData?.pattern || "Full House";

  const validClaimUserIds: string[] = [];

  for (const claim of pendingClaims) {
    const { data: cartela } = await supabase.from("cartelas").select("numbers").eq("id", claim.cartela_id).single();
    const isValid = cartela ? checkWin(cartela.numbers as number[][], drawnSet, pattern as PatternName) : false;
    await supabase.from("bingo_claims").update({ is_valid: isValid }).eq("id", claim.id);
    if (isValid) validClaimUserIds.push(claim.user_id);
  }

  const uniqueWinnerIds = [...new Set(validClaimUserIds)];

  if (uniqueWinnerIds.length === 0) {
    await supabase.from("games").update({ auto_draw: true }).eq("id", "current");
    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/auto-draw`, {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
    }).catch(() => {});
    return new Response(JSON.stringify({ ok: true, result: "no_winners_resume" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return await resolveGame(supabase);
}

async function resolveGame(supabase: any) {
  const { data: allClaims } = await supabase.from("bingo_claims").select("*").eq("game_id", "current").eq("is_valid", true);
  const uniqueWinnerIds = [...new Set((allClaims || []).map((c: any) => c.user_id))];
  const { data: game } = await supabase.from("games").select("*").eq("id", "current").single();
  const prizeAmount = game?.prize_amount || 0;

  const { data: nums } = await supabase.from("game_numbers").select("number").eq("game_id", "current");
  const drawnNumbersList = (nums || []).map((n: any) => n.number);
  const { count: playersCount } = await supabase.from("cartelas").select("owner_id", { count: "exact", head: true }).eq("is_used", true).not("owner_id", "is", null);

  if (uniqueWinnerIds.length >= 3) {
    // Disqualify
    await supabase.from("games").update({ status: "disqualified", winner_id: null, auto_draw: false }).eq("id", "current");
    await supabase.from("game_numbers").delete().eq("game_id", "current");
    await supabase.from("bingo_claims").delete().eq("game_id", "current");
    return new Response(JSON.stringify({ ok: true, result: "disqualified", winner_count: uniqueWinnerIds.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const prizePerWinner = uniqueWinnerIds.length === 2 ? prizeAmount / 2 : prizeAmount;

  // Update game status
  await supabase.from("games").update({ status: "won", winner_id: uniqueWinnerIds[0], auto_draw: false }).eq("id", "current");

  // Insert history & credit balances atomically per winner
  for (const wId of uniqueWinnerIds) {
    await supabase.from("game_history").insert({
      game_id: "current", winner_id: wId, pattern: game?.pattern || "Full House",
      players_count: playersCount || 0, prize: prizePerWinner, drawn_numbers: drawnNumbersList,
    });
    const { data: wp } = await supabase.from("profiles").select("balance").eq("id", wId).single();
    if (wp) {
      await supabase.from("profiles").update({ balance: wp.balance + prizePerWinner }).eq("id", wId);
    }
  }

  await supabase.from("game_numbers").delete().eq("game_id", "current");

  return new Response(JSON.stringify({
    ok: true, result: "won", winner_count: uniqueWinnerIds.length,
    prize_per_winner: prizePerWinner, winner_ids: uniqueWinnerIds,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
