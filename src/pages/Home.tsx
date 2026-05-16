import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import PageShell from '@/components/PageShell';
import PullToRefresh from '@/components/PullToRefresh';

export default function Home() {
  const user = useUser();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [balance, setBalance] = useState(0);
  const [game, setGame] = useState<any>(null);
  const [myCards, setMyCards] = useState(0);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [topPlayers, setTopPlayers] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    const [profileRes, gameRes, cartelasRes, numbersRes, leaderboardRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('games').select('*').eq('id', 'current').maybeSingle(),
      supabase.from('cartelas').select('id').eq('owner_id', user.id).eq('is_used', true),
      supabase.from('game_numbers').select('number').eq('game_id', 'current').order('id', { ascending: true }),
      supabase.from('game_history').select('winner_id, profiles(phone, display_name), prize').order('prize', { ascending: false }).limit(2),
    ]);

    if (profileRes.data) {
      setProfile(profileRes.data);
      setBalance(profileRes.data.balance || 0);
    }
    if (gameRes.data) setGame(gameRes.data);
    if (cartelasRes.data) setMyCards(cartelasRes.data.length);
    if (numbersRes.data) setDrawnNumbers(numbersRes.data.map((n: any) => n.number));
    if (leaderboardRes.data) setTopPlayers(leaderboardRes.data);
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('home-realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`,
      }, (payload: any) => {
        setProfile(payload.new);
        setBalance(payload.new.balance || 0);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'games',
        filter: 'id=eq.current',
      }, (payload: any) => {
        setGame(payload.new);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'game_numbers',
        filter: 'game_id=eq.current',
      }, (payload: any) => {
        setDrawnNumbers((prev) => [...prev, payload.new.number]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const displayName = profile?.phone || profile?.display_name || 'Player';
  const lastNumbers = drawnNumbers.slice(-6);
  const isGameActive = game?.status === 'active';

  return (
    <PageShell title="Home">
      <PullToRefresh onRefresh={loadData}>
        {/* Welcome header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <p className="text-xs text-muted-foreground mb-1">Welcome back</p>
          <h1 className="font-display text-2xl font-bold text-foreground">{displayName}</h1>
        </motion.div>

        {/* Balance card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-primary via-primary to-secondary text-primary-foreground"
        >
          <p className="text-xs opacity-80 mb-2">Your Balance</p>
          <h2 className="font-display text-4xl font-bold mb-5">{balance.toFixed(2)} ETB</h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => navigate('/payment')}
              className="py-3 px-4 rounded-xl bg-primary-foreground/20 text-primary-foreground font-bold text-sm active:scale-95 transition-transform"
            >
              Deposit
            </button>
            <button
              onClick={() => navigate('/cards')}
              className="py-3 px-4 rounded-xl bg-primary-foreground/20 text-primary-foreground font-bold text-sm active:scale-95 transition-transform"
            >
              Withdraw
            </button>
          </div>
        </motion.div>

        {/* Live game info */}
        {game && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-2xl border border-border bg-card/50"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-display font-bold text-red-500">LIVE</span>
              <span className="text-xs text-muted-foreground">{game.pattern}</span>
            </div>
            <div className="flex justify-between items-end mb-4">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Prize Pool</p>
                <p className="font-display font-bold text-amber-500 text-lg">{game.prize_amount} ETB</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground mb-1">Your Cards</p>
                <p className="font-display font-bold text-foreground text-lg">{myCards}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/game')}
              disabled={!isGameActive}
              className="w-full py-3 rounded-xl font-display font-bold text-sm gradient-neon text-primary-foreground active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2 glow-neon"
            >
              <Play className="w-4 h-4" /> Play Now
            </button>
          </motion.div>
        )}

        {/* Last drawn numbers */}
        {drawnNumbers.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Last Drawn
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {lastNumbers.map((num, i) => {
                const isLatest = i === lastNumbers.length - 1;
                return (
                  <motion.div
                    key={`${num}-${i}`}
                    initial={isLatest ? { scale: 0 } : false}
                    animate={{ scale: 1 }}
                    className={`shrink-0 flex items-center justify-center rounded-full text-white font-display font-bold shadow-lg bg-gradient-to-br from-primary to-primary/80 ${
                      isLatest ? 'w-12 h-12 text-base' : 'w-10 h-10 text-xs'
                    }`}
                  >
                    {num}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Top players */}
        {topPlayers.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Top Players
            </p>
            <div className="space-y-2">
              {topPlayers.map((player, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-3 rounded-lg bg-card border border-border/50 flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-display font-bold text-primary-foreground">
                    {idx === 0 ? '🥇' : '🥈'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {(player.profiles as any)?.display_name || (player.profiles as any)?.phone || 'Anonymous'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{(player.profiles as any)?.phone?.slice(-4) || ''}</p>
                  </div>
                  <span className="text-xs font-display font-bold text-amber-500">{player.prize || 0} ETB</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </PullToRefresh>
    </PageShell>
  );
}
