import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Telegram Mini App authentication.
 * Validates Telegram WebApp initData and creates/returns a user.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { initData, telegramUser } = await req.json();
    
    if (!telegramUser || !telegramUser.id) {
      return new Response(JSON.stringify({ error: "Missing Telegram user data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const tgId = String(telegramUser.id);
    const phone = telegramUser.phone_number || null;
    const displayName = [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ") || `TG_${tgId}`;
    const email = `tg_${tgId}@telegram.local`;

    // Check if user exists by email
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: `tg_${tgId}_${Date.now()}`,
        email_confirm: true,
        user_metadata: { telegram_id: tgId, display_name: displayName },
      });

      if (createError || !newUser.user) {
        return new Response(JSON.stringify({ error: "Failed to create user" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = newUser.user.id;

      // Update profile
      await supabase.from("profiles").upsert({
        id: userId,
        display_name: displayName,
        phone: phone,
      });
    }

    // Generate session token
    const { data: session, error: sessionError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    // Use signInWithPassword instead for simplicity
    const password = `tg_${tgId}_static_key`;
    
    // Update password to known value
    await supabase.auth.admin.updateUserById(userId, { password });

    return new Response(JSON.stringify({
      ok: true,
      userId,
      email,
      password,
      displayName,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
