import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PatternName =
  | "Full House" | "Single Line H" | "Single Line V" | "Single Line D"
  | "Two Lines" | "Four Corners" | "X Shape" | "T Shape" | "L Shape"
  | "Cross" | "Frame" | "Postage Stamp" | "Small Diamond" | "Arrow Up"
  | "Pyramid" | "U Shape";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function checkWin(numbers: number[][], markedNumbers: Set<number>, pattern: PatternName): boolean {
  const isMarked = (row: number, col: number) => {
    if (row === 2 && col === 2) return true;
    return markedNumbers.has(numbers[row]?.[col] ?? -1);
  };
  switch (pattern) {
    case "Full House":
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (!isMarked(r, c)) return false;
      return true;
    case "Single Line H":
      for (let r = 0; r < 5; r++) { let ok = true; for (let c = 0; c < 5; c++) if (!isMarked(r, c)) ok = false; if (ok) return true; }
      return false;
    case "Single Line V":
      for (let c = 0; c < 5; c++) { let ok = true; for (let r = 0; r < 5; r++) if (!isMarked(r, c)) ok = false; if (ok) return true; }
      return false;
    case "Single Line D": {
      let d1 = true, d2 = true;
      for (let i = 0; i < 5; i++) { if (!isMarked(i, i)) d1 = false; if (!isMarked(i, 4 - i)) d2 = false; }
      return d1 || d2;
    }
    case "Two Lines": {
      let lines = 0;
      for (let r = 0; r < 5; r++) { let ok = true; for (let c = 0; c < 5; c++) if (!isMarked(r, c)) ok = false; if (ok) lines++; }
      for (let c = 0; c < 5; c++) { let ok = true; for (let r = 0; r < 5; r++) if (!isMarked(r, c)) ok = false; if (ok) lines++; }
      let d1 = true, d2 = true;
      for (let i = 0; i < 5; i++) { if (!isMarked(i, i)) d1 = false; if (!isMarked(i, 4 - i)) d2 = false; }
      if (d1) lines++; if (d2) lines++;
      return lines >= 2;
    }
    case "Four Corners": return isMarked(0, 0) && isMarked(0, 4) && isMarked(4, 0) && isMarked(4, 4);
    case "X Shape":
      for (let i = 0; i < 5; i++) { if (!isMarked(i, i) || !isMarked(i, 4 - i)) return false; }
      return true;
    case "T Shape":
      for (let c = 0; c < 5; c++) if (!isMarked(0, c)) return false;
      for (let r = 0; r < 5; r++) if (!isMarked(r, 2)) return false;
      return true;
    case "L Shape":
      for (let r = 0; r < 5; r++) if (!isMarked(r, 0)) return false;
      for (let c = 0; c < 5; c++) if (!isMarked(4, c)) return false;
      return true;
    case "Cross":
      for (let i = 0; i < 5; i++) { if (!isMarked(2, i) || !isMarked(i, 2)) return false; }
      return true;
    case "Frame":
      for (let i = 0; i < 5; i++) { if (!isMarked(0, i) || !isMarked(4, i) || !isMarked(i, 0) || !isMarked(i, 4)) return false; }
      return true;
    case "Postage Stamp": {
      const corners = [[0, 0], [0, 3], [3, 0], [3, 3]];
      return corners.some(([r, c]) => isMarked(r, c) && isMarked(r, c + 1) && isMarked(r + 1, c) && isMarked(r + 1, c + 1));
    }
    case "Small Diamond":
      return isMarked(0, 2) && isMarked(1, 1) && isMarked(1, 3) && isMarked(2, 0) && isMarked(2, 4) && isMarked(3, 1) && isMarked(3, 3) && isMarked(4, 2);
    case "Arrow Up":
      for (let r = 0; r < 5; r++) if (!isMarked(r, 2)) return false;
      return isMarked(1, 1) && isMarked(1, 3) && isMarked(0, 0) && isMarked(0, 4);
    case "Pyramid":
      return isMarked(0, 2) && isMarked(1, 1) && isMarked(1, 2) && isMarked(1, 3) && isMarked(2, 0) && isMarked(2, 1) && isMarked(2, 2) && isMarked(2, 3) && isMarked(2, 4);
    case "U Shape":
      for (let r = 0; r < 5; r++) if (!isMarked(r, 0) || !isMarked(r, 4)) return false;
      for (let c = 0; c < 5; c++) if (!isMarked(4, c)) return false;
      return true;
    default: return false;
  }
}

