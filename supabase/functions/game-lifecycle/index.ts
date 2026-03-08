import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const { action, pattern, draw_speed, prize_amount, cartela_price } = await req.json();

    if (action === "new_game") {
      // Stop auto draw
      await supabase.from("games").update({ auto_draw: false }).eq("id", "current");

      // Clean up atomically
      await Promise.all([
        supabase.from("game_numbers").delete().eq("game_id", "current"),
        supabase.from("bingo_claims").delete().eq("game_id", "current"),
        supabase.from("cartelas").update({ is_used: false, owner_id: null }).eq("is_used", true),
      ]);

      // Set buying state
      await supabase.from("games").upsert({
        id: "current", pattern: pattern || "Full House", status: "buying",
        winner_id: null, draw_speed: draw_speed || 10, prize_amount: 0,
        cartela_price: cartela_price || 10, auto_draw: false,
      });

      return new Response(JSON.stringify({ ok: true, status: "buying" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "start_drawing") {
      // Count bought cartelas
      const { count } = await supabase.from("cartelas").select("id", { count: "exact", head: true }).eq("is_used", true).not("owner_id", "is", null);

      await supabase.from("games").update({
        status: "active", prize_amount: prize_amount || 0, auto_draw: true,
      }).eq("id", "current");

      // Invoke auto-draw
      fetch(`${SUPABASE_URL}/functions/v1/auto-draw`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      }).catch(() => {});

      return new Response(JSON.stringify({ ok: true, status: "active", bought: count || 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "pause") {
      await supabase.from("games").update({ auto_draw: false }).eq("id", "current");
      return new Response(JSON.stringify({ ok: true, status: "paused" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "resume") {
      await supabase.from("games").update({ auto_draw: true }).eq("id", "current");
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
