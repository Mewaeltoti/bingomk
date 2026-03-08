import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import PageShell from '@/components/PageShell';
import { Users, CreditCard, Gamepad2, Check, X, AlertTriangle, Plus, Minus, Pause, Play, Square } from 'lucide-react';
import { PATTERNS, PatternName } from '@/lib/bingo';
import { getBingoLetter } from '@/lib/bingoEngine';
import { checkWin } from '@/lib/winDetection';
import { supabase } from '@/integrations/supabase/client';
import { useGamePresence } from '@/hooks/useGamePresence';
import { useUser } from '@/lib/auth';
import { toast } from 'sonner';

export default function Admin() {
  const [tab, setTab] = useState<'game' | 'deposits' | 'players'>('game');
  const [pattern, setPattern] = useState<PatternName>('Full House');
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [gameStatus, setGameStatus] = useState('waiting');
  const [autoDraw, setAutoDraw] = useState(false);
  const [drawSpeed, setDrawSpeed] = useState(10);
  const autoDrawRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const drawnRef = useRef<number[]>([]);

  const [deposits, setDeposits] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [adjustingPlayer, setAdjustingPlayer] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');

  const user = useUser();
  const onlinePlayers = useGamePresence(user?.id, 'Admin');

  const tabs = [
    { key: 'game' as const, label: 'Game', icon: Gamepad2 },
    { key: 'deposits' as const, label: 'Deposits', icon: CreditCard },
    { key: 'players' as const, label: 'Players', icon: Users },
  ];

  useEffect(() => { drawnRef.current = drawnNumbers; }, [drawnNumbers]);

  const enrichWithProfiles = async (records: any[], userIdField = 'user_id') => {
    if (!records.length) return records;
    const userIds = [...new Set(records.map(r => r[userIdField]))];
    const { data: profiles } = await supabase.from('profiles').select('id, phone, display_name').in('id', userIds);
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    return records.map(r => ({ ...r, profile: profileMap.get(r[userIdField]) || null }));
  };

  // Fetch initial game state
  useEffect(() => {
    async function fetchState() {
      const [numbersRes, gameRes, claimsRes] = await Promise.all([
        supabase.from('game_numbers').select('number').eq('game_id', 'current').order('id', { ascending: true }),
        supabase.from('games').select('*').eq('id', 'current').maybeSingle(),
        supabase.from('bingo_claims').select('*').eq('game_id', 'current'),
      ]);
      if (numbersRes.data) setDrawnNumbers(numbersRes.data.map((n: any) => n.number));
      if (gameRes.data) {
        setPattern(gameRes.data.pattern as PatternName);
        setGameStatus(gameRes.data.status || 'waiting');
        setDrawSpeed((gameRes.data as any).draw_speed || 10);
      }
      setClaims(await enrichWithProfiles(claimsRes.data || []));
    }
    fetchState();
  }, []);

  // Listen for claims → pause drawing → auto-validate
  useEffect(() => {
    const channel = supabase
      .channel('admin-claims')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bingo_claims' },
        async (payload: any) => {
          // Pause drawing immediately
          setAutoDraw(false);
          if (autoDrawRef.current) clearInterval(autoDrawRef.current);
          toast('⏸️ Claim received — pausing draw to verify...', { icon: '🔍' });

          await validateAndResolveClaim(payload.new);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const validateAndResolveClaim = async (claim: any) => {
    const cartelaId = claim.cartela_id;

    // Fetch only the specific cartela being claimed
    const { data: cartela } = await supabase
      .from('cartelas')
      .select('numbers')
      .eq('id', cartelaId)
      .single();

    const { data: gameData } = await supabase
      .from('games')
      .select('pattern')
      .eq('id', 'current')
      .single();

    const currentPattern = (gameData as any)?.pattern || 'Full House';

    const { data: nums } = await supabase
      .from('game_numbers')
      .select('number')
      .eq('game_id', 'current');

    const drawnSet = new Set((nums || []).map((n: any) => n.number));

    const isValid = cartela
      ? checkWin(cartela.numbers as number[][], drawnSet, currentPattern as PatternName)
      : false;

    if (isValid) {
      const drawnNumbersList = (nums || []).map((n: any) => n.number);

      await supabase.from('games').update({
        status: 'won',
        winner_id: claim.user_id,
      }).eq('id', 'current');

      await supabase.from('bingo_claims').update({ is_valid: true } as any).eq('id', claim.id);

      await supabase.from('game_history').insert({
        game_id: 'current',
        winner_id: claim.user_id,
        pattern: currentPattern,
        players_count: 0,
        prize: 0,
        drawn_numbers: drawnNumbersList,
      } as any);

      await supabase.from('game_numbers').delete().eq('game_id', 'current');

      setGameStatus('won');
      toast.success('🏆 System verified winner! Game over.');
    } else {
      // Invalid claim — update strike count
      const strikeCount = claim.strike_count || 1;
      await supabase.from('bingo_claims').update({
        is_valid: false,
        strike_count: strikeCount,
      } as any).eq('id', claim.id);

      if (strikeCount >= 2) {
        toast.error(`❌ Player struck out on #${cartelaId} — cartela removed`);
      } else {
        toast.warning(`❌ Invalid claim on #${cartelaId} — 1 chance left, resuming draw`);
      }
      // Resume drawing
      setAutoDraw(true);
    }

    const { data } = await supabase.from('bingo_claims').select('*').eq('game_id', 'current');
    setClaims(await enrichWithProfiles(data || []));
  };

  useEffect(() => {
    if (tab !== 'deposits') return;
    supabase.from('deposits').select('*')
      .order('created_at', { ascending: false })
      .then(async ({ data }) => setDeposits(await enrichWithProfiles(data || [])));
  }, [tab]);

  useEffect(() => {
    if (tab !== 'players') return;
    supabase.from('profiles').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setPlayers(data || []));
  }, [tab]);

  // Auto-draw interval
  useEffect(() => {
    if (autoDrawRef.current) clearInterval(autoDrawRef.current);
    if (autoDraw && gameStatus === 'active') {
      autoDrawRef.current = setInterval(() => drawNumberInternal(), drawSpeed * 1000);
    }
    return () => { if (autoDrawRef.current) clearInterval(autoDrawRef.current); };
  }, [autoDraw, gameStatus, drawSpeed]);

  const drawNumberInternal = async () => {
    const current = drawnRef.current;
    if (current.length >= 75) {
      setAutoDraw(false);
      toast.error('All 75 numbers drawn!');
      return;
    }
    let num: number;
    do { num = Math.floor(Math.random() * 75) + 1; } while (current.includes(num));

    const { error } = await supabase.from('game_numbers').insert({ number: num, game_id: 'current' });
    if (error) { toast.error('Failed to draw'); return; }
    setDrawnNumbers((prev) => [...prev, num]);
  };

  const startNewGame = async () => {
    setAutoDraw(false);
    if (autoDrawRef.current) clearInterval(autoDrawRef.current);

    await Promise.all([
      supabase.from('game_numbers').delete().eq('game_id', 'current'),
      supabase.from('bingo_claims').delete().eq('game_id', 'current'),
    ]);
    await supabase.from('games').upsert({
      id: 'current', pattern, status: 'active', winner_id: null, draw_speed: drawSpeed,
    } as any);
    setDrawnNumbers([]);
    setClaims([]);
    setGameStatus('active');
    setAutoDraw(true);
    toast.success(`🎲 Game started! Drawing every ${drawSpeed}s`);
  };

  const pauseGame = () => {
    setAutoDraw(false);
    toast('⏸️ Drawing paused');
  };

  const resumeGame = () => {
    setAutoDraw(true);
    toast('▶️ Drawing resumed');
  };

  const stopGame = async () => {
    setAutoDraw(false);
    await supabase.from('games').update({ status: 'stopped' }).eq('id', 'current');
    setGameStatus('stopped');
    toast('🛑 Game stopped');
  };

  const handleDeposit = async (id: string, action: 'approved' | 'rejected', userId: string, amount: number) => {
    const { error } = await supabase.from('deposits').update({ status: action }).eq('id', id);
    if (error) { toast.error('Failed'); return; }

    if (action === 'approved') {
      const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
      const bal = (profile as any)?.balance || 0;
      await supabase.from('profiles').update({ balance: bal + amount } as any).eq('id', userId);
      toast.success(`✅ Approved & credited ${amount} ETB`);
    } else {
      toast.success('Deposit rejected');
    }

    setDeposits((prev) => prev.map((d) => d.id === id ? { ...d, status: action } : d));
  };

  return (
    <PageShell title="Admin Panel">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/10 text-xs">
          <Users className="w-3.5 h-3.5 text-secondary" />
          <span className="font-bold text-secondary">{onlinePlayers.length}</span>
          <span className="text-muted-foreground">players online</span>
        </div>
      </div>

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
          {/* Pattern select */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Winning Pattern</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PATTERNS) as PatternName[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPattern(p)}
                  disabled={autoDraw}
                  className={`p-3 rounded-xl text-sm font-medium text-left transition-colors disabled:opacity-50 ${
                    pattern === p ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Draw speed */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Draw Speed: {drawSpeed}s</label>
            <input
              type="range"
              min={3}
              max={30}
              value={drawSpeed}
              onChange={(e) => setDrawSpeed(Number(e.target.value))}
              disabled={autoDraw}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>3s (fast)</span>
              <span>30s (slow)</span>
            </div>
          </div>

          {/* Game controls */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={startNewGame}
              disabled={autoDraw}
              className="py-3 rounded-xl font-display font-bold bg-secondary text-secondary-foreground text-sm active:scale-95 transition-transform disabled:opacity-50"
            >
              🎲 New Game
            </button>
            {autoDraw ? (
              <button
                onClick={pauseGame}
                className="py-3 rounded-xl font-display font-bold bg-primary text-primary-foreground text-sm active:scale-95 transition-transform flex items-center justify-center gap-1.5"
              >
                <Pause className="w-4 h-4" /> Pause
              </button>
            ) : gameStatus === 'active' ? (
              <button
                onClick={resumeGame}
                className="py-3 rounded-xl font-display font-bold bg-primary text-primary-foreground text-sm active:scale-95 transition-transform flex items-center justify-center gap-1.5"
              >
                <Play className="w-4 h-4" /> Resume
              </button>
            ) : (
              <button
                onClick={stopGame}
                disabled={gameStatus !== 'active'}
                className="py-3 rounded-xl font-display font-bold bg-destructive text-destructive-foreground text-sm active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Square className="w-4 h-4" /> Stop
              </button>
            )}
          </div>

          {/* Drawing status */}
          {autoDraw && (
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center space-y-1">
              <p className="text-sm font-display font-bold text-primary animate-pulse">
                🔄 Drawing every {drawSpeed}s...
              </p>
              <p className="text-xs text-muted-foreground">{drawnNumbers.length}/75 drawn</p>
            </div>
          )}

          {/* Claims - system-resolved */}
          {claims.length > 0 && (
            <div className="p-3 rounded-xl border border-border bg-muted/30 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <AlertTriangle className="w-4 h-4 text-primary" />
                Claims ({claims.length})
              </div>
              {claims.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {c.profile?.display_name || c.profile?.phone || c.user_id.slice(0, 8)}
                  </span>
                  <span className={c.is_valid ? 'text-secondary font-bold' : c.is_valid === false ? 'text-destructive' : 'text-muted-foreground'}>
                    {c.is_valid ? '✅ Valid — Winner!' : c.is_valid === false ? '❌ Invalid' : '⏳ Checking...'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Drawn numbers */}
          {drawnNumbers.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-2">Drawn ({drawnNumbers.length})</div>
              <div className="flex flex-wrap gap-1">
                {drawnNumbers.map((n, i) => (
                  <motion.span
                    key={n}
                    initial={i === drawnNumbers.length - 1 ? { scale: 0 } : false}
                    animate={{ scale: 1 }}
                    className="w-8 h-8 text-xs rounded-md bg-primary/20 text-primary flex items-center justify-center font-medium"
                  >
                    {getBingoLetter(n)}{n}
                  </motion.span>
                ))}
              </div>
            </div>
          )}

          {(gameStatus === 'won' || gameStatus === 'disqualified' || gameStatus === 'stopped') && (
            <div className="p-4 rounded-xl bg-muted/50 text-center">
              <span className="text-lg">
                {gameStatus === 'won' ? '🏆 Game finished!' : gameStatus === 'stopped' ? '🛑 Game stopped' : '🔄 Game disqualified!'}
              </span>
            </div>
          )}
        </div>
      )}

      {tab === 'deposits' && (
        <div className="space-y-2">
          {deposits.length === 0 && <p className="text-center text-muted-foreground py-8">No deposits yet</p>}
          {deposits.map((d) => (
            <div key={d.id} className="p-3 rounded-xl bg-muted/50 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">{d.bank} — {d.amount} ETB</div>
                  <div className="text-xs text-muted-foreground">
                    Ref: {d.reference} · {d.profile?.display_name || d.profile?.phone || 'Unknown'}
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  d.status === 'approved' ? 'bg-secondary/20 text-secondary' :
                  d.status === 'pending' ? 'bg-primary/20 text-primary' :
                  'bg-destructive/20 text-destructive'
                }`}>{d.status}</span>
              </div>
              {d.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => handleDeposit(d.id, 'approved', d.user_id, d.amount)}
                    className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium flex items-center justify-center gap-1">
                    <Check className="w-4 h-4" /> Approve
                  </button>
                  <button onClick={() => handleDeposit(d.id, 'rejected', d.user_id, d.amount)}
                    className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium flex items-center justify-center gap-1">
                    <X className="w-4 h-4" /> Decline
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'players' && (() => {
        const handleAdjust = async (playerId: string, amount: number) => {
          const player = players.find(p => p.id === playerId);
          if (!player) return;
          const newBalance = Math.max(0, (player.balance || 0) + amount);
          const { error } = await supabase.from('profiles').update({ balance: newBalance }).eq('id', playerId);
          if (error) { toast.error('Failed'); return; }
          setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, balance: newBalance } : p));
          setAdjustingPlayer(null);
          setAdjustAmount('');
          toast.success(`Balance → ${newBalance} ETB`);
        };

        return (
          <div className="space-y-2">
            {players.length === 0 && <p className="text-center text-muted-foreground py-8">No players yet</p>}
            {players.map((p) => (
              <div key={p.id} className="p-3 rounded-xl bg-muted/50 space-y-2">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setAdjustingPlayer(adjustingPlayer === p.id ? null : p.id)}>
                  <div>
                    <div className="text-sm font-medium text-foreground">{p.display_name || p.phone || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">{p.phone}</div>
                  </div>
                  <div className="text-sm font-display font-bold text-primary">{p.balance || 0} ETB</div>
                </div>
                {adjustingPlayer === p.id && (
                  <div className="flex gap-2 items-center pt-1">
                    <input
                      type="number"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      placeholder="Amount"
                      className="flex-1 px-3 py-2 rounded-lg bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      onClick={() => handleAdjust(p.id, Math.abs(Number(adjustAmount)))}
                      disabled={!adjustAmount || Number(adjustAmount) <= 0}
                      className="p-2 rounded-lg bg-secondary text-secondary-foreground disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleAdjust(p.id, -Math.abs(Number(adjustAmount)))}
                      disabled={!adjustAmount || Number(adjustAmount) <= 0}
                      className="p-2 rounded-lg bg-destructive text-destructive-foreground disabled:opacity-50"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })()}
    </PageShell>
  );
}
