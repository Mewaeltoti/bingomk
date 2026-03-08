import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import PageShell from '@/components/PageShell';
import { Users, CreditCard, Gamepad2, Check, X, AlertTriangle, Plus, Minus, Pause, Play, Square, ArrowUpCircle } from 'lucide-react';
import { PATTERNS, PatternName } from '@/lib/bingo';
import { getBingoLetter } from '@/lib/bingoEngine';
import { checkWin } from '@/lib/winDetection';
import { supabase } from '@/integrations/supabase/client';
import { useGamePresence } from '@/hooks/useGamePresence';
import { useUser } from '@/lib/auth';
import { toast } from 'sonner';

export default function Admin() {
  const [tab, setTab] = useState<'game' | 'deposits' | 'withdrawals' | 'players'>('game');
  const [pattern, setPattern] = useState<PatternName>('Full House');
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [gameStatus, setGameStatus] = useState('waiting');
  const [autoDraw, setAutoDraw] = useState(false);
  const [drawSpeed, setDrawSpeed] = useState(10);
  const [prizeAmount, setPrizeAmount] = useState(0);
  const [buyingCountdown, setBuyingCountdown] = useState(0);
  const autoDrawRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const buyingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const drawnRef = useRef<number[]>([]);

  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [adjustingPlayer, setAdjustingPlayer] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');

  const user = useUser();
  const onlinePlayers = useGamePresence(user?.id, 'Admin');

  const tabs = [
    { key: 'game' as const, label: 'Game', icon: Gamepad2 },
    { key: 'deposits' as const, label: 'Deposits', icon: CreditCard },
    { key: 'withdrawals' as const, label: 'Withdrawals', icon: ArrowUpCircle },
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
        setPrizeAmount((gameRes.data as any).prize_amount || 0);
        // If game was left in 'buying' state after reload, allow admin to start immediately
        if (gameRes.data.status === 'buying') {
          setBuyingCountdown(0); // show "Skip & Start Now" immediately
        }
      }
      setClaims(await enrichWithProfiles(claimsRes.data || []));
    }
    fetchState();
  }, []);

  // Listen for claims → pause drawing → then admin manually verifies
  useEffect(() => {
    const channel = supabase
      .channel('admin-claims')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bingo_claims' },
        async (payload: any) => {
          // Pause drawing immediately when claim arrives
          setAutoDraw(false);
          if (autoDrawRef.current) clearInterval(autoDrawRef.current);
          toast('⏸️ Claim received — pausing draw for manual verification', { icon: '🔍' });

          // Refresh claims list
          const { data } = await supabase.from('bingo_claims').select('*').eq('game_id', 'current');
          setClaims(await enrichWithProfiles(data || []));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Manual verification by admin
  const verifyClaimManually = async (claim: any, isValid: boolean) => {
    const cartelaId = claim.cartela_id;

    if (isValid) {
      await supabase.from('bingo_claims').update({ is_valid: true } as any).eq('id', claim.id);
      
      // Count unique players with valid claims (including this one)
      const alreadyValidClaims = claims.filter((c: any) => c.is_valid === true);
      const allValidUserIds = new Set([claim.user_id, ...alreadyValidClaims.map((c: any) => c.user_id)]);
      const uniqueWinnerCount = allValidUserIds.size;

      if (uniqueWinnerCount >= 3) {
        // 3+ different players — disqualify round
        await supabase.from('games').update({ status: 'disqualified', winner_id: null } as any).eq('id', 'current');
        await supabase.from('game_numbers').delete().eq('game_id', 'current');
        await supabase.from('bingo_claims').delete().eq('game_id', 'current');
        setGameStatus('disqualified');
        setDrawnNumbers([]);
        setClaims([]);
        toast.error('🔄 3+ different winners — Round restart!');
        setTimeout(startNewGame, 3000);
        return;
      }

      // Check if there are still pending claims
      const pendingClaims = claims.filter((c: any) => c.is_valid === null && c.id !== claim.id);
      if (pendingClaims.length > 0) {
        toast.success(`✅ Claim valid! ${pendingClaims.length} more pending...`);
      } else {
        // No more pending — resolve game
        const { data: nums } = await supabase.from('game_numbers').select('number').eq('game_id', 'current');
        const drawnNumbersList = (nums || []).map((n: any) => n.number);
        
        // Count players (cartelas with owners)
        const { count: playersCount } = await supabase.from('cartelas').select('owner_id', { count: 'exact', head: true }).eq('is_used', true).not('owner_id', 'is', null);

        const prizePerWinner = uniqueWinnerCount === 2 ? prizeAmount / 2 : prizeAmount;
        await supabase.from('games').update({ status: 'won', winner_id: claim.user_id }).eq('id', 'current');
        await supabase.from('game_history').insert({
          game_id: 'current', winner_id: claim.user_id, pattern,
          players_count: playersCount || 0, prize: prizePerWinner, drawn_numbers: drawnNumbersList,
        } as any);
        await supabase.from('game_numbers').delete().eq('game_id', 'current');

        // Credit winner balances
        for (const wId of Array.from(allValidUserIds)) {
          const { data: wp } = await supabase.from('profiles').select('balance').eq('id', wId).single();
          if (wp) {
            await supabase.from('profiles').update({ balance: (wp as any).balance + prizePerWinner } as any).eq('id', wId);
          }
        }

        setGameStatus('won');

        if (uniqueWinnerCount === 2) {
          toast.success(`🏆 2 winners — ${prizePerWinner} ETB each credited!`);
        } else {
          toast.success(`🏆 Winner gets ${prizePerWinner} ETB! Balance credited.`);
        }
      }
    } else {
      await supabase.from('bingo_claims').update({ is_valid: false } as any).eq('id', claim.id);
      toast.warning(`❌ Invalid claim on #${cartelaId}`);
      
      // Resume if no more pending
      const remainingPending = claims.filter((c: any) => c.is_valid === null && c.id !== claim.id);
      if (remainingPending.length === 0) {
        toast('▶️ No more pending claims — resuming draw');
        setAutoDraw(true);
      }
    }

    const { data } = await supabase.from('bingo_claims').select('*').eq('game_id', 'current');
    setClaims(await enrichWithProfiles(data || []));
  };

  // Verify all pending claims at once — count unique PLAYERS not claims
  const verifyAllPendingClaims = async () => {
    const pendingClaims = claims.filter((c: any) => c.is_valid === null);
    if (pendingClaims.length === 0) return;

    const { data: nums } = await supabase.from('game_numbers').select('number').eq('game_id', 'current');
    const drawnSet = new Set((nums || []).map((n: any) => n.number));
    
    const { data: gameData } = await supabase.from('games').select('pattern').eq('id', 'current').single();
    const currentPattern = (gameData as any)?.pattern || 'Full House';

    const validClaimers: any[] = [];

    for (const claim of pendingClaims) {
      const { data: cartela } = await supabase.from('cartelas').select('numbers').eq('id', claim.cartela_id).single();
      const isValid = cartela ? checkWin(cartela.numbers as number[][], drawnSet, currentPattern as PatternName) : false;
      
      if (isValid) {
        validClaimers.push(claim);
        await supabase.from('bingo_claims').update({ is_valid: true } as any).eq('id', claim.id);
      } else {
        await supabase.from('bingo_claims').update({ is_valid: false } as any).eq('id', claim.id);
      }
    }

    // Count unique winning PLAYERS (same player with multiple cartelas = 1 winner)
    const uniqueWinnerIds = [...new Set(validClaimers.map((c: any) => c.user_id))];
    const uniqueWinnerCount = uniqueWinnerIds.length;

    if (uniqueWinnerCount === 0) {
      toast.warning('No valid claims — resuming draw');
      setAutoDraw(true);
    } else if (uniqueWinnerCount === 1) {
      // Single player wins (even if multiple cartelas)
      const drawnNumbersList = (nums || []).map((n: any) => n.number);
      const winnerId = uniqueWinnerIds[0];
      const { count: playersCount } = await supabase.from('cartelas').select('owner_id', { count: 'exact', head: true }).eq('is_used', true).not('owner_id', 'is', null);
      await supabase.from('games').update({ status: 'won', winner_id: winnerId }).eq('id', 'current');
      await supabase.from('game_history').insert({
        game_id: 'current', winner_id: winnerId, pattern: currentPattern,
        players_count: playersCount || 0, prize: prizeAmount, drawn_numbers: drawnNumbersList,
      } as any);
      await supabase.from('game_numbers').delete().eq('game_id', 'current');

      // Credit winner balance
      const { data: wp } = await supabase.from('profiles').select('balance').eq('id', winnerId).single();
      if (wp) {
        await supabase.from('profiles').update({ balance: (wp as any).balance + prizeAmount } as any).eq('id', winnerId);
      }

      setGameStatus('won');
      setDrawnNumbers([]);
      const winnerName = validClaimers.find((c: any) => c.user_id === winnerId)?.profile?.display_name || 'Player';
      toast.success(`🏆 ${winnerName} wins ${prizeAmount} ETB! Balance credited.`);
    } else if (uniqueWinnerCount === 2) {
      // 2 different players — split prize
      const splitPrize = prizeAmount / 2;
      const drawnNumbersList = (nums || []).map((n: any) => n.number);
      const { count: playersCount2 } = await supabase.from('cartelas').select('owner_id', { count: 'exact', head: true }).eq('is_used', true).not('owner_id', 'is', null);
      await supabase.from('games').update({ status: 'won', winner_id: uniqueWinnerIds[0] }).eq('id', 'current');
      for (const wId of uniqueWinnerIds) {
        await supabase.from('game_history').insert({
          game_id: 'current', winner_id: wId, pattern: currentPattern,
          players_count: playersCount2 || 0, prize: splitPrize, drawn_numbers: drawnNumbersList,
        } as any);
        // Credit each winner
        const { data: wp } = await supabase.from('profiles').select('balance').eq('id', wId).single();
        if (wp) {
          await supabase.from('profiles').update({ balance: (wp as any).balance + splitPrize } as any).eq('id', wId);
        }
      }
      await supabase.from('game_numbers').delete().eq('game_id', 'current');
      setGameStatus('won');
      setDrawnNumbers([]);
      const names = uniqueWinnerIds.map(id => {
        const c = validClaimers.find((cl: any) => cl.user_id === id);
        return c?.profile?.display_name || c?.profile?.phone || 'Player';
      });
      toast.success(`🏆 ${splitPrize} ETB each: ${names.join(' & ')}`);
    } else {
      // 3+ different players — disqualify round
      await supabase.from('games').update({ status: 'disqualified', winner_id: null } as any).eq('id', 'current');
      await supabase.from('game_numbers').delete().eq('game_id', 'current');
      await supabase.from('bingo_claims').delete().eq('game_id', 'current');
      setGameStatus('disqualified');
      setDrawnNumbers([]);
      setClaims([]);
      toast.error(`🔄 ${uniqueWinnerCount} different winners — Round restart!`);
      setTimeout(startNewGame, 3000);
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
    if (tab !== 'withdrawals') return;
    (supabase.from('withdrawals' as any) as any).select('*')
      .order('created_at', { ascending: false })
      .then(async ({ data }: any) => setWithdrawals(await enrichWithProfiles(data || [])));
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
    if (buyingTimerRef.current) clearInterval(buyingTimerRef.current);

    await Promise.all([
      supabase.from('game_numbers').delete().eq('game_id', 'current'),
      supabase.from('bingo_claims').delete().eq('game_id', 'current'),
      supabase.from('cartelas').update({ is_used: false, owner_id: null } as any).eq('is_used', true),
    ]);
    // Set game to "buying" status — 2 min rest
    await supabase.from('games').upsert({
      id: 'current', pattern, status: 'buying', winner_id: null, draw_speed: drawSpeed, prize_amount: prizeAmount,
    } as any);
    setDrawnNumbers([]);
    setClaims([]);
    setGameStatus('buying');
    setBuyingCountdown(120);
    toast.success('🛒 2-minute buying period started! Players can buy cartelas now.');

    // Start countdown
    buyingTimerRef.current = setInterval(() => {
      setBuyingCountdown(prev => {
        if (prev <= 1) {
          if (buyingTimerRef.current) clearInterval(buyingTimerRef.current);
          // Auto-start drawing
          startDrawing();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startDrawing = async () => {
    await supabase.from('games').update({ status: 'active' } as any).eq('id', 'current');
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

          {/* Prize Amount */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Prize Pot (ETB)</label>
            <input
              type="number"
              min={0}
              step={10}
              value={prizeAmount}
              onChange={(e) => setPrizeAmount(Number(e.target.value) || 0)}
              disabled={autoDraw}
              placeholder="Enter prize amount"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground mt-1">
              1 winner = full • 2 winners = {prizeAmount ? (prizeAmount / 2).toFixed(0) : '0'} ETB each
            </p>
          </div>

          {/* Game controls */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={startNewGame}
              disabled={autoDraw || gameStatus === 'buying'}
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

          {/* Buying countdown */}
          {gameStatus === 'buying' && (
            <div className="p-4 rounded-xl bg-accent/10 border border-accent/30 text-center space-y-2">
              <p className="text-sm font-display font-bold text-foreground">
                🛒 Buying Period
              </p>
              {buyingCountdown > 0 && (
                <div className="text-3xl font-display font-bold text-primary">
                  {Math.floor(buyingCountdown / 60)}:{String(buyingCountdown % 60).padStart(2, '0')}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {buyingCountdown > 0 ? 'Game starts when timer ends' : 'Ready to start drawing'}
              </p>
              <button
                onClick={() => {
                  if (buyingTimerRef.current) clearInterval(buyingTimerRef.current);
                  setBuyingCountdown(0);
                  startDrawing();
                }}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold"
              >
                {buyingCountdown > 0 ? 'Skip & Start Now' : '▶️ Start Drawing'}
              </button>
            </div>
          )}

          {/* Drawing status */}
          {autoDraw && (
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center space-y-1">
              <p className="text-sm font-display font-bold text-primary animate-pulse">
                🔄 Drawing every {drawSpeed}s...
              </p>
              <p className="text-xs text-muted-foreground">{drawnNumbers.length}/75 drawn</p>
            </div>
          )}

          {/* Claims - manual verification */}
          {claims.length > 0 && (
            <div className="p-3 rounded-xl border border-border bg-muted/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <AlertTriangle className="w-4 h-4 text-primary" />
                  Claims ({claims.length})
                </div>
                {claims.some((c: any) => c.is_valid === null) && (
                  <button
                    onClick={verifyAllPendingClaims}
                    className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold"
                  >
                    Verify All
                  </button>
                )}
              </div>
              {claims.map((c: any) => (
                <div key={c.id} className="p-2 rounded-lg bg-card border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-foreground">
                        {c.profile?.display_name || c.profile?.phone || c.user_id.slice(0, 8)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        Cartela #{c.cartela_id}
                      </span>
                    </div>
                    <span className={c.is_valid ? 'text-secondary font-bold text-xs' : c.is_valid === false ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'}>
                      {c.is_valid ? '✅ Winner!' : c.is_valid === false ? '❌ Invalid' : '⏳ Pending'}
                    </span>
                  </div>
                  {c.is_valid === null && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => verifyClaimManually(c, true)}
                        className="flex-1 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold flex items-center justify-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Valid Winner
                      </button>
                      <button
                        onClick={() => verifyClaimManually(c, false)}
                        className="flex-1 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Invalid
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground text-center">
                1 winner = full prize • 2 winners = split • 3+ = round restart
              </p>
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

      {tab === 'withdrawals' && (
        <div className="space-y-2">
          {withdrawals.length === 0 && <p className="text-center text-muted-foreground py-8">No withdrawal requests</p>}
          {withdrawals.map((w: any) => (
            <div key={w.id} className="p-3 rounded-xl bg-muted/50 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">{w.bank} — {w.amount} ETB</div>
                  <div className="text-xs text-muted-foreground">
                    Acct: {w.account_number} · {w.profile?.display_name || w.profile?.phone || 'Unknown'}
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  w.status === 'approved' ? 'bg-secondary/20 text-secondary' :
                  w.status === 'pending' ? 'bg-primary/20 text-primary' :
                  'bg-destructive/20 text-destructive'
                }`}>{w.status}</span>
              </div>
              {w.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={async () => {
                    // Deduct balance then approve
                    const { data: profile } = await supabase.from('profiles').select('balance').eq('id', w.user_id).single();
                    const bal = (profile as any)?.balance || 0;
                    if (bal < w.amount) { toast.error('User has insufficient balance'); return; }
                    await supabase.from('profiles').update({ balance: bal - w.amount } as any).eq('id', w.user_id);
                    await (supabase.from('withdrawals' as any) as any).update({ status: 'approved' }).eq('id', w.id);
                    setWithdrawals(prev => prev.map(x => x.id === w.id ? { ...x, status: 'approved' } : x));
                    toast.success(`✅ Approved & deducted ${w.amount} ETB`);
                  }}
                    className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium flex items-center justify-center gap-1">
                    <Check className="w-4 h-4" /> Approve
                  </button>
                  <button onClick={async () => {
                    await (supabase.from('withdrawals' as any) as any).update({ status: 'rejected' }).eq('id', w.id);
                    setWithdrawals(prev => prev.map(x => x.id === w.id ? { ...x, status: 'rejected' } : x));
                    toast.success('Withdrawal rejected');
                  }}
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
