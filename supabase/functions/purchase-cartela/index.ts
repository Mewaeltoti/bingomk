import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { cartela_ids } = await req.json();
    if (!Array.isArray(cartela_ids) || cartela_ids.length === 0) {
      return new Response(JSON.stringify({ error: "No cartelas selected" }), { status: 400, headers: corsHeaders });
    }

    const { data: result, error: rpcError } = await supabase.rpc("purchase_cartelas_atomic", {
      p_user_id: userId,
      p_cartela_ids: cartela_ids,
    });

    if (rpcError) {
      return new Response(JSON.stringify({ error: rpcError.message || "Purchase failed" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const purchase = Array.isArray(result) ? result[0] : null;
    if (!purchase?.ok) {
      return new Response(
        JSON.stringify({
          error: purchase?.error_message || "Purchase failed",
          cost: purchase?.total_cost ?? 0,
          new_balance: purchase?.new_balance ?? 0,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        purchased: purchase.purchased_count,
        cost: purchase.total_cost,
        new_balance: purchase.new_balance,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});