import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUYING_WINDOW_MS = 2 * 60 * 1000;
const NEXT_GAME_DELAY_MS = 60 * 1000;
const FIXED_DRAW_SPEED = 8;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: game } = await supabase
      .from("games")
      .select("*")
      .eq("id", "current")
      .maybeSingle();

    if (!game) {
      await supabase.from("games").insert({
        id: "current",
        status: "buying",
        pattern: "Full House",
        session_number: 1,
        draw_speed: FIXED_DRAW_SPEED,
        cartela_price: 10,
        prize_amount: 0,
        auto_draw: false,
        winner_id: null,
      });

      return new Response(JSON.stringify({ ok: true, action: "created_initial" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (game.status === "won" || game.status === "stopped" || game.status === "waiting" || game.status === "disqualified") {
      const { data: latestHistory } = await supabase
        .from("game_history")
        .select("created_at")
        .eq("session_number", game.session_number || 1)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const finishedAt = latestHistory?.created_at ? new Date(latestHistory.created_at).getTime() : Date.now();
      if (Date.now() - finishedAt < NEXT_GAME_DELAY_MS) {
        return new Response(JSON.stringify({ ok: true, action: "cooldown" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const nextSession = (game.session_number || 1) + 1;

      await Promise.all([
        supabase.from("game_numbers").delete().eq("game_id", "current"),
        supabase.from("bingo_claims").delete().eq("game_id", "current"),
        supabase.from("cartelas").update({ is_used: false, owner_id: null, banned_for_game: false }).or("is_used.eq.true,banned_for_game.eq.true"),
        supabase.from("games").delete().eq("id", "current"),
      ]);

      await supabase.from("games").insert({
        id: "current",
        status: "buying",
        pattern: game.pattern || "Full House",
        session_number: nextSession,
        draw_speed: FIXED_DRAW_SPEED,
        cartela_price: game.cartela_price || 10,
        prize_amount: game.prize_amount || 0,
        auto_draw: false,
        winner_id: null,
      });

      return new Response(JSON.stringify({ ok: true, action: "new_game", session: nextSession }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (game.status === "buying") {
      const buyingStartedAt = new Date(game.created_at).getTime();
      if (Date.now() - buyingStartedAt < BUYING_WINDOW_MS) {
        return new Response(JSON.stringify({ ok: true, action: "buying_window_open" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { count } = await supabase
        .from("cartelas")
        .select("id", { count: "exact", head: true })
        .eq("is_used", true)
        .not("owner_id", "is", null);

      const soldCount = count || 0;
      const prizeAmount = Number(game.prize_amount || 0);

      if (soldCount < 1) {
        return new Response(JSON.stringify({ ok: true, action: "waiting_for_sale" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (prizeAmount <= 0) {
        return new Response(JSON.stringify({ ok: true, action: "waiting_for_prize_pot" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("games").update({
        status: "active",
        auto_draw: true,
        draw_speed: FIXED_DRAW_SPEED,
      }).eq("id", "current");

      fetch(`${SUPABASE_URL}/functions/v1/auto-draw`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
      }).catch(() => {});

      return new Response(JSON.stringify({ ok: true, action: "started", sold: soldCount }), {
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