async function archiveAndFinalizeGame(supabase: any, payload: {
  winnerId: string | null;
  winnerCartela: number[][] | null;
  winningNumber: number | null;
  endedStatus: string;
  pattern: string;
  prize: number;
  playersCount: number;
  sessionNumber: number;
  drawnNumbersList: number[];
}) {
  await supabase.from("game_history").insert({
    game_id: `session-${payload.sessionNumber}`,
    winner_id: payload.winnerId,
    pattern: payload.pattern,
    players_count: payload.playersCount,
    prize: payload.prize,
    drawn_numbers: payload.drawnNumbersList,
    session_number: payload.sessionNumber,
    winner_cartela: payload.winnerCartela,
    winning_number: payload.winningNumber,
    ended_status: payload.endedStatus,
  });
  await supabase.from("games").update({
    status: payload.endedStatus,
    winner_id: payload.winnerId,
    auto_draw: false,
  }).eq("id", "current");

  // Clean up drawn numbers after game ends
  await supabase.from("game_numbers").delete().eq("game_id", "current");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { action, claim_id, is_valid, cartela_id } = await req.json().catch(() => ({}));

    if (action === "verify_single" || action === "verify_all") {
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
      if (!roleData) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
      }
      if (action === "verify_single") return await verifySingle(supabase, claim_id, is_valid);
      return await verifyAll(supabase);
    }

    if (action === "claim") {
      return await submitClaim(supabase, userId, cartela_id);
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});

