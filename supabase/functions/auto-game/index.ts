import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Auto-game lifecycle: After a game ends (status=won), wait 60 seconds then
 * start a new game automatically with incremented session number.
 * Triggered by cron every minute.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Get current game
    const { data: game } = await supabase
      .from("games")
      .select("*")
      .eq("id", "current")
      .maybeSingle();

    if (!game) {
      // No game exists — create initial game
      await supabase.from("games").upsert({
        id: "current",
        status: "buying",
        pattern: "Full House",
        session_number: 1,
        draw_speed: 5,
        cartela_price: 10,
        prize_amount: 0,
        auto_draw: false,
        winner_id: null,
      });
      return new Response(JSON.stringify({ ok: true, action: "created_initial" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If game is won or stopped, start new game after countdown
    if (game.status === "won" || game.status === "stopped" || game.status === "waiting") {
      const nextSession = (game.session_number || 1) + 1;

      // Clean up
      await Promise.all([
        supabase.from("game_numbers").delete().eq("game_id", "current"),
        supabase.from("bingo_claims").delete().eq("game_id", "current"),
        supabase.from("cartelas").update({ is_used: false, owner_id: null }).eq("is_used", true),
      ]);

      // Set to buying
      await supabase.from("games").upsert({
        id: "current",
        status: "buying",
        pattern: game.pattern || "Full House",
        session_number: nextSession,
        draw_speed: 5,
        cartela_price: game.cartela_price || 10,
        prize_amount: 0,
        auto_draw: false,
        winner_id: null,
      });

      return new Response(JSON.stringify({ ok: true, action: "new_game", session: nextSession }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If buying phase has been going on for >2 minutes, start the game
    if (game.status === "buying") {
      // Count bought cartelas
      const { count } = await supabase
        .from("cartelas")
        .select("id", { count: "exact", head: true })
        .eq("is_used", true)
        .not("owner_id", "is", null);

      const boughtCount = count || 0;

      if (boughtCount > 0) {
        // Start the game
        await supabase.from("games").update({
          status: "active",
          auto_draw: true,
          prize_amount: boughtCount * (game.cartela_price || 10),
        }).eq("id", "current");

        // Invoke auto-draw
        fetch(`${SUPABASE_URL}/functions/v1/auto-draw`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
        }).catch(() => {});

        return new Response(JSON.stringify({ ok: true, action: "started", bought: boughtCount }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true, action: "waiting_for_players" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, action: "no_action", status: game.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
