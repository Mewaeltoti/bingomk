import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NEXT_GAME_DELAY_MS = 60_000;

type HistoryPayload = {
  game_id: string;
  session_number: number;
  winner_id: string | null;
  pattern: string;
  players_count: number;
  prize: number;
  drawn_numbers: number[];
  winner_cartela?: number[][] | null;
  winning_number?: number | null;
  ended_status: string;
};

async function archiveFinishedGame(supabase: ReturnType<typeof createClient>, game: any) {
  const gameKey = `session-${game.session_number ?? 1}`;
  const { data: existing } = await supabase
    .from("game_history")
    .select("id")
    .eq("game_id", gameKey)
    .maybeSingle();

  if (existing) return false;

  const [{ data: numbersRows }, { data: claimsRows }, { count: playersCount }] = await Promise.all([
    supabase.from("game_numbers").select("number").eq("game_id", "current").order("id", { ascending: true }),
    supabase.from("bingo_claims").select("cartela_id, is_valid").eq("game_id", "current").eq("is_valid", true),
    supabase.from("cartelas").select("owner_id", { count: "exact", head: true }).eq("is_used", true).not("owner_id", "is", null),
  ]);

  const drawnNumbers = (numbersRows || []).map((row: any) => row.number);
  const winningCartelaId = claimsRows?.[0]?.cartela_id ?? null;
  let winnerCartela: number[][] | null = null;
  if (winningCartelaId) {
    const { data: cartela } = await supabase.from("cartelas").select("numbers").eq("id", winningCartelaId).maybeSingle();
    winnerCartela = (cartela?.numbers as number[][] | undefined) ?? null;
  }

  const payload: HistoryPayload = {
    game_id: gameKey,
    session_number: game.session_number ?? 1,
    winner_id: game.winner_id ?? null,
    pattern: game.pattern || "Full House",
    players_count: playersCount || 0,
    prize: game.prize_amount || 0,
    drawn_numbers: drawnNumbers,
    winner_cartela: winnerCartela,
    winning_number: drawnNumbers.length ? drawnNumbers[drawnNumbers.length - 1] : null,
    ended_status: game.status || "won",
  };

  await supabase.from("game_history").insert(payload);
  return true;
}

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

    if (["won", "stopped", "disqualified"].includes(game.status)) {
      const createdAt = new Date(game.created_at).getTime();
      const now = Date.now();
      const elapsed = now - createdAt;

      await archiveFinishedGame(supabase, game);

      if (elapsed < NEXT_GAME_DELAY_MS) {
        return new Response(JSON.stringify({ ok: true, action: "cooldown", remaining_ms: NEXT_GAME_DELAY_MS - elapsed }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const nextSession = (game.session_number || 1) + 1;
      await Promise.all([
        supabase.from("game_numbers").delete().eq("game_id", "current"),
        supabase.from("bingo_claims").delete().eq("game_id", "current"),
        supabase.from("cartelas").update({ is_used: false, owner_id: null }).eq("is_used", true),
      ]);

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
        created_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({ ok: true, action: "new_game", session: nextSession }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (game.status === "buying") {
      const { count } = await supabase
        .from("cartelas")
        .select("id", { count: "exact", head: true })
        .eq("is_used", true)
        .not("owner_id", "is", null);

      const boughtCount = count || 0;
      const elapsed = Date.now() - new Date(game.created_at).getTime();
      if (boughtCount > 0 && elapsed >= 120_000) {
        await supabase.from("games").update({
          status: "active",
          auto_draw: true,
          prize_amount: boughtCount * (game.cartela_price || 10),
        }).eq("id", "current");

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

      return new Response(JSON.stringify({ ok: true, action: "waiting_for_players", bought: boughtCount }), {
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