async function submitClaim(supabase: any, userId: string, cartelaId: number) {
  const { data: game } = await supabase.from("games").select("pattern, prize_amount, session_number, status").eq("id", "current").single();
  if (!game || game.status !== "active") {
    return new Response(JSON.stringify({ error: "Game is not active" }), { status: 400, headers: corsHeaders });
  }

  const { data: cartela } = await supabase.from("cartelas").select("id, owner_id, numbers, banned_for_game").eq("id", cartelaId).maybeSingle();
  if (!cartela || cartela.owner_id !== userId) {
    return new Response(JSON.stringify({ error: "Cartela not found" }), { status: 404, headers: corsHeaders });
  }
  if (cartela.banned_for_game) {
    return new Response(JSON.stringify({ error: "This cartela is banned for this game" }), { status: 400, headers: corsHeaders });
  }

  // Check if already claimed this cartela
  const { data: existingClaim } = await supabase.from("bingo_claims").select("id").eq("game_id", "current").eq("cartela_id", cartelaId).maybeSingle();
  if (existingClaim) {
    return new Response(JSON.stringify({ error: "Already claimed this cartela" }), { status: 400, headers: corsHeaders });
  }

  const { data: nums } = await supabase.from("game_numbers").select("number").eq("game_id", "current").order("id", { ascending: true });
  const drawnNumbersList = (nums || []).map((n: { number: number }) => n.number);
  const drawnSet = new Set(drawnNumbersList);
  const drawnCount = drawnNumbersList.length;

  // Timing check: claims must be on same drawn count as first pending/valid claim
  const { data: existingClaims } = await supabase.from("bingo_claims").select("user_id, strike_count").eq("game_id", "current").or("is_valid.is.null,is_valid.eq.true");
  if (existingClaims && existingClaims.length > 0) {
    const firstClaimDrawnCount = (existingClaims[0] as any).strike_count;
    if (firstClaimDrawnCount > 0 && drawnCount > firstClaimDrawnCount) {
      return new Response(JSON.stringify({ error: "Too late — numbers were drawn after the first claim" }), { status: 400, headers: corsHeaders });
    }
  }

  const valid = checkWin(cartela.numbers as number[][], drawnSet, (game.pattern || "Full House") as PatternName);

  if (!valid) {
    await supabase.from("bingo_claims").insert({
      game_id: "current", user_id: userId, cartela_id: cartelaId, is_valid: false, strike_count: drawnCount,
    });
    await supabase.from("cartelas").update({ banned_for_game: true }).eq("id", cartelaId).eq("owner_id", userId);
    return new Response(JSON.stringify({ ok: true, result: "invalid_banned", cartela_id: cartelaId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Valid — pause draw & submit for admin
  await supabase.from("games").update({ auto_draw: false }).eq("id", "current");
  await supabase.from("bingo_claims").insert({
    game_id: "current", user_id: userId, cartela_id: cartelaId, is_valid: null, strike_count: drawnCount,
  });

  return new Response(JSON.stringify({ ok: true, result: "pending_review", cartela_id: cartelaId, drawn_count: drawnCount }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Admin verifies a single claim — SINGLE WINNER ONLY (no split)
 */
async function verifySingle(supabase: any, claimId: string, isValid: boolean) {
  const { data: claim } = await supabase.from("bingo_claims").select("*").eq("id", claimId).single();
  if (!claim) {
    return new Response(JSON.stringify({ error: "Claim not found" }), { status: 404, headers: corsHeaders });
  }

  if (!isValid) {
    await supabase.from("bingo_claims").update({ is_valid: false }).eq("id", claimId);
    if (claim.cartela_id) {
      await supabase.from("cartelas").update({ banned_for_game: true }).eq("id", claim.cartela_id);
    }
    const { data: remaining } = await supabase.from("bingo_claims").select("id").eq("game_id", "current").is("is_valid", null);
    if (!remaining || remaining.length === 0) {
      await supabase.from("games").update({ auto_draw: true, draw_speed: 8 }).eq("id", "current");
      fetch(`${SUPABASE_URL}/functions/v1/auto-draw`, {
        method: "POST", headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      }).catch(() => {});
      return new Response(JSON.stringify({ ok: true, result: "no_winners_resume", remaining: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true, result: "rejected", remaining: remaining.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Admin approves — this user wins (all their valid claims count, single winner)
  await supabase.from("bingo_claims").update({ is_valid: true }).eq("id", claimId);

  // Mark all other pending claims as rejected (only one winner allowed)
  const { data: otherPending } = await supabase.from("bingo_claims").select("id, cartela_id").eq("game_id", "current").is("is_valid", null);
  for (const p of (otherPending || [])) {
    await supabase.from("bingo_claims").update({ is_valid: false }).eq("id", p.id);
  }

  const winnerId = claim.user_id;
  const { data: game } = await supabase.from("games").select("pattern, prize_amount, session_number").eq("id", "current").single();
  const { data: nums } = await supabase.from("game_numbers").select("number").eq("game_id", "current").order("id", { ascending: true });
  const drawnNumbersList = (nums || []).map((n: any) => n.number);
  const { count: playersCount } = await supabase.from("cartelas").select("owner_id", { count: "exact", head: true }).eq("is_used", true).not("owner_id", "is", null);

  const prizeAmount = Number(game?.prize_amount || 0);

  // Credit winner wallet
  const { data: profile } = await supabase.from("profiles").select("balance").eq("id", winnerId).single();
  if (profile) {
    await supabase.from("profiles").update({ balance: Number(profile.balance || 0) + prizeAmount }).eq("id", winnerId);
  }

  // Get winner cartela for broadcast
  let winnerCartela = null;
  if (claim.cartela_id) {
    const { data: c } = await supabase.from("cartelas").select("numbers").eq("id", claim.cartela_id).single();
    if (c) winnerCartela = c.numbers;
  }

  await archiveAndFinalizeGame(supabase, {
    winnerId,
    winnerCartela,
    winningNumber: drawnNumbersList[drawnNumbersList.length - 1] ?? null,
    endedStatus: "won",
    pattern: game?.pattern || "Full House",
    prize: prizeAmount,
    playersCount: playersCount || 0,
    sessionNumber: game?.session_number || 1,
    drawnNumbersList,
  });

  return new Response(JSON.stringify({
    ok: true, result: "won", winner_id: winnerId, prize: prizeAmount, winner_cartela: winnerCartela,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

/**
 * Admin verifies all pending claims — single winner only
 */
async function verifyAll(supabase: any) {
  const { data: pendingClaims } = await supabase.from("bingo_claims").select("id, cartela_id, user_id").eq("game_id", "current").is("is_valid", null);
  if (!pendingClaims || pendingClaims.length === 0) {
    return new Response(JSON.stringify({ ok: true, result: "no_pending" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: game } = await supabase.from("games").select("pattern, prize_amount, session_number").eq("id", "current").single();
  const { data: nums } = await supabase.from("game_numbers").select("number").eq("game_id", "current").order("id", { ascending: true });
  const drawnNumbersList = (nums || []).map((n: any) => n.number);
  const drawnSet = new Set(drawnNumbersList);
  const { count: playersCount } = await supabase.from("cartelas").select("owner_id", { count: "exact", head: true }).eq("is_used", true).not("owner_id", "is", null);

  let winnerId: string | null = null;
  let winnerCartela: any = null;

  for (const claim of pendingClaims) {
    const { data: cartela } = await supabase.from("cartelas").select("numbers").eq("id", claim.cartela_id).single();
    if (!cartela) {
      await supabase.from("bingo_claims").update({ is_valid: false }).eq("id", claim.id);
      continue;
    }
    const valid = checkWin(cartela.numbers as number[][], drawnSet, (game?.pattern || "Full House") as PatternName);
    if (valid && !winnerId) {
      // First valid claim wins
      await supabase.from("bingo_claims").update({ is_valid: true }).eq("id", claim.id);
      winnerId = claim.user_id;
      winnerCartela = cartela.numbers;
    } else {
      await supabase.from("bingo_claims").update({ is_valid: false }).eq("id", claim.id);
      if (!valid) {
        await supabase.from("cartelas").update({ banned_for_game: true }).eq("id", claim.cartela_id);
      }
    }
  }

  if (!winnerId) {
    await supabase.from("games").update({ auto_draw: true, draw_speed: 8 }).eq("id", "current");
    fetch(`${SUPABASE_URL}/functions/v1/auto-draw`, {
      method: "POST", headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    }).catch(() => {});
    return new Response(JSON.stringify({ ok: true, result: "no_winners_resume" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const prizeAmount = Number(game?.prize_amount || 0);

  // Credit winner
  const { data: profile } = await supabase.from("profiles").select("balance").eq("id", winnerId).single();
  if (profile) {
    await supabase.from("profiles").update({ balance: Number(profile.balance || 0) + prizeAmount }).eq("id", winnerId);
  }

  await archiveAndFinalizeGame(supabase, {
    winnerId,
    winnerCartela,
    winningNumber: drawnNumbersList[drawnNumbersList.length - 1] ?? null,
    endedStatus: "won",
    pattern: game?.pattern || "Full House",
    prize: prizeAmount,
    playersCount: playersCount || 0,
    sessionNumber: game?.session_number || 1,
    drawnNumbersList,
  });

  return new Response(JSON.stringify({
    ok: true, result: "won", winner_id: winnerId, prize: prizeAmount, winner_cartela: winnerCartela,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
