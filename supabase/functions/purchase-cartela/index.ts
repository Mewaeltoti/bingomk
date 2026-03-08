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
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Block admins
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (roleData) {
      return new Response(JSON.stringify({ error: "Admins cannot purchase cartelas" }), { status: 403, headers: corsHeaders });
    }

    const { cartela_ids } = await req.json();
    if (!Array.isArray(cartela_ids) || cartela_ids.length === 0) {
      return new Response(JSON.stringify({ error: "No cartelas selected" }), { status: 400, headers: corsHeaders });
    }

    // Check game status
    const { data: game } = await supabase.from("games").select("status, cartela_price").eq("id", "current").maybeSingle();
    const status = game?.status || "waiting";
    if (status !== "buying" && status !== "waiting") {
      return new Response(JSON.stringify({ error: "Cannot buy during active game" }), { status: 400, headers: corsHeaders });
    }

    const cartelaPrice = game?.cartela_price || 10;
    const cost = cartela_ids.length * cartelaPrice;

    // Check balance
    const { data: profile } = await supabase.from("profiles").select("balance").eq("id", userId).single();
    const balance = profile?.balance || 0;
    if (balance < cost) {
      return new Response(JSON.stringify({ error: "Insufficient balance", need: cost, have: balance }), { status: 400, headers: corsHeaders });
    }

    // Verify cartelas are available
    const { data: available } = await supabase.from("cartelas").select("id").in("id", cartela_ids).eq("is_used", false);
    if (!available || available.length !== cartela_ids.length) {
      return new Response(JSON.stringify({ error: "Some cartelas are no longer available" }), { status: 409, headers: corsHeaders });
    }

    // Atomic: assign cartelas + deduct balance
    const { error: updateError } = await supabase.from("cartelas").update({ is_used: true, owner_id: userId }).in("id", cartela_ids);
    if (updateError) {
      return new Response(JSON.stringify({ error: "Purchase failed" }), { status: 500, headers: corsHeaders });
    }

    await supabase.from("profiles").update({ balance: balance - cost }).eq("id", userId);

    return new Response(JSON.stringify({ ok: true, purchased: cartela_ids.length, cost, new_balance: balance - cost }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
