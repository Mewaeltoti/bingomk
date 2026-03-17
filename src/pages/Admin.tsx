import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CreditCard, Gamepad2, Check, X, AlertTriangle, Plus, Minus, Pause, Play, Square, ArrowUpCircle, LogOut, KeyRound, Settings, ArrowLeft, Search, Bell } from 'lucide-react';
import { PATTERNS } from '@/lib/bingo';
import { getBingoLetter } from '@/lib/bingoEngine';
import { getPatternCells } from '@/lib/winDetection';
import { supabase } from '@/integrations/supabase/client';
import { invokeWithRetry } from '@/lib/edgeFn';
import { useGamePresence } from '@/hooks/useGamePresence';
import { useUser } from '@/lib/auth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function PatternGrid({ pattern, active }: { pattern: string; active: boolean }) {
  const cells = getPatternCells(pattern);
  return (
    <div className={cn('grid grid-cols-5 gap-px w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors',
      active ? 'border-primary bg-primary/10' : 'border-border bg-muted/30')}>
      {cells.flat().map((on, i) => (
        <div key={i} className={cn('w-full h-full', on ? (active ? 'bg-primary' : 'bg-muted-foreground/40') : 'bg-transparent')} />
      ))}
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState<'controls' | 'withdrawals' | 'players' | 'settings'>('controls');
  const [pattern, setPattern] = useState<string>('Full House');
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [gameStatus, setGameStatus] = useState('waiting');
  const [autoDraw, setAutoDraw] = useState(false);
  const [drawSpeed, setDrawSpeed] = useState(10);
  const [prizeAmount, setPrizeAmount] = useState(0);
  const [cartelaPrice, setCartelaPrice] = useState(10);
  const [sessionNumber, setSessionNumber] = useState(1);
  const [boughtCount, setBoughtCount] = useState(0);
  const [buyingCountdown, setBuyingCountdown] = useState(0);
  const buyingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const drawingStartedRef = useRef(false);

  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [playerSearch, setPlayerSearch] = useState('');
  const [adjustingPlayer, setAdjustingPlayer] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [resetPasswordPlayer, setResetPasswordPlayer] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [wdTab, setWdTab] = useState<'pending' | 'approved' | 'declined'>('pending');

  const user = useUser();
  const navigate = useNavigate();
  const onlinePlayers = useGamePresence(user?.id, 'Admin');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const enrichWithProfiles = async (records: any[], userIdField = 'user_id') => {
    if (!records.length) return records;
    const userIds = [...new Set(records.map(r => r[userIdField]))];
    const { data: profiles } = await supabase.from('profiles').select('id, phone, display_name').in('id', userIds);
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    return records.map(r => ({ ...r, profile: profileMap.get(r[userIdField]) || null }));
  };

  // Fetch game state
  useEffect(() => {
    async function fetchState() {
      const [numbersRes, gameRes, claimsRes] = await Promise.all([
        supabase.from('game_numbers').select('number').eq('game_id', 'current').order('id', { ascending: true }),
        supabase.from('games').select('*').eq('id', 'current').maybeSingle(),
        supabase.from('bingo_claims').select('*').eq('game_id', 'current'),
      ]);
      if (numbersRes.data) setDrawnNumbers(numbersRes.data.map((n: any) => n.number));
      if (gameRes.data) {
        setPattern(gameRes.data.pattern as string);
        setGameStatus(gameRes.data.status || 'waiting');
        setDrawSpeed((gameRes.data as any).draw_speed || 10);
        setPrizeAmount((gameRes.data as any).prize_amount || 0);
        setSessionNumber((gameRes.data as any).session_number || 1);
      }
      setClaims(await enrichWithProfiles(claimsRes.data || []));
    }
    fetchState();
  }, []);

  // Realtime
  useEffect(() => {
    const channel = supabase.channel('admin-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: 'id=eq.current' },
        (payload: any) => {
          const g = payload.new;
          setAutoDraw(g.auto_draw || false);
          setGameStatus(g.status);
          setSessionNumber(g.session_number || 1);
          if (g.draw_speed) setDrawSpeed(g.draw_speed);
          if (g.prize_amount !== undefined) setPrizeAmount(g.prize_amount);
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_numbers' },
        (payload: any) => setDrawnNumbers(prev => [...prev, payload.new.number]))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bingo_claims' },
        async () => {
          setAutoDraw(false);
          toast('⏸️ Claim received — draw paused');
          const { data } = await supabase.from('bingo_claims').select('*').eq('game_id', 'current');
          setClaims(await enrichWithProfiles(data || []));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Fetch tab data
  useEffect(() => {
    if (tab === 'withdrawals') {
      Promise.all([
        (supabase.from('withdrawals' as any) as any).select('*').order('created_at', { ascending: false }),
        supabase.from('deposits').select('*').order('created_at', { ascending: false }),
      ]).then(async ([wdRes, depRes]: any) => {
        setWithdrawals(await enrichWithProfiles(wdRes.data || []));
        setDeposits(await enrichWithProfiles(depRes.data || []));
      });
    }
    if (tab === 'players') {
      supabase.from('profiles').select('*').order('created_at', { ascending: false })
        .then(({ data }) => setPlayers(data || []));
    }
  }, [tab]);

  const verifyAllPendingClaims = async () => {
    setActionLoading('verify-all');
    const { data, error } = await invokeWithRetry('verify-claim', { body: { action: 'verify_all' } });
    setActionLoading(null);
    if (error) { toast.error(error); return; }
    if (data?.result === 'won') { setGameStatus('won'); toast.success(`🏆 Winner! ${data.prize_per_winner} ETB`); }
    else if (data?.result === 'no_winners_resume') { toast.warning('No valid claims — resuming'); setAutoDraw(true); }
    const { data: r } = await supabase.from('bingo_claims').select('*').eq('game_id', 'current');
    setClaims(await enrichWithProfiles(r || []));
  };

  const startNewGame = async () => {
    setActionLoading('new-game');
    const { error } = await invokeWithRetry('game-lifecycle', {
      body: { action: 'new_game', pattern, draw_speed: drawSpeed, cartela_price: cartelaPrice },
    });
    if (error) { toast.error(error); setActionLoading(null); return; }
    setActionLoading(null); setBoughtCount(0); setDrawnNumbers([]); setClaims([]);
    setGameStatus('buying'); setBuyingCountdown(120); drawingStartedRef.current = false;
    toast.success('🛒 Buying period started!');
    buyingTimerRef.current = setInterval(() => {
      setBuyingCountdown(prev => {
        if (prev <= 1) {
          if (buyingTimerRef.current) clearInterval(buyingTimerRef.current);
          if (!drawingStartedRef.current) { drawingStartedRef.current = true; startDrawing(); }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startDrawing = async () => {
    const { data, error } = await invokeWithRetry('game-lifecycle', { body: { action: 'start_drawing', prize_amount: prizeAmount } });
    if (error) { toast.error(error); return; }
    setBoughtCount(data?.bought || 0);
    setGameStatus('active'); setAutoDraw(true);
    toast.success(`🎲 Game started!`);
  };

  const pauseGame = async () => { await invokeWithRetry('game-lifecycle', { body: { action: 'pause' } }); setAutoDraw(false); };
  const resumeGame = async () => { await invokeWithRetry('game-lifecycle', { body: { action: 'resume' } }); setAutoDraw(true); };

  const handleDeposit = async (id: string, action: 'approved' | 'rejected', userId: string, amount: number) => {
    setActionLoading(`dep-${id}`);
    await invokeWithRetry('approve-transaction', { body: { type: 'deposit', id, action, user_id: userId, amount } });
    setActionLoading(null);
    toast.success(action === 'approved' ? `✅ Approved ${amount} ETB` : 'Rejected');
    setDeposits(prev => prev.map(d => d.id === id ? { ...d, status: action } : d));
  };

  const handleWithdrawal = async (id: string, action: 'approved' | 'rejected', userId: string, amount: number) => {
    setActionLoading(`wd-${id}`);
    await invokeWithRetry('approve-transaction', { body: { type: 'withdrawal', id, action, user_id: userId, amount } });
    setActionLoading(null);
    toast.success(action === 'approved' ? `✅ Paid ${amount} ETB` : 'Declined');
    setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: action } : w));
  };

  const filteredPlayers = players.filter(p => {
    if (!playerSearch.trim()) return true;
    const s = playerSearch.toLowerCase();
    return (p.display_name || '').toLowerCase().includes(s) || (p.phone || '').includes(s);
  });

  const pendingWd = withdrawals.filter(w => w.status === 'pending');
  const pendingTotal = pendingWd.reduce((s: number, w: any) => s + (w.amount || 0), 0);
  const todayPaid = withdrawals.filter(w => w.status === 'approved').reduce((s: number, w: any) => s + (w.amount || 0), 0);

  const tabs = [
    { key: 'controls' as const, label: 'Controls', icon: Gamepad2 },
    { key: 'withdrawals' as const, label: 'Withdrawals', icon: CreditCard },
    { key: 'players' as const, label: 'Players', icon: Users },
    { key: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background safe-top pb-20">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Bingo Mekele Admin</h1>
        </div>
        <Settings className="w-5 h-5 text-muted-foreground" />
      </header>

      {/* Main content */}
      <div className="px-4 py-4">
        {tab === 'controls' && (
          <div className="space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-card border border-border">
                <div className="text-[10px] uppercase text-muted-foreground">Players</div>
                <div className="text-xl font-bold text-primary">{onlinePlayers.length}</div>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border">
                <div className="text-[10px] uppercase text-muted-foreground">Pot Size</div>
                <div className="text-sm font-bold text-primary">ETB</div>
                <div className="text-lg font-bold text-primary">{prizeAmount > 1000 ? `${(prizeAmount / 1000).toFixed(1)}k` : prizeAmount}</div>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border">
                <div className="text-[10px] uppercase text-muted-foreground">Round</div>
                <div className="text-xl font-bold text-primary">{drawnNumbers.length}/75</div>
              </div>
            </div>

            {/* Game controls */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={startNewGame} disabled={autoDraw || gameStatus === 'buying' || actionLoading === 'new-game'}
                className="py-4 rounded-xl font-bold bg-primary text-primary-foreground text-sm active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                <Play className="w-4 h-4" /> New Game
              </button>
              <button onClick={autoDraw ? pauseGame : resumeGame} disabled={gameStatus !== 'active'}
                className="py-4 rounded-xl font-bold bg-muted text-foreground text-sm active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                {autoDraw ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Resume</>}
              </button>
            </div>

            {/* Draw Speed */}
            <div className="p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-foreground">Draw Speed</span>
                <span className="text-xs font-bold text-primary px-2 py-1 rounded-lg bg-primary/10">{drawSpeed}s / ball</span>
              </div>
              <input type="range" min={1} max={10} value={drawSpeed} onChange={e => setDrawSpeed(Number(e.target.value))}
                disabled={autoDraw} className="w-full accent-primary" />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>FAST (1S)</span><span>RELAXED (10S)</span>
              </div>
            </div>

            {/* Winning Pattern */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-foreground">Winning Pattern</span>
                <span className="text-xs text-primary font-medium">{pattern}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {Object.keys(PATTERNS).slice(0, 8).map(p => (
                  <button key={p} onClick={() => setPattern(p)} disabled={autoDraw}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl transition-colors disabled:opacity-50">
                    <PatternGrid pattern={p} active={pattern === p} />
                    <span className={cn('text-[9px] font-medium uppercase', pattern === p ? 'text-primary' : 'text-muted-foreground')}>
                      {p.replace('Single Line ', '').replace(' Shape', '')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Buying countdown */}
            {gameStatus === 'buying' && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-center space-y-2">
                <p className="text-sm font-bold text-foreground">🛒 Buying Period</p>
                {buyingCountdown > 0 && <div className="text-2xl font-bold text-primary">{Math.floor(buyingCountdown / 60)}:{String(buyingCountdown % 60).padStart(2, '0')}</div>}
                <button onClick={() => { if (buyingTimerRef.current) clearInterval(buyingTimerRef.current); setBuyingCountdown(0); if (!drawingStartedRef.current) { drawingStartedRef.current = true; startDrawing(); } }}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold">
                  {buyingCountdown > 0 ? 'Skip & Start Now' : '▶️ Start Drawing'}
                </button>
              </div>
            )}

            {/* Claims */}
            {claims.length > 0 && (
              <div className="p-3 rounded-xl border border-border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-accent" /> Claims ({claims.length})</span>
                  {claims.some((c: any) => c.is_valid === null) && (
                    <button onClick={verifyAllPendingClaims} disabled={actionLoading === 'verify-all'}
                      className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50">
                      Verify All
                    </button>
                  )}
                </div>
                {claims.map((c: any) => (
                  <div key={c.id} className="p-2 rounded-lg bg-muted/30 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{c.profile?.phone || c.user_id.slice(0, 8)}</span>
                      <span className="text-xs text-muted-foreground ml-2">#{c.cartela_id}</span>
                    </div>
                    <span className={cn('text-xs font-bold', c.is_valid ? 'text-primary' : c.is_valid === false ? 'text-destructive' : 'text-accent')}>
                      {c.is_valid ? '✅' : c.is_valid === false ? '❌' : '⏳'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Live Ball Log */}
            {drawnNumbers.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-foreground mb-2">Live Ball Log</h3>
                <div className="flex flex-wrap gap-1.5">
                  {drawnNumbers.slice(-10).map((n, i) => {
                    const isLatest = i === drawnNumbers.slice(-10).length - 1;
                    return (
                      <div key={n} className={cn('w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold',
                        isLatest ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                        {getBingoLetter(n)}{n}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'withdrawals' && (
          <div className="space-y-4">
            {/* Header with search */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                <span className="text-lg font-bold">Withdrawals</span>
              </div>
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-muted-foreground" />
                <Bell className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-card border border-border">
                <div className="text-[10px] uppercase text-muted-foreground">Pending Total</div>
                <div className="text-lg font-bold text-primary">ETB {pendingTotal.toLocaleString()}</div>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border">
                <div className="text-[10px] uppercase text-muted-foreground">Today Paid</div>
                <div className="text-lg font-bold text-foreground">ETB {todayPaid.toLocaleString()}</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-border">
              {(['pending', 'approved', 'declined'] as const).map(t => (
                <button key={t} onClick={() => setWdTab(t)}
                  className={cn('pb-2 text-sm font-medium capitalize transition-colors border-b-2',
                    wdTab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>
                  {t}{t === 'pending' ? ` (${pendingWd.length})` : ''}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="space-y-3">
              {withdrawals.filter(w => w.status === (wdTab === 'declined' ? 'rejected' : wdTab)).map((w: any) => (
                <div key={w.id} className="p-4 rounded-xl bg-card border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-foreground">
                        {(w.profile?.display_name || w.profile?.phone || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{w.profile?.display_name || w.profile?.phone || 'Unknown'}</div>
                        <div className="text-[10px] text-muted-foreground">Requested {new Date(w.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full uppercase',
                      w.status === 'pending' ? 'bg-accent/15 text-accent' : w.status === 'approved' ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive')}>
                      {w.status}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-muted-foreground">Amount</div>
                      <div className="text-lg font-bold text-foreground">ETB {w.amount?.toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground">Method</div>
                      <div className="text-sm font-medium text-foreground">{w.bank}</div>
                    </div>
                  </div>
                  {w.status === 'pending' && (
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handleWithdrawal(w.id, 'approved', w.user_id, w.amount)}
                        disabled={!!actionLoading}
                        className="py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1">
                        <Check className="w-4 h-4" /> Approve
                      </button>
                      <button onClick={() => handleWithdrawal(w.id, 'rejected', w.user_id, w.amount)}
                        disabled={!!actionLoading}
                        className="py-2.5 rounded-xl bg-muted text-foreground text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1">
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Deposits section */}
            <h3 className="text-sm font-bold text-foreground mt-6">Deposits</h3>
            <div className="space-y-2">
              {deposits.map((d: any) => (
                <div key={d.id} className="p-3 rounded-xl bg-card border border-border flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{d.profile?.phone || 'Unknown'} — {d.amount} ETB</div>
                    <div className="text-xs text-muted-foreground">Ref: {d.reference}</div>
                  </div>
                  {d.status === 'pending' ? (
                    <div className="flex gap-1">
                      <button onClick={() => handleDeposit(d.id, 'approved', d.user_id, d.amount)}
                        className="p-1.5 rounded-lg bg-primary text-primary-foreground"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDeposit(d.id, 'rejected', d.user_id, d.amount)}
                        className="p-1.5 rounded-lg bg-destructive text-destructive-foreground"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <span className={cn('text-xs font-bold', d.status === 'approved' ? 'text-primary' : 'text-destructive')}>{d.status}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'players' && (
          <div className="space-y-4">
            <input type="text" value={playerSearch} onChange={e => setPlayerSearch(e.target.value)}
              placeholder="Search by name or ID..."
              className="w-full p-3 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary border border-border" />
            <div className="space-y-2">
              {filteredPlayers.map(p => (
                <div key={p.id} className="p-3 rounded-xl bg-card border border-border space-y-2">
                  <div className="flex items-center justify-between" onClick={() => setAdjustingPlayer(adjustingPlayer === p.id ? null : p.id)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {(p.display_name || p.phone || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{p.display_name || p.phone || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{p.phone}</div>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-primary">{p.balance || 0} ETB</div>
                  </div>
                  {adjustingPlayer === p.id && (
                    <div className="space-y-2 pt-1">
                      <div className="flex gap-2 items-center">
                        <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)}
                          placeholder="Amount" className="flex-1 px-3 py-2 rounded-lg bg-muted text-foreground text-sm outline-none" />
                        <button onClick={async () => {
                          const newBal = Math.max(0, (p.balance || 0) + Math.abs(Number(adjustAmount)));
                          await supabase.from('profiles').update({ balance: newBal }).eq('id', p.id);
                          setPlayers(prev => prev.map(x => x.id === p.id ? { ...x, balance: newBal } : x));
                          setAdjustingPlayer(null); setAdjustAmount(''); toast.success(`Balance → ${newBal}`);
                        }} className="p-2 rounded-lg bg-primary text-primary-foreground"><Plus className="w-4 h-4" /></button>
                        <button onClick={async () => {
                          const newBal = Math.max(0, (p.balance || 0) - Math.abs(Number(adjustAmount)));
                          await supabase.from('profiles').update({ balance: newBal }).eq('id', p.id);
                          setPlayers(prev => prev.map(x => x.id === p.id ? { ...x, balance: newBal } : x));
                          setAdjustingPlayer(null); setAdjustAmount(''); toast.success(`Balance → ${newBal}`);
                        }} className="p-2 rounded-lg bg-destructive text-destructive-foreground"><Minus className="w-4 h-4" /></button>
                      </div>
                      <button onClick={() => { setResetPasswordPlayer(resetPasswordPlayer === p.id ? null : p.id); setNewPassword(''); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium">
                        <KeyRound className="w-3.5 h-3.5" /> Reset Password
                      </button>
                      {resetPasswordPlayer === p.id && (
                        <div className="flex gap-2 items-center">
                          <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                            placeholder="New password (min 6)" className="flex-1 px-3 py-2 rounded-lg bg-muted text-foreground text-sm outline-none" />
                          <button onClick={async () => {
                            if (newPassword.length < 6) { toast.error('Min 6 chars'); return; }
                            setActionLoading(`reset-${p.id}`);
                            await invokeWithRetry('admin-reset-password', { body: { target_user_id: p.id, new_password: newPassword } });
                            setActionLoading(null); setResetPasswordPlayer(null); setNewPassword('');
                            toast.success('Password reset!');
                          }} disabled={newPassword.length < 6}
                            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50">Set</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-card border border-border space-y-3">
              <h3 className="text-sm font-bold">Game Settings</h3>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cartela Price (ETB)</label>
                <input type="number" min={1} value={cartelaPrice} onChange={e => setCartelaPrice(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2.5 rounded-lg bg-muted text-foreground text-sm outline-none border border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Prize Pot (ETB)</label>
                <input type="number" min={0} value={prizeAmount} onChange={e => setPrizeAmount(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 rounded-lg bg-muted text-foreground text-sm outline-none border border-border" />
                <div className="flex gap-1.5 mt-1.5">
                  {[50, 100, 200, 500].map(a => (
                    <button key={a} onClick={() => setPrizeAmount(a)}
                      className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold', prizeAmount === a ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={handleLogout}
              className="w-full py-3.5 rounded-xl font-bold bg-destructive text-destructive-foreground text-sm active:scale-95 flex items-center justify-center gap-2">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-bottom z-40">
        <div className="flex">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={cn('flex-1 flex flex-col items-center py-2.5 text-[10px] font-medium transition-colors',
                tab === key ? 'text-primary' : 'text-muted-foreground')}>
              <Icon className="w-5 h-5 mb-0.5" />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
