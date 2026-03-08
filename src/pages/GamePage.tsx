import { useEffect, useState, useCallback } from 'react';
import PageShell from '@/components/PageShell';
import BingoCartela from '@/components/BingoCartela';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/auth';
import { getBingoLetter } from '@/lib/bingoEngine';
import { checkWin } from '@/lib/winDetection';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ReactConfetti from 'react-confetti';
import { cn } from '@/lib/utils';
import { playDrawSound, playWinSound } from '@/lib/sounds';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PATTERN_CELLS: Record<string, boolean[][]> = {
  'Full House': Array(5).fill(Array(5).fill(true)),
  'L Shape': Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) => c === 0 || r === 4)
  ),
  'T Shape': Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) => r === 0 || c === 2)
  ),
  'U Shape': Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) => c === 0 || c === 4 || r === 4)
  ),
  'X Shape': Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) => r === c || r + c === 4)
  ),
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
  winnerId?: string;
};

export default function GamePage() {
  const [playerCartelas, setPlayerCartelas] = useState<any[]>([]);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [gamePattern, setGamePattern] = useState<string>('Full House');
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [playerMarked, setPlayerMarked] = useState<Set<number>>(new Set());
  const [hasClaimed, setHasClaimed] = useState(false);
  const [claimCount, setClaimCount] = useState(0);
  const user = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('cartelas')
      .select('*')
      .eq('owner_id', user.id)
      .order('id', { ascending: true })
      .then(({ data }) => setPlayerCartelas(data || []));
  }, [user?.id]);

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
          handleGameEnd(claimsRes.data || [], gameRes.data.winner_id);
        }
        if (gameRes.data.status === 'disqualified') {
          setGameResult({ type: 'disqualified', message: '3+ players claimed BINGO! Game restarting...' });
          setShowResult(true);
        }
      }
      if (claimsRes.data) {
        setClaimCount(claimsRes.data.length);
        if (user?.id && claimsRes.data.some((c: any) => c.user_id === user.id)) {
          setHasClaimed(true);
        }
      }
    }
    fetchGameState();
  }, [user?.id]);

  const handleGameEnd = (claims: any[], winnerId: string | null) => {
    const validClaims = claims.filter((c: any) => c.is_valid !== false);
    if (validClaims.length === 1) {
      setGameResult({
        type: 'winner',
        message: validClaims[0].user_id === user?.id ? 'You won! 🎉' : 'Someone won this round!',
        winnerId: validClaims[0].user_id,
      });
    } else if (validClaims.length === 2) {
      const isMe = validClaims.some((c: any) => c.user_id === user?.id);
      setGameResult({
        type: 'split',
        message: isMe ? 'You share the prize! 🤝' : 'Two players split the prize!',
      });
    } else {
      setGameResult({
        type: 'winner',
        message: winnerId === user?.id ? 'You won! 🎉' : 'Someone won this round!',
        winnerId: winnerId || undefined,
      });
    }
    setShowResult(true);
    playWinSound();
  };

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
          if (game.status === 'waiting') {
            setDrawnNumbers([]);
            setShowResult(false);
            setGameResult(null);
            setPlayerMarked(new Set());
            setHasClaimed(false);
            setClaimCount(0);
          }
          if (game.status === 'won' || game.status === 'disqualified') {
            supabase.from('bingo_claims').select('*').eq('game_id', 'current')
              .then(({ data }) => {
                const claims = data || [];
                setClaimCount(claims.length);
                if (game.status === 'disqualified') {
                  setGameResult({ type: 'disqualified', message: '3+ players claimed BINGO! Game restarting...' });
                  setShowResult(true);
                } else {
                  handleGameEnd(claims, game.winner_id);
                }
              });
          }
          if (game.pattern) setGamePattern(game.pattern);
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bingo_claims' },
        () => {
          setClaimCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const drawnSet = new Set(drawnNumbers);
  const lastNumber = drawnNumbers[drawnNumbers.length - 1];

  const handleMarkNumber = useCallback((num: number) => {
    setPlayerMarked((prev) => {
      const next = new Set(prev);
      next.has(num) ? next.delete(num) : next.add(num);
      return next;
    });
  }, []);

  const hasWinningCartela = playerCartelas.some((c) =>
    checkWin(c.numbers as number[][], playerMarked, gamePattern as any)
  );

  const handleBingo = async () => {
    if (!user?.id) return;

    const hasValidWin = playerCartelas.some((c) =>
      checkWin(c.numbers as number[][], drawnSet, gamePattern as any)
    );

    if (!hasValidWin) {
      toast.error("Your marks don't match a winning pattern with the drawn numbers!");
      return;
    }

    if (!hasWinningCartela) {
      toast.error("Mark all the winning numbers on your card first!");
      return;
    }

    const { error } = await supabase
      .from('bingo_claims')
      .insert({ game_id: 'current', user_id: user.id });

    if (error) {
      if (error.code === '23505') {
        toast.error('You already claimed BINGO!');
      } else {
        toast.error('Failed to claim');
      }
      return;
    }

    setHasClaimed(true);
    toast.success('🎯 BINGO claimed! Waiting for verification...');
  };

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
            {gameResult.type !== 'disqualified' && (
              <ReactConfetti recycle={false} numberOfPieces={300} />
            )}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center p-8 rounded-2xl gradient-card border-2 border-primary glow-gold max-w-sm mx-4"
            >
              <div className="text-6xl mb-4">
                {gameResult.type === 'winner' ? '🏆' : gameResult.type === 'split' ? '🤝' : '🔄'}
              </div>
              <h2 className="text-3xl font-display font-bold text-primary mb-2">
                {gameResult.type === 'winner' ? 'BINGO!' : gameResult.type === 'split' ? 'SPLIT!' : 'RESTART'}
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

      {/* Last drawn number */}
      {lastNumber && (
        <motion.div
          key={lastNumber}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          className="flex flex-col items-center mb-4"
        >
          <div className="text-xs text-muted-foreground mb-1">Last Number</div>
          <div className="w-16 h-16 rounded-full gradient-gold flex items-center justify-center text-primary-foreground font-display font-bold text-2xl glow-gold">
            {lastNumber}
          </div>
          <div className="text-sm font-display text-primary mt-1">
            {getBingoLetter(lastNumber)}-{lastNumber}
          </div>
        </motion.div>
      )}

      {/* Pattern indicator */}
      <div className="mb-3 flex items-center gap-3">
        <PatternGrid pattern={gamePattern} />
        <div>
          <div className="text-sm font-display font-bold text-foreground">{gamePattern}</div>
          <div className="text-xs text-muted-foreground">Drawn: {drawnNumbers.length}/75</div>
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
                      className={`w-[calc(100%/15)] aspect-square flex items-center justify-center text-[9px] font-medium border-r border-border last:border-r-0 transition-colors ${
                        isDrawn ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                      }`}
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

      {/* Instruction */}
      <div className="mb-3 p-2 rounded-lg bg-muted/50 text-center">
        <p className="text-xs text-muted-foreground">
          👆 Tap drawn numbers on your cards to mark them. Match the pattern and hit BINGO!
        </p>
      </div>

      {/* Player cartelas header with + button */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">Your Cartelas</h2>
        <button
          onClick={() => navigate('/cartelas')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium active:scale-95 transition-transform"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-24">
        {playerCartelas.map((c) => (
          <BingoCartela
            key={c.id}
            numbers={c.numbers as number[][]}
            drawnNumbers={drawnSet}
            playerMarked={playerMarked}
            onMarkNumber={handleMarkNumber}
            size="sm"
            label={`#${c.id}`}
          />
        ))}
        {playerCartelas.length === 0 && (
          <div className="col-span-2 text-center text-muted-foreground py-8">
            <p>No cartelas yet.</p>
            <button
              onClick={() => navigate('/cartelas')}
              className="mt-2 px-4 py-2 rounded-lg gradient-gold text-primary-foreground text-sm font-medium"
            >
              Buy Cartelas
            </button>
          </div>
        )}
      </div>

      {/* Bingo button */}
      {hasWinningCartela && !hasClaimed && !showResult && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-20 left-4 right-4 z-40"
        >
          <button
            onClick={handleBingo}
            className="w-full py-5 rounded-2xl font-display font-bold text-2xl gradient-gold text-primary-foreground glow-gold active:scale-95 transition-transform"
          >
            🎯 BINGO!
          </button>
        </motion.div>
      )}

      {hasClaimed && !showResult && (
        <div className="fixed bottom-20 left-4 right-4 z-40">
          <div className="w-full py-4 rounded-2xl bg-muted text-center text-muted-foreground font-display font-bold text-lg">
            ⏳ Waiting for verification...
          </div>
        </div>
      )}
    </PageShell>
  );
}
