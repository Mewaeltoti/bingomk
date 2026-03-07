import { useState, useEffect } from 'react';
import PageShell from '@/components/PageShell';
import { Users, CreditCard, Gamepad2, Check, X } from 'lucide-react';
import { PATTERNS, PatternName } from '@/lib/bingo';
import { getBingoLetter } from '@/lib/bingoEngine';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Admin() {
  const [tab, setTab] = useState<'deposits' | 'game' | 'players'>('game');
  const [pattern, setPattern] = useState<PatternName>('Full House');
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [gameStatus, setGameStatus] = useState('waiting');

  const tabs = [
    { key: 'deposits' as const, label: 'Deposits', icon: CreditCard },
    { key: 'game' as const, label: 'Game', icon: Gamepad2 },
    { key: 'players' as const, label: 'Players', icon: Users },
  ];

  // Fetch current game state
  useEffect(() => {
    async function fetchState() {
      const [numbersRes, gameRes] = await Promise.all([
        supabase.from('game_numbers').select('number').eq('game_id', 'current').order('id', { ascending: true }),
        supabase.from('games').select('*').eq('id', 'current').single(),
      ]);
      if (numbersRes.data) setDrawnNumbers(numbersRes.data.map((n: any) => n.number));
      if (gameRes.data) {
        setPattern(gameRes.data.pattern as PatternName);
        setGameStatus(gameRes.data.status || 'waiting');
      }
    }
    fetchState();
  }, []);

  const drawNumber = async () => {
    if (drawnNumbers.length >= 75) {
      toast.error('All numbers drawn!');
      return;
    }
    let num: number;
    do {
      num = Math.floor(Math.random() * 75) + 1;
    } while (drawnNumbers.includes(num));

    const { error } = await supabase.from('game_numbers').insert({ number: num, game_id: 'current' });
    if (error) {
      toast.error('Failed to draw number');
      return;
    }
    setDrawnNumbers((prev) => [...prev, num]);
    toast.success(`${getBingoLetter(num)}-${num}`);
  };

  const startNewGame = async () => {
    // Delete old numbers
    await supabase.from('game_numbers').delete().eq('game_id', 'current');
    
    // Upsert game record
    await supabase.from('games').upsert({
      id: 'current',
      pattern,
      status: 'waiting',
      winner_id: null,
    });

    setDrawnNumbers([]);
    setGameStatus('waiting');
    toast.success('New game started!');
  };

  return (
    <PageShell title="Admin Panel">
      <div className="flex gap-2 mb-6">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              tab === key ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'game' && (
        <div className="space-y-4">
          {/* Pattern selection */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Winning Pattern</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PATTERNS) as PatternName[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPattern(p)}
                  className={`p-3 rounded-xl text-sm font-medium text-left transition-colors ${
                    pattern === p ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Start new game */}
          <button
            onClick={startNewGame}
            className="w-full py-4 rounded-xl font-display font-bold bg-secondary text-secondary-foreground text-lg active:scale-95 transition-transform"
          >
            Start New Game
          </button>

          {/* Draw number */}
          <button
            onClick={drawNumber}
            className="w-full py-5 rounded-2xl font-display font-bold text-2xl gradient-gold text-primary-foreground glow-gold active:scale-95 transition-transform"
          >
            🎱 Draw Number ({drawnNumbers.length}/75)
          </button>

          {/* Drawn numbers */}
          {drawnNumbers.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-2">Drawn Numbers</div>
              <div className="flex flex-wrap gap-1">
                {drawnNumbers.map((n) => (
                  <span
                    key={n}
                    className="w-8 h-8 text-xs rounded-md bg-primary/20 text-primary flex items-center justify-center font-medium"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}

          {gameStatus === 'won' && (
            <div className="p-4 rounded-xl bg-secondary/20 text-center">
              <span className="text-lg">🏆 We have a winner!</span>
            </div>
          )}
        </div>
      )}

      {tab === 'deposits' && (
        <div className="text-center text-muted-foreground py-8">Deposit management coming soon</div>
      )}

      {tab === 'players' && (
        <div className="text-center text-muted-foreground py-8">Player management coming soon</div>
      )}
    </PageShell>
  );
}
