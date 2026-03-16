import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const DRAW_INTERVAL_MS = 5_000; // Fixed 5-second interval
    const startTime = Date.now();
    const MAX_RUNTIME_MS = 50_000;

    while (Date.now() - startTime < MAX_RUNTIME_MS) {
      // Check game state
      const { data: game } = await supabase
        .from("games")
        .select("*")
        .eq("id", "current")
        .single();

      if (!game || game.status !== "active" || !game.auto_draw) {
        return new Response(
          JSON.stringify({ ok: true, reason: "stopped", drawn: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check for pending claims — pause if any
      const { data: pendingClaims } = await supabase
        .from("bingo_claims")
        .select("id")
        .eq("game_id", "current")
        .is("is_valid", null);

      if (pendingClaims && pendingClaims.length > 0) {
        await supabase
          .from("games")
          .update({ auto_draw: false })
          .eq("id", "current");
        return new Response(
          JSON.stringify({ ok: true, reason: "claim_pending" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get already drawn numbers
      const { data: drawnRows } = await supabase
        .from("game_numbers")
        .select("number")
        .eq("game_id", "current");

      const drawn = new Set((drawnRows || []).map((r: any) => r.number));

      if (drawn.size >= 75) {
        await supabase
          .from("games")
          .update({ auto_draw: false })
          .eq("id", "current");
        return new Response(
          JSON.stringify({ ok: true, reason: "all_drawn" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Pick random undrawn number
      let num: number;
      do {
        num = Math.floor(Math.random() * 75) + 1;
      } while (drawn.has(num));

      await supabase
        .from("game_numbers")
        .insert({ number: num, game_id: "current" });

      // Fixed 5-second draw interval
      await sleep(DRAW_INTERVAL_MS);
    }

    // Time's up — re-invoke self to continue
    const selfUrl = `${SUPABASE_URL}/functions/v1/auto-draw`;
    fetch(selfUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
    }).catch(() => {});

    return new Response(
      JSON.stringify({ ok: true, reason: "re-invoked" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
