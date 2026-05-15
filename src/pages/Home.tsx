import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Zap, Trophy, Play, Users } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    const [profileRes, gameRes, cartelasRes, numbersRes, leaderboardRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('games').select('*').eq('id', 'current').maybeSingle(),
      supabase.from('cartelas').select('id').eq('owner_id', user.id).eq('is_used', true),
      supabase.from('game_numbers').select('number').eq('game_id', 'current').order('id', { ascending: true }),
      supabase.from('game_history').select('winner_id, profiles(phone, display_name)').order('prize', { ascending: false }).limit(3),
    ]);

    if (profileRes.data) {
      setProfile(profileRes.data);
      setBalance(profileRes.data.balance || 0);
    }
    if (gameRes.data) setGame(gameRes.data);
    if (cartelasRes.data) setMyCards(cartelasRes.data.length);
    if (numbersRes.data) setDrawnNumbers(numbersRes.data.map((n: any) => n.number));
    if (leaderboardRes.data) setTopPlayers(leaderboardRes.data);

    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time updates
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
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <p className="text-xs text-muted-foreground mb-1">Welcome back</p>
          <h1 className="font-display text-2xl font-bold text-foreground">{displayName}</h1>
        </motion.div>

        {/* Balance card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 shadow-lg"
        >
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5" /> Your Balance
          </p>
          <h2 className="font-display text-4xl font-bold text-primary mb-6">{balance.toFixed(2)} ETB</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/payment')}
              className="py-3 px-4 rounded-xl bg-primary/20 text-primary font-display font-bold text-sm border border-primary/30 active:scale-95 transition-transform hover:bg-primary/30"
            >
              Deposit
            </button>
            <button
              onClick={() => navigate('/cards')}
              className="py-3 px-4 rounded-xl bg-secondary/20 text-secondary font-display font-bold text-sm border border-secondary/30 active:scale-95 transition-transform hover:bg-secondary/30"
            >
              Buy Cards
            </button>
          </div>
        </motion.div>

        {/* Live game info */}
        {game && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl border border-border bg-card/50"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-display font-bold text-primary">LIVE</span>
              <span className="text-xs text-muted-foreground">{game.pattern}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Prize Pool</p>
                <p className="font-display font-bold text-accent text-lg">{game.prize_amount} ETB</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Your Cards</p>
                <p className="font-display font-bold text-primary text-lg">{myCards}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Game #</p>
                <p className="font-display font-bold text-foreground text-lg">#{game.session_number}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/game')}
              disabled={game.status !== 'active' && game.status !== 'buying' && game.status !== 'waiting'}
              className="w-full py-3 rounded-xl font-display font-bold text-sm gradient-neon text-primary-foreground active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 glow-neon"
            >
              <Play className="w-4 h-4" /> Play Now
            </button>
          </motion.div>
        )}

        {/* Last drawn numbers */}
        {drawnNumbers.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Last Drawn ({drawnNumbers.length})
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2 scroll-smooth">
              {lastNumbers.map((num, i) => {
                const isLatest = i === lastNumbers.length - 1;
                const rowIdx = Math.floor((num - 1) / 15);
                const ballGradients = [
                  'bg-gradient-to-br from-blue-400 to-blue-700',
                  'bg-gradient-to-br from-rose-400 to-rose-700',
                  'bg-gradient-to-br from-emerald-400 to-emerald-700',
                  'bg-gradient-to-br from-purple-400 to-purple-700',
                  'bg-gradient-to-br from-orange-400 to-orange-700',
                ];
                return (
                  <motion.div
                    key={`${num}-${i}`}
                    initial={isLatest ? { scale: 0 } : false}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 14 }}
                    className={`shrink-0 flex items-center justify-center rounded-full text-white font-display font-bold shadow-lg ${
                      ballGradients[rowIdx]
                    } ${isLatest ? 'w-12 h-12 text-sm' : 'w-10 h-10 text-xs'}`}
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
            <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5" /> Top Players
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
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {(player.profiles as any)?.display_name || (player.profiles as any)?.phone || 'Anonymous'}
                    </p>
                  </div>
                  <span className="text-xs font-display font-bold text-accent">{player.prize || 0} ETB</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </PullToRefresh>
    </PageShell>
  );
}
