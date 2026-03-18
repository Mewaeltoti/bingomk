import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIXED_DRAW_SPEED = 8;
const HOUSE_PAYOUT_RATIO = 0.8;

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
    const adminId = claimsData.claims.sub;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", adminId).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const { action, pattern, cartela_price } = await req.json();

    if (action === "new_game") {
      await supabase.from("games").delete().eq("id", "current");

      const { data: currentHistory } = await supabase
        .from("game_history")
        .select("session_number")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // First session starts random (100-999), then increments
      let nextSession: number;
      if (currentHistory && (currentHistory as any).session_number) {
        nextSession = ((currentHistory as any).session_number || 0) + 1;
      } else {
        nextSession = Math.floor(Math.random() * 900) + 100;
      }

      await Promise.all([
        supabase.from("game_numbers").delete().eq("game_id", "current"),
        supabase.from("bingo_claims").delete().eq("game_id", "current"),
        supabase.from("cartelas").update({ is_used: false, owner_id: null, banned_for_game: false }).or("is_used.eq.true,banned_for_game.eq.true"),
      ]);

      await supabase.from("games").insert({
        id: "current",
        pattern: pattern || "Full House",
        status: "buying",
        winner_id: null,
        draw_speed: FIXED_DRAW_SPEED,
        prize_amount: 0,
        cartela_price: cartela_price || 10,
        auto_draw: false,
        session_number: nextSession,
      });

      return new Response(JSON.stringify({ ok: true, status: "buying", session: nextSession }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "start_drawing") {
      const { count } = await supabase.from("cartelas").select("id", { count: "exact", head: true }).eq("is_used", true).not("owner_id", "is", null);
      const soldCount = count || 0;
      
      // Allow starting even with 0 sold (admin decides when to start)
      // But calculate prize from actual sales
      const { data: currentGame } = await supabase.from("games").select("cartela_price").eq("id", "current").single();
      const price = Number(currentGame?.cartela_price || cartela_price || 10);
      const prize = Number((soldCount * price * HOUSE_PAYOUT_RATIO).toFixed(2));

      await supabase.from("games").update({
        status: "active",
        prize_amount: prize,
        auto_draw: true,
        draw_speed: FIXED_DRAW_SPEED,
      }).eq("id", "current");

      fetch(`${SUPABASE_URL}/functions/v1/auto-draw`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      }).catch(() => {});

      return new Response(JSON.stringify({ ok: true, status: "active", sold: soldCount, prize_amount: prize }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "pause") {
      await supabase.from("games").update({ auto_draw: false }).eq("id", "current");
      return new Response(JSON.stringify({ ok: true, status: "paused" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "resume") {
      await supabase.from("games").update({ auto_draw: true, draw_speed: FIXED_DRAW_SPEED }).eq("id", "current");
      fetch(`${SUPABASE_URL}/functions/v1/auto-draw`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      }).catch(() => {});
      return new Response(JSON.stringify({ ok: true, status: "resumed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "stop") {
      await supabase.from("games").update({ status: "stopped", auto_draw: false }).eq("id", "current");
      return new Response(JSON.stringify({ ok: true, status: "stopped" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
