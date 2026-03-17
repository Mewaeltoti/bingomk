import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type PatternName =
  | "Full House"
  | "Single Line H"
  | "Single Line V"
  | "Single Line D"
  | "Two Lines"
  | "Four Corners"
  | "X Shape"
  | "T Shape"
  | "L Shape"
  | "Cross"
  | "Frame"
  | "Postage Stamp"
  | "Small Diamond"
  | "Arrow Up"
  | "Pyramid"
  | "U Shape";

function isMarked(numbers: number[][], markedNumbers: Set<number>, row: number, col: number) {
  if (row === 2 && col === 2) return true;
  return markedNumbers.has(numbers[row]?.[col] ?? -1);
}

function countCompleteLines(numbers: number[][], markedNumbers: Set<number>) {
  let lines = 0;
  for (let r = 0; r < 5; r++) {
    let ok = true;
    for (let c = 0; c < 5; c++) if (!isMarked(numbers, markedNumbers, r, c)) ok = false;
    if (ok) lines += 1;
  }
  for (let c = 0; c < 5; c++) {
    let ok = true;
    for (let r = 0; r < 5; r++) if (!isMarked(numbers, markedNumbers, r, c)) ok = false;
    if (ok) lines += 1;
  }
  let d1 = true;
  let d2 = true;
  for (let i = 0; i < 5; i++) {
    if (!isMarked(numbers, markedNumbers, i, i)) d1 = false;
    if (!isMarked(numbers, markedNumbers, i, 4 - i)) d2 = false;
  }
  if (d1) lines += 1;
  if (d2) lines += 1;
  return lines;
}

