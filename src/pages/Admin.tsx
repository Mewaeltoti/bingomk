import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import PageShell from '@/components/PageShell';
import { Users, CreditCard, Gamepad2, Check, X, AlertTriangle, Plus, Minus, Pause, Play, Square, ArrowUpCircle, LogOut, KeyRound } from 'lucide-react';
import { PATTERNS, PatternName } from '@/lib/bingo';
import { getBingoLetter } from '@/lib/bingoEngine';
import { supabase } from '@/integrations/supabase/client';
import { invokeWithRetry } from '@/lib/edgeFn';
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
  const [cartelaPrice, setCartelaPrice] = useState(10);
  
  const [boughtCount, setBoughtCount] = useState(0);
  const [buyingCountdown, setBuyingCountdown] = useState(0);
  
  const buyingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const drawnRef = useRef<number[]>([]);
  const drawingStartedRef = useRef(false);

  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [adjustingPlayer, setAdjustingPlayer] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [resetPasswordPlayer, setResetPasswordPlayer] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const user = useUser();
  const navigate = useNavigate();
  const onlinePlayers = useGamePresence(user?.id, 'Admin');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
    navigate('/login');
  };

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


  useEffect(() => {
    const channel = supabase
      .channel('admin-claims')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bingo_claims' },
        async (payload: any) => {
          // Edge function auto-pauses on pending claims, just update UI
          setAutoDraw(false);
          toast('⏸️ Claim received — draw paused for verification', { icon: '🔍' });

          const { data } = await supabase.from('bingo_claims').select('*').eq('game_id', 'current');
          setClaims(await enrichWithProfiles(data || []));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Manual verification by admin — via edge function
  const verifyClaimManually = async (claim: any, isValid: boolean) => {
    setActionLoading(`verify-${claim.id}`);
    const { data, error } = await invokeWithRetry('verify-claim', {
      body: { action: 'verify_single', claim_id: claim.id, is_valid: isValid },
    });
    setActionLoading(null);

    if (error) { toast.error(`Verification failed: ${error}`); return; }

    if (!isValid) {
      toast.warning(`❌ Invalid claim on #${claim.cartela_id}`);
    } else if (data?.result === 'valid_pending_remaining') {
      toast.success(`✅ Claim valid! ${data.remaining} more pending...`);
    } else if (data?.result === 'won') {
      setGameStatus('won');
      setDrawnNumbers([]);
      if (data.winner_count === 2) {
        toast.success(`🏆 2 winners — ${data.prize_per_winner} ETB each credited!`);
      } else {
        toast.success(`🏆 Winner gets ${data.prize_per_winner} ETB! Balance credited.`);
      }
      setTimeout(startNewGame, 10000);
    } else if (data?.result === 'disqualified') {
      setGameStatus('disqualified');
      setDrawnNumbers([]);
      setClaims([]);
      toast.error(`🔄 ${data.winner_count} different winners — Round restart!`);
      setTimeout(startNewGame, 3000);
    }

    const { data: claimsRefresh } = await supabase.from('bingo_claims').select('*').eq('game_id', 'current');
    setClaims(await enrichWithProfiles(claimsRefresh || []));
  };

  // Verify all pending claims — via edge function
  const verifyAllPendingClaims = async () => {
    setActionLoading('verify-all');
    const { data, error } = await invokeWithRetry('verify-claim', {
      body: { action: 'verify_all' },
    });
    setActionLoading(null);

    if (error) { toast.error(`Verification failed: ${error}`); return; }

    if (data?.result === 'no_pending') {
      toast('No pending claims');
    } else if (data?.result === 'no_winners_resume') {
      toast.warning('No valid claims — resuming draw');
      setAutoDraw(true);
    } else if (data?.result === 'won') {
      setGameStatus('won');
      setDrawnNumbers([]);
      if (data.winner_count === 2) {
        toast.success(`🏆 2 winners — ${data.prize_per_winner} ETB each!`);
      } else {
        toast.success(`🏆 Winner gets ${data.prize_per_winner} ETB! Balance credited.`);
      }
      setTimeout(startNewGame, 10000);
    } else if (data?.result === 'disqualified') {
      setGameStatus('disqualified');
      setDrawnNumbers([]);
      setClaims([]);
      toast.error(`🔄 ${data.winner_count} different winners — Round restart!`);
      setTimeout(startNewGame, 3000);
    }

    const { data: claimsRefresh } = await supabase.from('bingo_claims').select('*').eq('game_id', 'current');
    setClaims(await enrichWithProfiles(claimsRefresh || []));
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

  // Auto-draw is now server-side — sync UI state from DB
  useEffect(() => {
    // Listen for game changes to sync autoDraw state
    const channel = supabase
      .channel('admin-game-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: 'id=eq.current' },
        (payload: any) => {
          const game = payload.new;
          setAutoDraw(game.auto_draw || false);
          setGameStatus(game.status);
          if (game.draw_speed) setDrawSpeed(game.draw_speed);
          if (game.prize_amount !== undefined) setPrizeAmount(game.prize_amount);
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_numbers' },
        (payload: any) => {
          setDrawnNumbers(prev => [...prev, payload.new.number]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);


  const startNewGame = async () => {
    setActionLoading('new-game');
    setAutoDraw(false);
    if (buyingTimerRef.current) clearInterval(buyingTimerRef.current);

    const { error } = await invokeWithRetry('game-lifecycle', {
      body: { action: 'new_game', pattern, draw_speed: drawSpeed, cartela_price: cartelaPrice },
    });
    if (error) { toast.error(`Failed: ${error}`); setActionLoading(null); return; }
    setActionLoading(null);

    setBoughtCount(0);
    setDrawnNumbers([]);
    setClaims([]);
    setGameStatus('buying');
    setBuyingCountdown(120);
    drawingStartedRef.current = false;
    toast.success('🛒 2-minute buying period started! Players can buy cartelas now.');

    // Start countdown
    buyingTimerRef.current = setInterval(() => {
      setBuyingCountdown(prev => {
        if (prev % 10 === 0) {
          supabase.from('cartelas').select('id', { count: 'exact', head: true })
            .eq('is_used', true).not('owner_id', 'is', null)
            .then(({ count }) => setBoughtCount(count || 0));
        }
        if (prev <= 1) {
          if (buyingTimerRef.current) clearInterval(buyingTimerRef.current);
          buyingTimerRef.current = null;
          if (!drawingStartedRef.current) {
            drawingStartedRef.current = true;
            startDrawing();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startDrawing = async () => {
    setActionLoading('start-drawing');
    const { data, error } = await invokeWithRetry('game-lifecycle', {
      body: { action: 'start_drawing', prize_amount: prizeAmount },
    });
    setActionLoading(null);
    if (error) { toast.error(`Failed: ${error}`); return; }

    const bought = data?.bought || 0;
    setBoughtCount(bought);
    setGameStatus('active');
    setAutoDraw(true);
    toast.success(`🎲 Game started! ${bought} cartelas sold, prize: ${prizeAmount} ETB`);
  };

  const pauseGame = async () => {
    setActionLoading('pause');
    await invokeWithRetry('game-lifecycle', { body: { action: 'pause' } });
    setActionLoading(null);
    setAutoDraw(false);
    toast('⏸️ Drawing paused');
  };

  const resumeGame = async () => {
    setActionLoading('resume');
    await invokeWithRetry('game-lifecycle', { body: { action: 'resume' } });
    setActionLoading(null);
    setAutoDraw(true);
    toast('▶️ Drawing resumed');
  };

  const stopGame = async () => {
    setActionLoading('stop');
    await invokeWithRetry('game-lifecycle', { body: { action: 'stop' } });
    setActionLoading(null);
    setAutoDraw(false);
    setGameStatus('stopped');
    toast('🛑 Game stopped');
  };

  const handleDeposit = async (id: string, action: 'approved' | 'rejected', userId: string, amount: number) => {
    setActionLoading(`dep-${id}`);
    const { error } = await invokeWithRetry('approve-transaction', {
      body: { type: 'deposit', id, action, user_id: userId, amount },
    });
    setActionLoading(null);
    if (error) { toast.error(`Failed: ${error}`); return; }

    toast.success(action === 'approved' ? `✅ Approved & credited ${amount} ETB` : 'Deposit rejected');
    setDeposits((prev) => prev.map((d) => d.id === id ? { ...d, status: action } : d));
  };

  return (
    <PageShell title="Admin Panel">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl font-bold">
            <span className="text-secondary">Bingo</span>{' '}
            <span className="text-primary">Ethio</span>
          </h1>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded">Admin</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </button>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/10 text-xs w-fit mb-4">
        <Users className="w-3.5 h-3.5 text-secondary" />
        <span className="font-bold text-secondary">{onlinePlayers.length}</span>
        <span className="text-muted-foreground">players online</span>
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

          {/* Cartela Price & Prize Pot */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Cartela Price (ETB)</label>
              <input
                type="number"
                min={1}
                value={cartelaPrice}
                onChange={(e) => setCartelaPrice(Number(e.target.value) || 1)}
                disabled={autoDraw || gameStatus === 'active'}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Prize Pot (ETB)</label>
              <input
                type="number"
                min={0}
                value={prizeAmount}
                onChange={(e) => setPrizeAmount(Number(e.target.value) || 0)}
                disabled={autoDraw || gameStatus === 'active'}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
              <div className="flex gap-1.5 mt-1.5">
                {[50, 100, 200, 500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setPrizeAmount(amt)}
                    disabled={autoDraw || gameStatus === 'active'}
                    className={`flex-1 py-1 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                      prizeAmount === amt
                        ? 'gradient-gold text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sales info */}
          <div className="p-3 rounded-xl bg-muted/50 border border-border space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Cartelas sold</span>
              <span className="text-foreground font-medium">{boughtCount}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total sales</span>
              <span className="text-foreground font-medium">{boughtCount * cartelaPrice} ETB</span>
            </div>
            <div className="border-t border-border my-1" />
            <div className="flex justify-between text-sm font-bold">
              <span className="text-foreground">Prize pot</span>
              <span className="text-primary">{prizeAmount} ETB</span>
            </div>
          </div>

          {/* Game controls */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={startNewGame}
              disabled={autoDraw || gameStatus === 'buying' || actionLoading === 'new-game'}
              className="py-3 rounded-xl font-display font-bold bg-secondary text-secondary-foreground text-sm active:scale-95 transition-transform disabled:opacity-50"
            >
              {actionLoading === 'new-game' ? '⏳ Starting...' : '🎲 New Game'}
            </button>
            {autoDraw ? (
              <button
                onClick={pauseGame}
                disabled={actionLoading === 'pause'}
                className="py-3 rounded-xl font-display font-bold bg-primary text-primary-foreground text-sm active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {actionLoading === 'pause' ? '⏳...' : <><Pause className="w-4 h-4" /> Pause</>}
              </button>
            ) : gameStatus === 'active' ? (
              <button
                onClick={resumeGame}
                disabled={actionLoading === 'resume'}
                className="py-3 rounded-xl font-display font-bold bg-primary text-primary-foreground text-sm active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {actionLoading === 'resume' ? '⏳...' : <><Play className="w-4 h-4" /> Resume</>}
              </button>
            ) : (
              <button
                onClick={stopGame}
                disabled={gameStatus !== 'active' || actionLoading === 'stop'}
                className="py-3 rounded-xl font-display font-bold bg-destructive text-destructive-foreground text-sm active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {actionLoading === 'stop' ? '⏳...' : <><Square className="w-4 h-4" /> Stop</>}
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
                  buyingTimerRef.current = null;
                  setBuyingCountdown(0);
                  if (!drawingStartedRef.current) {
                    drawingStartedRef.current = true;
                    startDrawing();
                  }
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
                    disabled={actionLoading === 'verify-all'}
                    className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
                  >
                    {actionLoading === 'verify-all' ? '⏳ Verifying...' : 'Verify All'}
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
                        disabled={!!actionLoading}
                        className="flex-1 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {actionLoading === `verify-${c.id}` ? '⏳...' : <><Check className="w-3.5 h-3.5" /> Valid Winner</>}
                      </button>
                      <button
                        onClick={() => verifyClaimManually(c, false)}
                        disabled={!!actionLoading}
                        className="flex-1 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {actionLoading === `verify-${c.id}` ? '⏳...' : <><X className="w-3.5 h-3.5" /> Invalid</>}
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
                    disabled={actionLoading === `dep-${d.id}`}
                    className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50">
                    {actionLoading === `dep-${d.id}` ? '⏳...' : <><Check className="w-4 h-4" /> Approve</>}
                  </button>
                  <button onClick={() => handleDeposit(d.id, 'rejected', d.user_id, d.amount)}
                    disabled={actionLoading === `dep-${d.id}`}
                    className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50">
                    {actionLoading === `dep-${d.id}` ? '⏳...' : <><X className="w-4 h-4" /> Decline</>}
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
                    setActionLoading(`wd-${w.id}`);
                    const { data, error } = await invokeWithRetry('approve-transaction', {
                      body: { type: 'withdrawal', id: w.id, action: 'approved', user_id: w.user_id, amount: w.amount },
                    });
                    setActionLoading(null);
                    if (error) { toast.error(error); return; }
                    setWithdrawals(prev => prev.map(x => x.id === w.id ? { ...x, status: 'approved' } : x));
                    toast.success(`✅ Approved & deducted ${w.amount} ETB`);
                  }}
                    disabled={actionLoading === `wd-${w.id}`}
                    className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50">
                    {actionLoading === `wd-${w.id}` ? '⏳...' : <><Check className="w-4 h-4" /> Approve</>}
                  </button>
                  <button onClick={async () => {
                    setActionLoading(`wd-${w.id}`);
                    await invokeWithRetry('approve-transaction', {
                      body: { type: 'withdrawal', id: w.id, action: 'rejected', user_id: w.user_id, amount: w.amount },
                    });
                    setActionLoading(null);
                    setWithdrawals(prev => prev.map(x => x.id === w.id ? { ...x, status: 'rejected' } : x));
                    toast.success('Withdrawal rejected');
                  }}
                    disabled={actionLoading === `wd-${w.id}`}
                    className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50">
                    {actionLoading === `wd-${w.id}` ? '⏳...' : <><X className="w-4 h-4" /> Decline</>}
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

        const handleResetPassword = async (playerId: string) => {
          if (!newPassword || newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
          }
          setActionLoading(`reset-${playerId}`);
          const { data, error } = await invokeWithRetry('admin-reset-password', {
            body: { target_user_id: playerId, new_password: newPassword },
          });
          setActionLoading(null);
          if (error) { toast.error(`Reset failed: ${error}`); return; }
          setResetPasswordPlayer(null);
          setNewPassword('');
          toast.success('✅ Password reset successfully!');
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
                {/* Reset Password */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => {
                      setResetPasswordPlayer(resetPasswordPlayer === p.id ? null : p.id);
                      setNewPassword('');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium"
                  >
                    <KeyRound className="w-3.5 h-3.5" /> Reset Password
                  </button>
                </div>
                {resetPasswordPlayer === p.id && (
                  <div className="flex gap-2 items-center pt-1">
                    <input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password (min 6)"
                      className="flex-1 px-3 py-2 rounded-lg bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      onClick={() => handleResetPassword(p.id)}
                      disabled={actionLoading === `reset-${p.id}` || newPassword.length < 6}
                      className="px-3 py-2 rounded-lg gradient-gold text-primary-foreground text-xs font-bold disabled:opacity-50"
                    >
                      {actionLoading === `reset-${p.id}` ? '⏳...' : 'Set'}
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
