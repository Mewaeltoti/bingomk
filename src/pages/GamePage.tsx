import { useEffect, useState } from 'react';
import PageShell from '@/components/PageShell';
import BingoCartela from '@/components/BingoCartela';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/auth';
import { getBingoLetter } from '@/lib/bingoEngine';
import { checkWin } from '@/lib/winDetection';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ReactConfetti from 'react-confetti';

export default function GamePage() {
  const [playerCartelas, setPlayerCartelas] = useState<any[]>([]);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [gamePattern, setGamePattern] = useState<string>('Full House');
  const [winner, setWinner] = useState<string | null>(null);
  const [showWinner, setShowWinner] = useState(false);
  const user = useUser();

  // Fetch player's cartelas
  useEffect(() => {
    async function fetchPlayerCartelas() {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('cartelas')
        .select('*')
        .eq('owner_id', user.id)
        .order('id', { ascending: true });

      if (error) {
        console.error(error);
        return;
      }
      setPlayerCartelas(data || []);
    }
    fetchPlayerCartelas();
  }, [user?.id]);

  // Fetch existing drawn numbers and game state
  useEffect(() => {
    async function fetchGameState() {
      const [numbersRes, gameRes] = await Promise.all([
        supabase.from('game_numbers').select('number').eq('game_id', 'current').order('id', { ascending: true }),
        supabase.from('games').select('*').eq('id', 'current').single(),
      ]);

      if (numbersRes.data) {
        setDrawnNumbers(numbersRes.data.map((n: any) => n.number));
      }
      if (gameRes.data) {
        setGamePattern(gameRes.data.pattern || 'Full House');
        if (gameRes.data.status === 'won') {
          setShowWinner(true);
        }
      }
    }
    fetchGameState();
  }, []);

  // Realtime: listen for new drawn numbers
  useEffect(() => {
    const channel = supabase
      .channel('game-numbers-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_numbers' },
        (payload: any) => {
          const newNumber = payload.new.number;
          setDrawnNumbers((prev) => [...prev, newNumber]);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games' },
        (payload: any) => {
          const game = payload.new;
          if (game.status === 'won') {
            setWinner(game.winner_id);
            setShowWinner(true);
          }
          if (game.status === 'waiting') {
            // New game reset
            setDrawnNumbers([]);
            setShowWinner(false);
            setWinner(null);
          }
          if (game.pattern) {
            setGamePattern(game.pattern);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const lastNumber = drawnNumbers[drawnNumbers.length - 1];
  const markedSet = new Set(drawnNumbers);

  // Check if any cartela has won
  const hasWinningCartela = playerCartelas.some((c) =>
    checkWin(c.numbers as number[][], markedSet, gamePattern as any)
  );

  const handleBingo = async () => {
    if (!hasWinningCartela) {
      toast.error('You haven\'t won yet! Keep playing.');
      return;
    }

    const { error } = await supabase
      .from('games')
      .update({ status: 'won', winner_id: user?.id })
      .eq('id', 'current');

    if (error) {
      toast.error('Failed to claim win');
      return;
    }

    toast.success('🎉 BINGO! You won!');
  };

  return (
    <PageShell title="Live Game">
      {/* Winner overlay */}
      <AnimatePresence>
        {showWinner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <ReactConfetti recycle={false} numberOfPieces={300} />
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center p-8 rounded-2xl gradient-card border-2 border-primary glow-gold max-w-sm mx-4"
            >
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-3xl font-display font-bold text-primary mb-2">BINGO!</h2>
              <p className="text-lg text-muted-foreground">
                {winner === user?.id ? 'You won! 🎉' : 'Someone won this round!'}
              </p>
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
          className="flex flex-col items-center mb-6"
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

      {/* Full 1-75 number board */}
      <div className="mb-4">
        <div className="text-xs text-muted-foreground mb-2">
          Drawn: {drawnNumbers.length}/75 · Pattern: {gamePattern}
        </div>
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          {['B', 'I', 'N', 'G', 'O'].map((letter, rowIdx) => (
            <div key={letter} className="flex items-center border-b border-border last:border-b-0">
              <div className="w-7 flex-shrink-0 text-center font-display font-bold text-primary text-xs py-1 bg-muted/50 border-r border-border">
                {letter}
              </div>
              <div className="flex flex-1 flex-wrap">
                {Array.from({ length: 15 }, (_, i) => {
                  const num = rowIdx * 15 + i + 1;
                  const isDrawn = markedSet.has(num);
                  return (
                    <div
                      key={num}
                      className={`w-[calc(100%/15)] aspect-square flex items-center justify-center text-[9px] font-medium border-r border-border last:border-r-0 transition-colors ${
                        isDrawn
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground'
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

      {/* Player cartelas */}
      <h2 className="mb-3 text-sm font-bold text-foreground">Your Cartelas</h2>
      <div className="grid grid-cols-2 gap-3 mb-24">
        {playerCartelas.map((c) => (
          <BingoCartela
            key={c.id}
            numbers={c.numbers as number[][]}
            markedNumbers={markedSet}
            size="sm"
            label={`#${c.id}`}
          />
        ))}
      </div>

      {/* Bingo button */}
      {hasWinningCartela && !showWinner && (
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
    </PageShell>
  );
}