function checkWin(numbers: number[][], markedNumbers: Set<number>, pattern: PatternName): boolean {
  switch (pattern) {
    case "Full House":
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (!isMarked(numbers, markedNumbers, r, c)) return false;
      return true;
    case "Single Line H":
      for (let r = 0; r < 5; r++) {
        let ok = true;
        for (let c = 0; c < 5; c++) if (!isMarked(numbers, markedNumbers, r, c)) ok = false;
        if (ok) return true;
      }
      return false;
    case "Single Line V":
      for (let c = 0; c < 5; c++) {
        let ok = true;
        for (let r = 0; r < 5; r++) if (!isMarked(numbers, markedNumbers, r, c)) ok = false;
        if (ok) return true;
      }
      return false;
    case "Single Line D": {
      let d1 = true;
      let d2 = true;
      for (let i = 0; i < 5; i++) {
        if (!isMarked(numbers, markedNumbers, i, i)) d1 = false;
        if (!isMarked(numbers, markedNumbers, i, 4 - i)) d2 = false;
      }
      return d1 || d2;
    }
    case "Two Lines":
      return countCompleteLines(numbers, markedNumbers) >= 2;
    case "Four Corners":
      return isMarked(numbers, markedNumbers, 0, 0) && isMarked(numbers, markedNumbers, 0, 4) && isMarked(numbers, markedNumbers, 4, 0) && isMarked(numbers, markedNumbers, 4, 4);
    case "X Shape":
      for (let i = 0; i < 5; i++) {
        if (!isMarked(numbers, markedNumbers, i, i) || !isMarked(numbers, markedNumbers, i, 4 - i)) return false;
      }
      return true;
    case "T Shape":
      for (let c = 0; c < 5; c++) if (!isMarked(numbers, markedNumbers, 0, c)) return false;
      for (let r = 0; r < 5; r++) if (!isMarked(numbers, markedNumbers, r, 2)) return false;
      return true;
    case "L Shape":
      for (let r = 0; r < 5; r++) if (!isMarked(numbers, markedNumbers, r, 0)) return false;
      for (let c = 0; c < 5; c++) if (!isMarked(numbers, markedNumbers, 4, c)) return false;
      return true;
    case "Cross":
      for (let c = 0; c < 5; c++) if (!isMarked(numbers, markedNumbers, 2, c)) return false;
      for (let r = 0; r < 5; r++) if (!isMarked(numbers, markedNumbers, r, 2)) return false;
      return true;
    case "Frame":
      for (let i = 0; i < 5; i++) {
        if (!isMarked(numbers, markedNumbers, 0, i)) return false;
        if (!isMarked(numbers, markedNumbers, 4, i)) return false;
        if (!isMarked(numbers, markedNumbers, i, 0)) return false;
        if (!isMarked(numbers, markedNumbers, i, 4)) return false;
      }
      return true;
    case "Postage Stamp": {
      const corners = [[0, 0], [0, 3], [3, 0], [3, 3]];
      return corners.some(([sr, sc]) =>
        isMarked(numbers, markedNumbers, sr, sc) &&
        isMarked(numbers, markedNumbers, sr, sc + 1) &&
        isMarked(numbers, markedNumbers, sr + 1, sc) &&
        isMarked(numbers, markedNumbers, sr + 1, sc + 1)
      );
    }
    case "Small Diamond":
      return (
        isMarked(numbers, markedNumbers, 0, 2) &&
        isMarked(numbers, markedNumbers, 1, 1) &&
        isMarked(numbers, markedNumbers, 1, 3) &&
        isMarked(numbers, markedNumbers, 2, 0) &&
        isMarked(numbers, markedNumbers, 2, 4) &&
        isMarked(numbers, markedNumbers, 3, 1) &&
        isMarked(numbers, markedNumbers, 3, 3) &&
        isMarked(numbers, markedNumbers, 4, 2)
      );
    case "Arrow Up":
      for (let r = 0; r < 5; r++) if (!isMarked(numbers, markedNumbers, r, 2)) return false;
      return isMarked(numbers, markedNumbers, 1, 1) && isMarked(numbers, markedNumbers, 1, 3) && isMarked(numbers, markedNumbers, 0, 0) && isMarked(numbers, markedNumbers, 0, 4);
    case "Pyramid":
      return (
        isMarked(numbers, markedNumbers, 0, 2) &&
        isMarked(numbers, markedNumbers, 1, 1) &&
        isMarked(numbers, markedNumbers, 1, 2) &&
        isMarked(numbers, markedNumbers, 1, 3) &&
        isMarked(numbers, markedNumbers, 2, 0) &&
        isMarked(numbers, markedNumbers, 2, 1) &&
        isMarked(numbers, markedNumbers, 2, 2) &&
        isMarked(numbers, markedNumbers, 2, 3) &&
        isMarked(numbers, markedNumbers, 2, 4)
      );
    case "U Shape":
      for (let r = 0; r < 5; r++) if (!isMarked(numbers, markedNumbers, r, 0) || !isMarked(numbers, markedNumbers, r, 4)) return false;
      for (let c = 0; c < 5; c++) if (!isMarked(numbers, markedNumbers, 4, c)) return false;
      return true;
    default:
      return false;
  }
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
    const requesterId = claimsData.claims.sub;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", requesterId).eq("role", "admin").maybeSingle();

    const { action, claim_id, is_valid, cartela_id } = await req.json();

    if (action === "player_claim") {
      return await handlePlayerClaim(supabase, requesterId, cartela_id);
    }

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    if (action === "verify_single") {
      return await verifySingle(supabase, claim_id, is_valid);
    }
    if (action === "verify_all") {
      return await verifyAll(supabase);
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});

