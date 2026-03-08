import { useState, useEffect, useRef } from 'react';
import PageShell from '@/components/PageShell';
import { Users, CreditCard, Gamepad2, Check, X, Play, Square } from 'lucide-react';
import { PATTERNS, PatternName } from '@/lib/bingo';
import { getBingoLetter } from '@/lib/bingoEngine';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Admin() {
  const [tab, setTab] = useState<'deposits' | 'game' | 'players'>('game');
  const [pattern, setPattern] = useState<PatternName>('Full House');
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [gameStatus, setGameStatus] = useState('waiting');
  const [autoDraw, setAutoDraw] = useState(false);
  const autoDrawRef = useRef<NodeJS.Timeout | null>(null);

  // Deposits state
  const [deposits, setDeposits] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);

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

  // Fetch deposits
  useEffect(() => {
    if (tab !== 'deposits') return;
    async function fetchDeposits() {
      const { data } = await supabase
        .from('deposits')
        .select('*, profiles:user_id(phone, display_name)')
        .order('created_at', { ascending: false });
      setDeposits(data || []);
    }
    fetchDeposits();
  }, [tab]);

  // Fetch players
  useEffect(() => {
    if (tab !== 'players') return;
    async function fetchPlayers() {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      setPlayers(data || []);
    }
    fetchPlayers();
  }, [tab]);

  // Auto-draw interval
  useEffect(() => {
    if (autoDraw && gameStatus !== 'won') {
      autoDrawRef.current = setInterval(() => {
        drawNumberInternal();
      }, 10000);
    }
    return () => {
      if (autoDrawRef.current) clearInterval(autoDrawRef.current);
    };
  }, [autoDraw, drawnNumbers, gameStatus]);

  const drawNumberInternal = async () => {
    const currentDrawn = drawnNumbers;
    if (currentDrawn.length >= 75) {
      setAutoDraw(false);
      toast.error('All numbers drawn!');
      return;
    }
    let num: number;
    do {
      num = Math.floor(Math.random() * 75) + 1;
    } while (currentDrawn.includes(num));

    const { error } = await supabase.from('game_numbers').insert({ number: num, game_id: 'current' });
    if (error) {
      toast.error('Failed to draw number');
      return;
    }
    setDrawnNumbers((prev) => [...prev, num]);
  };

  const drawNumber = async () => {
    await drawNumberInternal();
  };

  const startNewGame = async () => {
    setAutoDraw(false);
    await supabase.from('game_numbers').delete().eq('game_id', 'current');
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

  const handleDeposit = async (id: string, action: 'approved' | 'rejected', userId: string, amount: number) => {
    const { error } = await supabase
      .from('deposits')
      .update({ status: action })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update deposit');
      return;
    }

    // If approved, add balance
    if (action === 'approved') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .single();

      const currentBalance = (profile as any)?.balance || 0;
      await supabase
        .from('profiles')
        .update({ balance: currentBalance + amount } as any)
        .eq('id', userId);
    }

    setDeposits((prev) => prev.map((d) => d.id === id ? { ...d, status: action } : d));
    toast.success(`Deposit ${action}`);
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

          <button
            onClick={startNewGame}
            className="w-full py-4 rounded-xl font-display font-bold bg-secondary text-secondary-foreground text-lg active:scale-95 transition-transform"
          >
            Start New Game
          </button>

          <div className="flex gap-2">
            <button
              onClick={drawNumber}
              className="flex-1 py-4 rounded-2xl font-display font-bold text-lg gradient-gold text-primary-foreground glow-gold active:scale-95 transition-transform"
            >
              🎱 Draw ({drawnNumbers.length}/75)
            </button>
            <button
              onClick={() => setAutoDraw(!autoDraw)}
              className={`px-4 rounded-2xl font-bold text-lg active:scale-95 transition-transform ${
                autoDraw ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {autoDraw ? <Square className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
          </div>
          {autoDraw && (
            <p className="text-xs text-center text-primary animate-pulse">Auto-drawing every 10 seconds...</p>
          )}

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
        <div className="space-y-2">
          {deposits.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No deposits yet</p>
          )}
          {deposits.map((d) => (
            <div key={d.id} className="p-3 rounded-xl bg-muted/50 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">{d.bank} — {d.amount} ETB</div>
                  <div className="text-xs text-muted-foreground">
                    Ref: {d.reference} · {(d.profiles as any)?.phone || 'Unknown'}
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  d.status === 'approved' ? 'bg-secondary/20 text-secondary' :
                  d.status === 'pending' ? 'bg-primary/20 text-primary' :
                  'bg-destructive/20 text-destructive'
                }`}>
                  {d.status}
                </span>
              </div>
              {d.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDeposit(d.id, 'approved', d.user_id, d.amount)}
                    className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium flex items-center justify-center gap-1"
                  >
                    <Check className="w-4 h-4" /> Approve
                  </button>
                  <button
                    onClick={() => handleDeposit(d.id, 'rejected', d.user_id, d.amount)}
                    className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium flex items-center justify-center gap-1"
                  >
                    <X className="w-4 h-4" /> Decline
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'players' && (
        <div className="space-y-2">
          {players.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No players yet</p>
          )}
          {players.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
              <div>
                <div className="text-sm font-medium text-foreground">{p.display_name || p.phone || 'Unknown'}</div>
                <div className="text-xs text-muted-foreground">{p.phone}</div>
              </div>
              <div className="text-sm font-display font-bold text-primary">{p.balance || 0} ETB</div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
