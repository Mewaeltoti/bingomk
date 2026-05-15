import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await userClient.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const adminId = claimsData.claims.sub;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", adminId).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { type, id, action, user_id, amount } = await req.json();
    // type: "deposit" | "withdrawal"
    // action: "approved" | "rejected"

    if (type === "deposit") {
      await supabase.from("deposits").update({ status: action, reviewed_by: adminId }).eq("id", id);
      if (action === "approved") {
        const { data: profile } = await supabase.from("profiles").select("balance").eq("id", user_id).single();
        const bal = profile?.balance || 0;
        await supabase.from("profiles").update({ balance: bal + amount }).eq("id", user_id);
      }
      return new Response(JSON.stringify({ ok: true, action }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (type === "withdrawal") {
      if (action === "approved") {
        const { data: profile } = await supabase.from("profiles").select("balance").eq("id", user_id).single();
        const bal = profile?.balance || 0;
        if (bal < amount) {
          return new Response(JSON.stringify({ error: "Insufficient balance" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        await supabase.from("profiles").update({ balance: bal - amount }).eq("id", user_id);
      }
      await supabase.from("withdrawals").update({ status: action, reviewed_by: adminId }).eq("id", id);
      return new Response(JSON.stringify({ ok: true, action }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
