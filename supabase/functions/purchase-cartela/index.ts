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
    const { cartela_ids } = await req.json();

    if (!Array.isArray(cartela_ids) || cartela_ids.length === 0) {
      return new Response(JSON.stringify({ error: "No cartelas selected" }), { status: 400, headers: corsHeaders });
    }

    const uniqueIds = [...new Set(cartela_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
    if (uniqueIds.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid cartela selection" }), { status: 400, headers: corsHeaders });
    }

    const { data, error } = await supabase.rpc("purchase_cartelas_atomic", {
      p_user_id: userId,
      p_cartela_ids: uniqueIds,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message || "Purchase failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.ok) {
      const message = result?.error_message || "Purchase failed";
      const status = message === "Some cartelas are no longer available" ? 409 : message === "Insufficient balance" ? 400 : 403;
      return new Response(JSON.stringify({ error: message, need: result?.total_cost, have: result?.new_balance }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      purchased: result.purchased_count,
      cost: result.total_cost,
      new_balance: result.new_balance,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});