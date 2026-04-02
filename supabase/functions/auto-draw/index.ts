import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DRAW_INTERVAL_MS = 8_000;
const MAX_RUNTIME_MS = 52_000;

// House wins ~60% of the time by generating multiple virtual cartelas
const HOUSE_CARTELA_COUNT = 3; // Number of virtual house cartelas

type PatternName = string;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Generate a valid bingo cartela (5x5 grid) */
function generateCartela(): number[][] {
  const cols: number[][] = [];
  for (let c = 0; c < 5; c++) {
    const min = c * 15 + 1;
    const max = c * 15 + 15;
    const pool: number[] = [];
    for (let n = min; n <= max; n++) pool.push(n);
    // Shuffle and pick 5
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    cols.push(pool.slice(0, 5));
  }
  // Build row-major grid
  const grid: number[][] = [];
  for (let r = 0; r < 5; r++) {
    grid.push(cols.map(col => col[r]));
  }
  grid[2][2] = 0; // Free space
  return grid;
}

function checkWin(numbers: number[][], markedNumbers: Set<number>, pattern: string): boolean {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const startTime = Date.now();

    // Get game info to know the pattern
    const { data: gameInfo } = await supabase
      .from("games")
      .select("pattern, prize_amount, session_number")
      .eq("id", "current")
      .maybeSingle();

    const pattern = gameInfo?.pattern || "Full House";

    // Generate house virtual cartelas
    const houseCartelas = Array.from({ length: HOUSE_CARTELA_COUNT }, () => generateCartela());

    while (Date.now() - startTime < MAX_RUNTIME_MS) {
      const { data: game } = await supabase
        .from("games")
        .select("id, status, auto_draw")
        .eq("id", "current")
        .maybeSingle();

      if (!game || game.status !== "active" || !game.auto_draw) {
        return new Response(JSON.stringify({ ok: true, reason: "stopped", drawn: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: pendingClaims } = await supabase
        .from("bingo_claims")
        .select("id")
        .eq("game_id", "current")
        .is("is_valid", null);

      if (pendingClaims && pendingClaims.length > 0) {
        await supabase.from("games").update({ auto_draw: false }).eq("id", "current");
        return new Response(JSON.stringify({ ok: true, reason: "claim_pending" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: drawnRows } = await supabase
        .from("game_numbers")
        .select("number")
        .eq("game_id", "current");

      const drawn = new Set((drawnRows || []).map((row: { number: number }) => row.number));

      if (drawn.size >= 75) {
        // All numbers drawn, no winner — house wins by default
        const drawnList = (drawnRows || []).map((row: { number: number }) => row.number);
        await supabase.from("game_history").insert({
          game_id: `session-${gameInfo?.session_number || 1}`,
          winner_id: null,
          pattern,
          players_count: 0,
          prize: 0,
          drawn_numbers: drawnList,
          session_number: gameInfo?.session_number || 1,
          winner_cartela: null,
          winning_number: drawnList[drawnList.length - 1] ?? null,
          ended_status: "house_win",
        });
        await supabase.from("games").update({ auto_draw: false, status: "won", winner_id: null }).eq("id", "current");
        // Cleanup after delay
        setTimeout(async () => {
          await Promise.all([
            supabase.from("game_numbers").delete().eq("game_id", "current"),
            supabase.from("bingo_claims").delete().eq("game_id", "current"),
            supabase.from("cartelas").update({ is_used: false, owner_id: null, banned_for_game: false }).or("is_used.eq.true,banned_for_game.eq.true"),
          ]);
        }, 35000);
        return new Response(JSON.stringify({ ok: true, reason: "all_drawn_house_win" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Draw a random number
      let num: number;
      do {
        num = Math.floor(Math.random() * 75) + 1;
      } while (drawn.has(num));

      const { error: insertError } = await supabase.from("game_numbers").insert({ number: num, game_id: "current" });
      if (insertError) {
        throw insertError;
      }

      // Add new number to drawn set for house check
      drawn.add(num);

      // Check if any house cartela wins
      const houseWon = houseCartelas.some(cartela => checkWin(cartela, drawn, pattern));

      if (houseWon) {
        // House wins — end game with no payout
        const { data: allNums } = await supabase.from("game_numbers").select("number").eq("game_id", "current").order("id", { ascending: true });
        const drawnList = (allNums || []).map((n: any) => n.number);
        const { count: playersCount } = await supabase.from("cartelas").select("owner_id", { count: "exact", head: true }).eq("is_used", true).not("owner_id", "is", null);

        const winningHouseCartela = houseCartelas.find(c => checkWin(c, drawn, pattern))!;

        await supabase.from("game_history").insert({
          game_id: `session-${gameInfo?.session_number || 1}`,
          winner_id: null,
          pattern,
          players_count: playersCount || 0,
          prize: 0,
          drawn_numbers: drawnList,
          session_number: gameInfo?.session_number || 1,
          winner_cartela: winningHouseCartela,
          winning_number: num,
          ended_status: "won",
        });

        await supabase.from("games").update({
          status: "won",
          winner_id: null,
          auto_draw: false,
        }).eq("id", "current");

        // Cleanup after delay
        setTimeout(async () => {
          await Promise.all([
            supabase.from("game_numbers").delete().eq("game_id", "current"),
            supabase.from("bingo_claims").delete().eq("game_id", "current"),
            supabase.from("cartelas").update({ is_used: false, owner_id: null, banned_for_game: false }).or("is_used.eq.true,banned_for_game.eq.true"),
          ]);
        }, 35000);

        return new Response(JSON.stringify({ ok: true, reason: "house_win" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await sleep(DRAW_INTERVAL_MS);
    }

    // Re-invoke self for continuation
    fetch(`${SUPABASE_URL}/functions/v1/auto-draw`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
    }).catch(() => {});

    return new Response(JSON.stringify({ ok: true, reason: "re-invoked" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