async function handlePlayerClaim(supabase: any, userId: string, cartelaId: number) {
  if (!cartelaId) {
    return new Response(JSON.stringify({ error: "Missing cartela" }), { status: 400, headers: corsHeaders });
  }

  const { data: game } = await supabase.from("games").select("status, pattern").eq("id", "current").single();
  if (!game || game.status !== "active") {
    return new Response(JSON.stringify({ error: "Game is not active" }), { status: 400, headers: corsHeaders });
  }

  const { data: existing } = await supabase
    .from("bingo_claims")
    .select("id")
    .eq("game_id", "current")
    .eq("user_id", userId)
    .eq("cartela_id", cartelaId)
    .maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({ error: "Cartela already claimed" }), { status: 409, headers: corsHeaders });
  }

  const [{ data: cartela }, { data: nums }] = await Promise.all([
    supabase.from("cartelas").select("id, owner_id, numbers").eq("id", cartelaId).maybeSingle(),
    supabase.from("game_numbers").select("number").eq("game_id", "current"),
  ]);

  if (!cartela || cartela.owner_id !== userId) {
    return new Response(JSON.stringify({ error: "Cartela not owned by player" }), { status: 403, headers: corsHeaders });
  }

  await supabase.from("games").update({ auto_draw: false }).eq("id", "current");
  await supabase.from("bingo_claims").insert({ game_id: "current", user_id: userId, cartela_id: cartelaId });

  const drawnSet = new Set((nums || []).map((n: any) => n.number));
  const valid = checkWin(cartela.numbers as number[][], drawnSet, (game.pattern || "Full House") as PatternName);
  await supabase.from("bingo_claims").update({ is_valid: valid }).eq("game_id", "current").eq("user_id", userId).eq("cartela_id", cartelaId);

  if (!valid) {
    const { data: pending } = await supabase.from("bingo_claims").select("id").eq("game_id", "current").is("is_valid", null);
    if (!pending || pending.length === 0) {
      await supabase.from("games").update({ auto_draw: true }).eq("id", "current");
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/auto-draw`, {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
      }).catch(() => {});
    }
    return new Response(JSON.stringify({ ok: true, result: "invalid" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return await resolveGame(supabase);
}

async function verifySingle(supabase: any, claimId: string, isValid: boolean) {
  if (isValid) {
    await supabase.from("bingo_claims").update({ is_valid: true }).eq("id", claimId);
  } else {
    await supabase.from("bingo_claims").update({ is_valid: false }).eq("id", claimId);
    const { data: pending } = await supabase.from("bingo_claims").select("id").eq("game_id", "current").is("is_valid", null);
    if (!pending || pending.length === 0) {
      await supabase.from("games").update({ auto_draw: true }).eq("id", "current");
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/auto-draw`, {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
      }).catch(() => {});
    }
    return new Response(JSON.stringify({ ok: true, result: "invalid" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: pending } = await supabase.from("bingo_claims").select("id").eq("game_id", "current").is("is_valid", null);
  if (pending && pending.length > 0) {
    return new Response(JSON.stringify({ ok: true, result: "valid_pending_remaining", remaining: pending.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

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
  const pattern = (gameData?.pattern || "Full House") as PatternName;

  const validClaimUserIds: string[] = [];
  for (const claim of pendingClaims) {
    const { data: cartela } = await supabase.from("cartelas").select("numbers").eq("id", claim.cartela_id).single();
    const valid = cartela ? checkWin(cartela.numbers as number[][], drawnSet, pattern) : false;
    await supabase.from("bingo_claims").update({ is_valid: valid }).eq("id", claim.id);
    if (valid) validClaimUserIds.push(claim.user_id);
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
  const [{ data: allClaims }, { data: game }, { data: nums }, { count: playersCount }] = await Promise.all([
    supabase.from("bingo_claims").select("*").eq("game_id", "current").eq("is_valid", true),
    supabase.from("games").select("*").eq("id", "current").single(),
    supabase.from("game_numbers").select("number").eq("game_id", "current"),
    supabase.from("cartelas").select("owner_id", { count: "exact", head: true }).eq("is_used", true).not("owner_id", "is", null),
  ]);

  const uniqueWinnerIds = [...new Set((allClaims || []).map((c: any) => c.user_id))];
  const prizeAmount = game?.prize_amount || 0;
  const drawnNumbersList = (nums || []).map((n: any) => n.number);

  if (uniqueWinnerIds.length >= 3) {
    await supabase.from("games").update({ status: "disqualified", winner_id: null, auto_draw: false }).eq("id", "current");
    return new Response(JSON.stringify({ ok: true, result: "disqualified", winner_count: uniqueWinnerIds.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const prizePerWinner = uniqueWinnerIds.length === 2 ? prizeAmount / 2 : prizeAmount;
  await supabase.from("games").update({ status: "won", winner_id: uniqueWinnerIds[0], auto_draw: false }).eq("id", "current");

  for (const winnerId of uniqueWinnerIds) {
    await supabase.from("game_history").insert({
      game_id: `session-${game?.session_number || 1}`,
      session_number: game?.session_number || 1,
      winner_id: winnerId,
      pattern: game?.pattern || "Full House",
      players_count: playersCount || 0,
      prize: prizePerWinner,
      drawn_numbers: drawnNumbersList,
      winning_number: drawnNumbersList.at(-1) ?? null,
      ended_status: "won",
    });
    const { data: profile } = await supabase.from("profiles").select("balance").eq("id", winnerId).single();
    if (profile) {
      await supabase.from("profiles").update({ balance: profile.balance + prizePerWinner }).eq("id", winnerId);
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    result: "won",
    winner_count: uniqueWinnerIds.length,
    prize_per_winner: prizePerWinner,
    winner_ids: uniqueWinnerIds,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}