import { useEffect, useState, useCallback, useMemo } from 'react';
import PageShell from '@/components/PageShell';
import BingoCartela from '@/components/BingoCartela';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/auth';
import { useGamePresence } from '@/hooks/useGamePresence';
import { getBingoLetter } from '@/lib/bingoEngine';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ReactConfetti from 'react-confetti';
import { cn } from '@/lib/utils';
import { playDrawSound, playWinSound } from '@/lib/sounds';
import { Plus, Users, Eye, Hand } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PATTERN_CELLS: Record<string, boolean[][]> = {
  'Full House': Array(5).fill(Array(5).fill(true)),
  'L Shape': Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => c === 0 || r === 4)),
  'T Shape': Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => r === 0 || c === 2)),
  'U Shape': Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => c === 0 || c === 4 || r === 4)),
  'X Shape': Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => r === c || r + c === 4)),
};

function PatternGrid({ pattern }: { pattern: string }) {
  const cells = PATTERN_CELLS[pattern] || PATTERN_CELLS['Full House'];
  return (
    <div className="grid grid-cols-5 gap-px w-10 h-10 rounded-md overflow-hidden border border-border">
      {cells.flat().map((on, i) => (
        <div key={i} className={cn('w-full h-full', on ? 'bg-primary' : 'bg-muted/50')} />
      ))}
    </div>
  );
}

type GameResult = {
  type: 'winner' | 'split' | 'disqualified';
  message: string;
};

