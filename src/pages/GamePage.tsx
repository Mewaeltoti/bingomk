import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import PageShell from '@/components/PageShell';
import BingoCartela from '@/components/BingoCartela';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/auth';
import { useGamePresence } from '@/hooks/useGamePresence';
import { getBingoLetter } from '@/lib/bingoEngine';
import { checkWin } from '@/lib/winDetection';
import { PatternName } from '@/lib/bingo';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ReactConfetti from 'react-confetti';
import { cn } from '@/lib/utils';
import { playDrawSound, playWinSound, playMarkSound } from '@/lib/sounds';
import { Users, Eye, Hand, ShoppingCart } from 'lucide-react';
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
    <div className="grid grid-cols-5 gap-px w-8 h-8 rounded overflow-hidden border border-border">
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
  const [markedMap, setMarkedMap] = useState<Map<number, Set<string>>>(new Map());
  const [claimedCartelas, setClaimedCartelas] = useState<Set<number>>(new Set());
  const [gameStatus, setGameStatus] = useState<string>('waiting');
  const [buyingCountdown, setBuyingCountdown] = useState(0);
  const buyingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
        (payload: any) => setBalance(payload.new.balance || 0)
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
        setIsSpectator(!data || data.length === 0);
      });
  }, [user?.id]);

  // Fetch game state + existing claims
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
        setGameStatus(gameRes.data.status || 'waiting');
        if (gameRes.data.status === 'won') {
          setGameResult({ type: 'winner', message: 'Someone won this round! 🏆' });
          setShowResult(true);
          if (gameRes.data.winner_id === user?.id) {
            setGameResult({ type: 'winner', message: 'You won! 🎉🏆' });
          }
        }
      }
      if (claimsRes.data && user?.id) {
        const userClaims = claimsRes.data.filter((c: any) => c.user_id === user.id);
        const claimed = new Set<number>();
        for (const claim of userClaims) {
          const cid = (claim as any).cartela_id;
          if (cid && claim.is_valid === null) claimed.add(cid);
        }
        setClaimedCartelas(claimed);
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
          setGameStatus(game.status);
          if (game.status === 'buying') {
            setDrawnNumbers([]);
            setShowResult(false);
            setGameResult(null);
            setMarkedMap(new Map());
            setClaimedCartelas(new Set());
            if (user?.id) {
              supabase.from('cartelas').select('*').eq('owner_id', user.id).eq('is_used', true)
                .then(({ data }) => {
                  setPlayerCartelas(data || []);
                  setIsSpectator(!data || data.length === 0);
                });
            }
            setBuyingCountdown(120);
            if (buyingTimerRef.current) clearInterval(buyingTimerRef.current);
            buyingTimerRef.current = setInterval(() => {
              setBuyingCountdown(prev => {
                if (prev <= 1) {
                  if (buyingTimerRef.current) clearInterval(buyingTimerRef.current);
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);
            toast('🛒 New game starting! Buy cartelas now!');
          }
          if (game.status === 'active') {
            setBuyingCountdown(0);
            if (buyingTimerRef.current) clearInterval(buyingTimerRef.current);
            if (user?.id) {
              supabase.from('cartelas').select('*').eq('owner_id', user.id).eq('is_used', true)
                .then(({ data }) => {
                  setPlayerCartelas(data || []);
                  setIsSpectator(!data || data.length === 0);
                });
            }
            toast('🎲 Game started! Good luck!');
          }
          if (game.status === 'waiting') {
            setDrawnNumbers([]);
            setShowResult(false);
            setGameResult(null);
            setMarkedMap(new Map());
            setClaimedCartelas(new Set());
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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bingo_claims' },
        (payload: any) => {
          const claim = payload.new;
          if (claim.user_id !== user?.id) return;
          const cid = claim.cartela_id;
          if (claim.is_valid === false) {
            toast.warning(`Claim on #${cid} invalid. Try again!`);
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

  // Per-cartela cell marking with animation feedback
  const handleMarkCell = useCallback((cartelaId: number, row: number, col: number) => {
    playMarkSound();
    setMarkedMap(prev => {
      const next = new Map(prev);
      const cells = new Set(next.get(cartelaId) || []);
      const key = `${row}-${col}`;
      if (cells.has(key)) {
        cells.delete(key);
      } else {
        cells.add(key);
      }
      next.set(cartelaId, cells);
      return next;
    });
  }, []);

  // Convert marked cells to numbers for win checking
  const getMarkedNumbersForCartela = useCallback((cartela: any): Set<number> => {
    const cells = markedMap.get(cartela.id) || new Set<string>();
    const nums = new Set<number>();
    const numbers = cartela.numbers as number[][];
    cells.forEach(key => {
      const [r, c] = key.split('-').map(Number);
      const num = numbers[r]?.[c];
      if (num !== undefined) nums.add(num);
    });
    return nums;
  }, [markedMap]);

  // BINGO claim with local validation
  const handleClaimBingo = async (cartelaId: number, cartela: any) => {
    if (!user?.id || isSpectator || claimedCartelas.has(cartelaId)) return;

    const markedNums = getMarkedNumbersForCartela(cartela);
    const numbers = cartela.numbers as number[][];

    // Verify marked numbers are drawn
    for (const num of markedNums) {
      if (!drawnSet.has(num)) {
        toast.error('You marked a number that hasn\'t been drawn!');
        return;
      }
    }

    // Check pattern locally
    if (!checkWin(numbers, markedNums, gamePattern as PatternName)) {
      toast.error('Your marks don\'t match the pattern!');
      return;
    }

    setClaimedCartelas(prev => new Set(prev).add(cartelaId));

    const { error } = await supabase
      .from('bingo_claims')
      .insert({ game_id: 'current', user_id: user.id, cartela_id: cartelaId } as any);

    if (error) {
      toast.error('Failed to claim');
      setClaimedCartelas(prev => {
        const next = new Set(prev);
        next.delete(cartelaId);
        return next;
      });
      return;
    }

    toast.success(`🎯 BINGO claimed! Waiting for verification...`);
  };

  const isGameActive = gameStatus === 'active';
  const showBuyPrompt = gameStatus === 'buying' || gameStatus === 'waiting' || gameStatus === 'stopped' || gameStatus === 'won';

  return (
    <PageShell title="Bingo">
      {/* Winner overlay - simple confetti + message */}
      <AnimatePresence>
        {showResult && gameResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm"
            onClick={() => setShowResult(false)}
          >
            {gameResult.type !== 'disqualified' && <ReactConfetti recycle={false} numberOfPieces={200} />}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center p-6 rounded-2xl bg-card border-2 border-primary max-w-xs mx-4"
            >
              <div className="text-5xl mb-3">{gameResult.type === 'winner' ? '🏆' : '🔄'}</div>
              <h2 className="text-2xl font-display font-bold text-primary mb-1">
                {gameResult.type === 'disqualified' ? 'RESTART' : 'BINGO!'}
              </h2>
              <p className="text-muted-foreground">{gameResult.message}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact header: players + balance */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span className="font-bold text-foreground">{players.length}</span>
          </span>
          {isSpectator && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-muted-foreground">
              <Eye className="w-3 h-3" /> Spectating
            </span>
          )}
        </div>
        <div className="text-sm font-display font-bold text-primary">{balance} ETB</div>
      </div>

      {/* Buy/Waiting state */}
      {showBuyPrompt && !isGameActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-3 p-4 rounded-xl bg-card border border-border text-center"
        >
          {gameStatus === 'buying' ? (
            <>
              <div className="text-3xl font-display font-bold text-primary mb-1">
                {Math.floor(buyingCountdown / 60)}:{String(buyingCountdown % 60).padStart(2, '0')}
              </div>
              <p className="text-sm text-muted-foreground mb-3">Buy cartelas before game starts!</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground mb-3">
              {gameStatus === 'won' ? 'Round over! New game soon.' : 'Waiting for next game...'}
            </p>
          )}
          <button
            onClick={() => navigate('/cartelas')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl gradient-gold text-primary-foreground text-sm font-bold active:scale-95 transition-transform"
          >
            <ShoppingCart className="w-4 h-4" />
            Buy Cartelas
          </button>
        </motion.div>
      )}

      {/* ACTIVE GAME - Single view layout */}
      {isGameActive && (
        <div className="space-y-3">
          {/* Row 1: Last number + Pattern */}
          <div className="flex items-center gap-3">
            {/* Last drawn number - prominent */}
            {lastNumber ? (
              <motion.div
                key={lastNumber}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 rounded-full gradient-gold flex flex-col items-center justify-center text-primary-foreground shadow-lg flex-shrink-0"
              >
                <span className="text-[10px] font-medium opacity-80">{getBingoLetter(lastNumber)}</span>
                <span className="text-2xl font-display font-bold -mt-1">{lastNumber}</span>
              </motion.div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs flex-shrink-0">
                --
              </div>
            )}

            {/* Pattern + drawn count */}
            <div className="flex-1 flex items-center gap-2">
              <PatternGrid pattern={gamePattern} />
              <div>
                <div className="text-sm font-display font-bold text-foreground">{gamePattern}</div>
                <div className="text-xs text-muted-foreground">{drawnNumbers.length}/75 drawn</div>
              </div>
            </div>
          </div>

          {/* Row 2: Compact 1-75 board */}
          <div className="rounded-lg border border-border overflow-hidden bg-card">
            {['B', 'I', 'N', 'G', 'O'].map((letter, rowIdx) => (
              <div key={letter} className="flex items-center border-b border-border last:border-b-0">
                <div className="w-6 flex-shrink-0 text-center font-display font-bold text-primary text-[10px] py-0.5 bg-muted/50">
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
                          'flex-1 aspect-square flex items-center justify-center text-[8px] font-medium transition-colors',
                          isDrawn ? 'bg-primary text-primary-foreground' : 'text-muted-foreground/60'
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

          {/* Row 3: Player's cartelas - responsive grid */}
          {playerCartelas.length > 0 ? (
            <div className={cn(
              'grid gap-3',
              playerCartelas.length === 1 ? 'grid-cols-1 max-w-[200px] mx-auto' :
              playerCartelas.length === 2 ? 'grid-cols-2' :
              'grid-cols-2 lg:grid-cols-3'
            )}>
              {playerCartelas.map((c) => {
                const cellsMarked = markedMap.get(c.id) || new Set<string>();
                const isClaimed = claimedCartelas.has(c.id);
                return (
                  <motion.div
                    key={c.id}
                    layout
                    className="flex flex-col gap-2"
                  >
                    <BingoCartela
                      numbers={c.numbers as number[][]}
                      drawnNumbers={drawnSet}
                      markedCells={cellsMarked}
                      onMarkCell={isSpectator ? undefined : (row, col) => handleMarkCell(c.id, row, col)}
                      size="sm"
                      label={`#${c.id}`}
                    />
                    {/* One-step claim button */}
                    {!isSpectator && (
                      <button
                        onClick={() => handleClaimBingo(c.id, c)}
                        disabled={isClaimed}
                        className={cn(
                          'w-full py-2.5 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all',
                          isClaimed
                            ? 'bg-muted text-muted-foreground'
                            : 'gradient-gold text-primary-foreground glow-gold'
                        )}
                      >
                        <Hand className="w-4 h-4" />
                        {isClaimed ? 'Verifying...' : 'BINGO!'}
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Eye className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Spectating — no cartelas</p>
              <button
                onClick={() => navigate('/cartelas')}
                className="mt-2 px-4 py-2 rounded-lg gradient-gold text-primary-foreground text-sm font-medium"
              >
                Buy Cartelas
              </button>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}