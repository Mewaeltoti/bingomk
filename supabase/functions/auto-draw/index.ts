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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const startTime = Date.now();

    const { data: gameInfo } = await supabase
      .from("games")
      .select("pattern, prize_amount, session_number")
      .eq("id", "current")
      .maybeSingle();

    const pattern = gameInfo?.pattern || "Full House";

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
        // All numbers drawn, no winner — close game with no payout
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
          ended_status: "no_winner",
        });
        await supabase.from("games").update({ auto_draw: false, status: "won", winner_id: null }).eq("id", "current");
        setTimeout(async () => {
          await Promise.all([
            supabase.from("game_numbers").delete().eq("game_id", "current"),
            supabase.from("bingo_claims").delete().eq("game_id", "current"),
            supabase.from("cartelas").update({ is_used: false, owner_id: null, banned_for_game: false }).or("is_used.eq.true,banned_for_game.eq.true"),
          ]);
        }, 35000);
        return new Response(JSON.stringify({ ok: true, reason: "all_drawn_no_winner" }), {
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

      await sleep(DRAW_INTERVAL_MS);
    }

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