export default function GamePage() {
  const [playerCartelas, setPlayerCartelas] = useState<any[]>([]);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [gamePattern, setGamePattern] = useState<string>('Full House');
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [playerMarked, setPlayerMarked] = useState<Set<number>>(new Set());
  const [claimedCartelas, setClaimedCartelas] = useState<Set<number>>(new Set());
  const [removedCartelas, setRemovedCartelas] = useState<Set<number>>(new Set());
  const [strikeMap, setStrikeMap] = useState<Map<number, number>>(new Map()); // cartelaId -> strikes
  const [isSpectator, setIsSpectator] = useState(false);
  const [displayName, setDisplayName] = useState<string>('');
  const [balance, setBalance] = useState(0);
  const user = useUser();
  const navigate = useNavigate();
  const players = useGamePresence(user?.id, displayName);

  // Fetch profile
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('display_name, balance').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setDisplayName((data as any).display_name || '');
          setBalance((data as any).balance || 0);
        }
      });

    const ch = supabase
      .channel('balance-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload: any) => {
          setBalance(payload.new.balance || 0);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  // Fetch cartelas
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('cartelas').select('*').eq('owner_id', user.id).eq('is_used', true).order('id', { ascending: true })
      .then(({ data }) => {
        setPlayerCartelas(data || []);
        if (!data || data.length === 0) setIsSpectator(true);
        else setIsSpectator(false);
      });
  }, [user?.id]);

  // Fetch game state + existing claims for this user
  useEffect(() => {
    async function fetchGameState() {
      const [numbersRes, gameRes, claimsRes] = await Promise.all([
        supabase.from('game_numbers').select('number').eq('game_id', 'current').order('id', { ascending: true }),
        supabase.from('games').select('*').eq('id', 'current').maybeSingle(),
        supabase.from('bingo_claims').select('*').eq('game_id', 'current'),
      ]);
      if (numbersRes.data) setDrawnNumbers(numbersRes.data.map((n: any) => n.number));
      if (gameRes.data) {
        setGamePattern(gameRes.data.pattern || 'Full House');
        if (gameRes.data.status === 'won') {
          setGameResult({ type: 'winner', message: 'Someone won this round! 🏆' });
          setShowResult(true);
          if (gameRes.data.winner_id === user?.id) {
            setGameResult({ type: 'winner', message: 'You won! 🎉🏆' });
          }
        }
      }
      // Track existing claims for this user
      if (claimsRes.data && user?.id) {
        const userClaims = claimsRes.data.filter((c: any) => c.user_id === user.id);
        const claimed = new Set<number>();
        const removed = new Set<number>();
        const strikes = new Map<number, number>();
        for (const claim of userClaims) {
          const cid = (claim as any).cartela_id;
          if (cid) {
            if (claim.is_valid === null) claimed.add(cid); // pending
            const s = (claim as any).strike_count || 0;
            strikes.set(cid, Math.max(strikes.get(cid) || 0, s));
            if (s >= 2) removed.add(cid);
          }
        }
        setClaimedCartelas(claimed);
        setRemovedCartelas(removed);
        setStrikeMap(strikes);
      }
    }
    fetchGameState();
  }, [user?.id]);

  const drawnSet = useMemo(() => new Set(drawnNumbers), [drawnNumbers]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('game-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_numbers' },
        (payload: any) => {
          setDrawnNumbers((prev) => [...prev, payload.new.number]);
          playDrawSound();
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' },
        (payload: any) => {
          const game = payload.new;
          if (game.status === 'waiting' || game.status === 'active') {
            setDrawnNumbers([]);
            setShowResult(false);
            setGameResult(null);
            setPlayerMarked(new Set());
            setClaimedCartelas(new Set());
            setRemovedCartelas(new Set());
            setStrikeMap(new Map());
            // Cartelas were released — re-fetch
            if (user?.id) {
              supabase.from('cartelas').select('*').eq('owner_id', user.id).eq('is_used', true)
                .then(({ data }) => {
                  setPlayerCartelas(data || []);
                  setIsSpectator(!data || data.length === 0);
                });
            }
          }
          if (game.status === 'won') {
            setGameResult({ type: 'winner', message: 'Someone won this round! 🏆' });
            setShowResult(true);
            playWinSound();
            if (game.winner_id === user?.id) {
              setGameResult({ type: 'winner', message: 'You won! 🎉🏆' });
            }
          }
          if (game.pattern) setGamePattern(game.pattern);
        }
      )
      // Listen for claim validation results
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bingo_claims' },
        (payload: any) => {
          const claim = payload.new;
          if (claim.user_id !== user?.id) return;
          const cid = claim.cartela_id;
          if (claim.is_valid === false) {
            const strikes = claim.strike_count || 0;
            setStrikeMap(prev => new Map(prev).set(cid, strikes));
            if (strikes >= 2) {
              toast.error(`Cartela #${cid} removed — 2 wrong claims!`);
              setRemovedCartelas(prev => new Set(prev).add(cid));
            } else {
              toast.warning(`Wrong claim on #${cid}! ${2 - strikes} chance(s) left.`);
            }
            // Allow re-claiming if not removed
            setClaimedCartelas(prev => {
              const next = new Set(prev);
              next.delete(cid);
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const lastNumber = drawnNumbers[drawnNumbers.length - 1];

  // Manual marking
  const handleMarkNumber = useCallback((num: number) => {
    setPlayerMarked((prev) => {
      const next = new Set(prev);
      next.has(num) ? next.delete(num) : next.add(num);
      return next;
    });
  }, []);

  // Per-cartela BINGO claim
  const handleClaimBingo = async (cartelaId: number) => {
    if (!user?.id || isSpectator) return;
    if (claimedCartelas.has(cartelaId) || removedCartelas.has(cartelaId)) return;

    // Check how many strikes already
    const { data: existingClaims } = await supabase
      .from('bingo_claims')
      .select('*')
      .eq('game_id', 'current')
      .eq('user_id', user.id)
      .eq('cartela_id', cartelaId);

    const currentStrikes = existingClaims?.length || 0;
    if (currentStrikes >= 2) {
      toast.error('This cartela has been removed from the game!');
      setRemovedCartelas(prev => new Set(prev).add(cartelaId));
      return;
    }

    setClaimedCartelas(prev => new Set(prev).add(cartelaId));

    const { error } = await supabase
      .from('bingo_claims')
      .insert({
        game_id: 'current',
        user_id: user.id,
        cartela_id: cartelaId,
        strike_count: currentStrikes + 1,
      } as any);

    if (error) {
      toast.error('Failed to claim');
      setClaimedCartelas(prev => {
        const next = new Set(prev);
        next.delete(cartelaId);
        return next;
      });
      return;
    }

    toast.success(`🎯 BINGO claimed on #${cartelaId}! Verifying...`);
  };

  // Active cartelas (not removed)
  const activeCartelas = useMemo(
    () => playerCartelas.filter(c => !removedCartelas.has(c.id)),
    [playerCartelas, removedCartelas]
  );

  return (
    <PageShell title="Live Game">
      {/* Result overlay */}
      <AnimatePresence>
        {showResult && gameResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            onClick={() => setShowResult(false)}
          >
            {gameResult.type !== 'disqualified' && <ReactConfetti recycle={false} numberOfPieces={300} />}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center p-8 rounded-2xl bg-card border-2 border-primary glow-gold max-w-sm mx-4"
            >
              <div className="text-6xl mb-4">
                {gameResult.type === 'winner' ? '🏆' : '🔄'}
              </div>
              <h2 className="text-3xl font-display font-bold text-primary mb-2">
                {gameResult.type === 'disqualified' ? 'RESTART' : 'BINGO!'}
              </h2>
              <p className="text-lg text-muted-foreground">{gameResult.message}</p>
              <button
                onClick={() => setShowResult(false)}
                className="mt-4 px-6 py-2 rounded-xl bg-muted text-muted-foreground text-sm"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span className="font-bold text-foreground">{players.length}</span> online
          </div>
          {isSpectator && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/10 text-xs text-accent">
              <Eye className="w-3.5 h-3.5" />
              Spectating
            </div>
          )}
        </div>
        <div className="text-sm font-display font-bold text-primary">{balance} ETB</div>
      </div>

      {/* Last drawn number */}
      {lastNumber && (
        <motion.div
          key={lastNumber}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          className="flex flex-col items-center mb-4"
        >
          <div className="text-xs text-muted-foreground mb-1">Last Number</div>
          <div className="w-20 h-20 rounded-full gradient-gold flex items-center justify-center text-primary-foreground font-display font-bold text-3xl glow-gold shadow-lg">
            {lastNumber}
          </div>
          <div className="text-base font-display font-bold text-primary mt-1">
            {getBingoLetter(lastNumber)}-{lastNumber}
          </div>
        </motion.div>
      )}

      {/* Pattern info */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PatternGrid pattern={gamePattern} />
          <div>
            <div className="text-sm font-display font-bold text-foreground">{gamePattern}</div>
            <div className="text-xs text-muted-foreground">Drawn: {drawnNumbers.length}/75</div>
          </div>
        </div>
      </div>

      {/* Full 1-75 number board */}
      <div className="mb-3">
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          {['B', 'I', 'N', 'G', 'O'].map((letter, rowIdx) => (
            <div key={letter} className="flex items-center border-b border-border last:border-b-0">
              <div className="w-7 flex-shrink-0 text-center font-display font-bold text-primary text-xs py-1 bg-muted/50 border-r border-border">
                {letter}
              </div>
              <div className="flex flex-1">
                {Array.from({ length: 15 }, (_, i) => {
                  const num = rowIdx * 15 + i + 1;
                  const isDrawn = drawnSet.has(num);
                  return (
                    <div
                      key={num}
                      className={cn(
                        'w-[calc(100%/15)] aspect-square flex items-center justify-center text-[9px] font-medium border-r border-border last:border-r-0 transition-colors',
                        isDrawn ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {num}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Player cartelas header */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">
          {isSpectator ? 'Spectator Mode' : 'Your Cartelas'}
        </h2>
        {!isSpectator && (
          <button
            onClick={() => navigate('/cartelas')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium active:scale-95 transition-transform"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-24">
        {activeCartelas.map((c) => {
          const strikes = strikeMap.get(c.id) || 0;
          return (
          <div key={c.id} className="flex flex-col gap-1.5">
            <BingoCartela
              numbers={c.numbers as number[][]}
              drawnNumbers={drawnSet}
              playerMarked={playerMarked}
              onMarkNumber={isSpectator ? undefined : handleMarkNumber}
              size="sm"
              label={`#${c.id}`}
              autoMark={false}
            />
            {/* Strike indicator */}
            {strikes > 0 && (
              <div className="flex items-center justify-center gap-1 text-xs">
                {Array.from({ length: 2 }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'w-2 h-2 rounded-full',
                      i < strikes ? 'bg-destructive' : 'bg-muted'
                    )}
                  />
                ))}
                <span className="text-destructive font-medium ml-1">
                  {2 - strikes} left
                </span>
              </div>
            )}
            {/* Per-cartela BINGO button */}
            {!isSpectator && drawnNumbers.length > 0 && !removedCartelas.has(c.id) && (
              <button
                onClick={() => handleClaimBingo(c.id)}
                disabled={claimedCartelas.has(c.id)}
                className={cn(
                  'w-full py-2 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform',
                  claimedCartelas.has(c.id)
                    ? 'bg-muted text-muted-foreground'
                    : 'gradient-gold text-primary-foreground glow-gold'
                )}
              >
                <Hand className="w-4 h-4" />
                {claimedCartelas.has(c.id) ? 'Verifying...' : 'BINGO!'}
              </button>
            )}
          </div>
          );
        })}
        {activeCartelas.length === 0 && (
          <div className="col-span-2 text-center text-muted-foreground py-8">
            <Eye className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>{removedCartelas.size > 0 ? 'All cartelas removed — game over for you' : 'No cartelas — watching as spectator'}</p>
            <button
              onClick={() => navigate('/cartelas')}
              className="mt-2 px-4 py-2 rounded-lg gradient-gold text-primary-foreground text-sm font-medium"
            >
              Buy Cartelas
            </button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
