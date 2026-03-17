import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import BingoCartela from '@/components/BingoCartela';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/auth';
import { useGamePresence } from '@/hooks/useGamePresence';
import { getBingoLetter } from '@/lib/bingoEngine';
import { checkWin, getPatternCells } from '@/lib/winDetection';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { playDrawSound, playWinSound, playMarkSound, announceNumber } from '@/lib/sounds';
import { invokeWithRetry } from '@/lib/edgeFn';
import { Gamepad2, LayoutGrid, ShoppingCart, User, Users, Wallet, Search, Shuffle, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MuteToggle from '@/components/MuteToggle';
import ThemeToggle from '@/components/ThemeToggle';

function PatternGrid({ pattern, size = 'sm' }: { pattern: string; size?: 'sm' | 'md' }) {
  const cells = getPatternCells(pattern);
  const s = size === 'md' ? 'w-10 h-10' : 'w-7 h-7';
  return (
    <div className={cn('grid grid-cols-5 gap-px overflow-hidden rounded-md border border-border', s)}>
      {cells.flat().map((on, i) => (
        <div key={i} className={cn('w-full h-full', on ? 'bg-primary' : 'bg-muted/40')} />
      ))}
    </div>
  );
}

type GameResult = {
  type: 'winner' | 'split' | 'disqualified';
  message: string;
  winnerCartela?: number[][];
};

// Bottom nav tab type
type Tab = 'play' | 'cards' | 'store' | 'profile';

function CartelaShop({ onBuy, cartelaPrice, gameStatus }: { onBuy: () => void; cartelaPrice: number; gameStatus: string }) {
  const [cartelas, setCartelas] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [buying, setBuying] = useState(false);
  const user = useUser();
  const pageSize = 30;
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from('cartelas').select('*').eq('is_used', false).order('id', { ascending: true })
      .then(({ data }) => setCartelas(data || []));
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) setPage(p => p + 1); },
      { threshold: 0.1 }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, []);

  const filtered = useMemo(() => {
    let list = cartelas;
    if (search.trim()) list = list.filter(c => String(c.id).includes(search.trim()));
    return list;
  }, [cartelas, search]);

  const visible = useMemo(() => filtered.slice(0, page * pageSize), [filtered, page]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const quickPick = (count: number) => {
    const available = filtered.filter(c => !selected.has(String(c.id)));
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const picks = shuffled.slice(0, count).map(c => String(c.id));
    setSelected(prev => { const next = new Set(prev); picks.forEach(id => next.add(id)); return next; });
    if (picks.length > 0) toast.success(`${picks.length} card(s) added`);
  };

  const handleBuy = async () => {
    if (!user?.id || selected.size === 0) return;
    setBuying(true);
    const { data, error } = await invokeWithRetry('purchase-cartela', {
      body: { cartela_ids: Array.from(selected).map(Number) },
    });
    if (error || data?.error) {
      toast.error(data?.error || 'Purchase failed');
      setBuying(false);
      return;
    }
    setCartelas(prev => prev.filter(c => !selected.has(String(c.id))));
    setSelected(new Set());
    setBuying(false);
    toast.success('Purchase successful!');
    onBuy();
  };

  const cost = selected.size * cartelaPrice;

  return (
    <div className="space-y-3 px-4 pb-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by ID..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground flex items-center gap-1"><Shuffle className="w-3.5 h-3.5" /> Quick:</span>
        {[1, 3, 5].map(n => (
          <button key={n} onClick={() => quickPick(n)}
            className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold active:scale-95">
            {n} Card{n > 1 ? 's' : ''}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} available · {cartelaPrice} ETB each</p>

      <div className="grid grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto">
        {visible.map(c => (
          <div key={c.id} onClick={() => toggleSelect(String(c.id))} className="cursor-pointer">
            <BingoCartela numbers={c.numbers as number[][]} size="xs" label={`#${c.id}`} selected={selected.has(String(c.id))} />
          </div>
        ))}
      </div>
      <div ref={loaderRef} className="h-4" />

      {selected.size > 0 && (
        <button onClick={handleBuy} disabled={buying}
          className="w-full py-3.5 rounded-xl font-bold bg-primary text-primary-foreground text-sm active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
          <ShoppingCart className="w-4 h-4" />
          {buying ? '...' : `Buy ${selected.size} — ${cost} ETB`}
        </button>
      )}
    </div>
  );
}

export default function GamePage() {
  const [playerCartelas, setPlayerCartelas] = useState<any[]>([]);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [gamePattern, setGamePattern] = useState<string>('Full House');
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [markedMap, setMarkedMap] = useState<Map<number, Set<string>>>(new Map());
  const [claimedCartelas, setClaimedCartelas] = useState<Set<number>>(new Set());
  const [gameStatus, setGameStatus] = useState<string>('waiting');
  const [sessionNumber, setSessionNumber] = useState(1);
  const [nextGameCountdown, setNextGameCountdown] = useState(0);
  const [buyingCountdown, setBuyingCountdown] = useState(0);
  const buyingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextGameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [displayName, setDisplayName] = useState<string>('');
  const [balance, setBalance] = useState(0);
  const [prizeAmount, setPrizeAmount] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>('play');
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const user = useUser();
  const navigate = useNavigate();
  const players = useGamePresence(user?.id, displayName);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('display_name, balance, phone').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setDisplayName((data as any).phone || (data as any).display_name || '');
          setBalance((data as any).balance || 0);
        }
      });
    const ch = supabase.channel('balance-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload: any) => setBalance(payload.new.balance || 0)
      ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const refreshGameData = useCallback(async () => {
    if (!user?.id) return;
    const [cartelasRes, numbersRes, gameRes, claimsRes, profileRes] = await Promise.all([
      supabase.from('cartelas').select('*').eq('owner_id', user.id).eq('is_used', true).order('id', { ascending: true }),
      supabase.from('game_numbers').select('number').eq('game_id', 'current').order('id', { ascending: true }),
      supabase.from('games').select('*').eq('id', 'current').maybeSingle(),
      supabase.from('bingo_claims').select('*').eq('game_id', 'current'),
      supabase.from('profiles').select('balance').eq('id', user.id).single(),
    ]);
    setPlayerCartelas(cartelasRes.data || []);
    setIsSpectator(!cartelasRes.data || cartelasRes.data.length === 0);
    if (numbersRes.data) setDrawnNumbers(numbersRes.data.map((n: any) => n.number));
    if (gameRes.data) {
      setGamePattern(gameRes.data.pattern || 'Full House');
      setGameStatus(gameRes.data.status || 'waiting');
      setPrizeAmount((gameRes.data as any).prize_amount || 0);
      setSessionNumber((gameRes.data as any).session_number || 1);
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
    if (profileRes.data) setBalance((profileRes.data as any).balance || 0);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    refreshGameData();
  }, [user?.id, refreshGameData]);

  const drawnSet = useMemo(() => new Set(drawnNumbers), [drawnNumbers]);

  // Realtime
  useEffect(() => {
    const channel = supabase.channel('game-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_numbers' },
        (payload: any) => {
          const num = payload.new.number;
          setDrawnNumbers(prev => [...prev, num]);
          playDrawSound();
          announceNumber(num);
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' },
        (payload: any) => {
          const game = payload.new;
          setGameStatus(game.status);
          setSessionNumber(game.session_number || 1);
          if (game.status === 'buying') {
            setDrawnNumbers([]); setShowResult(false); setGameResult(null);
            setMarkedMap(new Map()); setClaimedCartelas(new Set());
            setNextGameCountdown(0);
            if (nextGameTimerRef.current) clearInterval(nextGameTimerRef.current);
            if (user?.id) {
              supabase.from('cartelas').select('*').eq('owner_id', user.id).eq('is_used', true)
                .then(({ data }) => { setPlayerCartelas(data || []); setIsSpectator(!data || data.length === 0); });
            }
            setBuyingCountdown(120);
            if (buyingTimerRef.current) clearInterval(buyingTimerRef.current);
            buyingTimerRef.current = setInterval(() => {
              setBuyingCountdown(prev => {
                if (prev <= 1) { if (buyingTimerRef.current) clearInterval(buyingTimerRef.current); return 0; }
                return prev - 1;
              });
            }, 1000);
            toast('New game starting — buy your cards!');
          }
          if (game.status === 'active') {
            setBuyingCountdown(0);
            if (buyingTimerRef.current) clearInterval(buyingTimerRef.current);
            if (user?.id) {
              supabase.from('cartelas').select('*').eq('owner_id', user.id).eq('is_used', true)
                .then(({ data }) => { setPlayerCartelas(data || []); setIsSpectator(!data || data.length === 0); });
            }
            setActiveTab('play');
            toast('Game started!');
          }
          if (game.status === 'won') {
            const msg = game.winner_id === user?.id ? '🏆 You won!' : 'Winner announced!';
            setGameResult({ type: 'winner', message: msg });
            setShowResult(true);
            playWinSound();
            fetchWinnerCartela();
            setNextGameCountdown(60);
            if (nextGameTimerRef.current) clearInterval(nextGameTimerRef.current);
            nextGameTimerRef.current = setInterval(() => {
              setNextGameCountdown(prev => {
                if (prev <= 1) { if (nextGameTimerRef.current) clearInterval(nextGameTimerRef.current); return 0; }
                return prev - 1;
              });
            }, 1000);
          }
          if (game.pattern) setGamePattern(game.pattern);
          if (game.prize_amount !== undefined) setPrizeAmount(game.prize_amount);
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bingo_claims' },
        (payload: any) => {
          const claim = payload.new;
          if (claim.user_id !== user?.id) return;
          if (claim.is_valid === false) {
            toast.warning(`Invalid claim on #${claim.cartela_id}`);
            setClaimedCartelas(prev => { const next = new Set(prev); next.delete(claim.cartela_id); return next; });
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  async function fetchWinnerCartela() {
    const { data: claims } = await supabase.from('bingo_claims').select('cartela_id').eq('game_id', 'current').eq('is_valid', true).limit(1);
    if (claims && claims.length > 0) {
      const cid = (claims[0] as any).cartela_id;
      if (cid) {
        const { data: cartela } = await supabase.from('cartelas').select('numbers').eq('id', cid).single();
        if (cartela) setGameResult(prev => prev ? { ...prev, winnerCartela: cartela.numbers as number[][] } : prev);
      }
    }
  }

  const lastNumber = drawnNumbers[drawnNumbers.length - 1];

  const handleMarkCell = useCallback((cartelaId: number, row: number, col: number) => {
    playMarkSound();
    setMarkedMap(prev => {
      const next = new Map(prev);
      const cells = new Set(next.get(cartelaId) || []);
      const key = `${row}-${col}`;
      cells.has(key) ? cells.delete(key) : cells.add(key);
      next.set(cartelaId, cells);
      return next;
    });
  }, []);

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

  const handleClaimBingo = async (cartelaId: number, cartela: any) => {
    if (!user?.id || isSpectator || claimedCartelas.has(cartelaId)) return;
    const markedNums = getMarkedNumbersForCartela(cartela);
    const numbers = cartela.numbers as number[][];
    for (const num of markedNums) {
      if (!drawnSet.has(num)) { toast.error('Marked undrawn number!'); return; }
    }
    if (!checkWin(numbers, markedNums, gamePattern)) { toast.error('Pattern not complete!'); return; }
    setClaimedCartelas(prev => new Set(prev).add(cartelaId));
    const { error } = await supabase.from('bingo_claims').insert({ game_id: 'current', user_id: user.id, cartela_id: cartelaId } as any);
    if (error) {
      toast.error('Failed to claim');
      setClaimedCartelas(prev => { const next = new Set(prev); next.delete(cartelaId); return next; });
      return;
    }
    toast.success('Claim submitted!');
  };

  const isGameActive = gameStatus === 'active';
  const showBuyPrompt = gameStatus === 'buying' || gameStatus === 'waiting' || gameStatus === 'stopped' || gameStatus === 'won';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
    navigate('/login');
  };

  // Drawn numbers last 5 for live history
  const liveHistory = drawnNumbers.slice(-5).reverse();

  const currentCartela = playerCartelas[activeCardIdx];

  return (
    <div className="min-h-screen bg-background flex flex-col safe-top">
      {/* Winner overlay */}
      {showResult && gameResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm" onClick={() => setShowResult(false)}>
          <div className="text-center p-6 rounded-2xl bg-card border border-border max-w-xs mx-4 shadow-lg">
            <div className="text-5xl mb-3">{gameResult.type === 'winner' ? '🏆' : '🔄'}</div>
            <h2 className="text-xl font-bold text-foreground mb-1">BINGO!</h2>
            <p className="text-muted-foreground text-sm mb-3">{gameResult.message}</p>
            {gameResult.winnerCartela && (
              <div className="flex justify-center">
                <BingoCartela numbers={gameResult.winnerCartela} drawnNumbers={drawnSet} size="sm" label="Winner's Card" />
              </div>
            )}
            {nextGameCountdown > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                Next game in <span className="text-primary font-bold">{nextGameCountdown}</span>s
              </p>
            )}
          </div>
        </div>
      )}

      {/* Top header - like reference */}
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Gamepad2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground leading-tight">Bingo Mekele</h1>
            <p className="text-[10px] text-primary font-medium">Room #{sessionNumber} • {isGameActive ? 'Live' : gameStatus}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {prizeAmount > 0 && (
            <div className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20">
              <div className="text-[9px] text-muted-foreground uppercase">Prize</div>
              <div className="text-xs font-bold text-primary">{prizeAmount} ETB</div>
            </div>
          )}
          <div className="px-2.5 py-1 rounded-lg bg-muted">
            <div className="text-[9px] text-muted-foreground uppercase">Players</div>
            <div className="text-xs font-bold text-foreground">{players.length}</div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'play' && (
          <>
            {/* Pattern + Live History bar */}
            {isGameActive && (
              <div className="px-4 py-3 bg-card border-b border-border flex items-center gap-3">
                <div className="text-center">
                  <div className="text-[9px] uppercase text-muted-foreground mb-1">Pattern</div>
                  <PatternGrid pattern={gamePattern} size="md" />
                </div>
                <div className="flex-1">
                  <div className="text-[9px] uppercase text-muted-foreground mb-1">Live History</div>
                  <div className="flex items-center gap-2">
                    {liveHistory.map((num, i) => (
                      <div key={num} className={cn(
                        'flex items-center justify-center rounded-full font-bold',
                        i === 0 ? 'w-10 h-10 bg-primary text-primary-foreground text-sm' : 'w-7 h-7 text-xs text-muted-foreground bg-muted'
                      )}>
                        {i === 0 ? `${getBingoLetter(num)}${num}` : `${getBingoLetter(num)}${num}`}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Buying / Waiting state */}
            {showBuyPrompt && !isGameActive && (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground mb-3">
                  {gameStatus === 'buying'
                    ? `Buy your cards! ${buyingCountdown > 0 ? `(${buyingCountdown}s)` : ''}`
                    : gameStatus === 'won' ? (nextGameCountdown > 0 ? `Next game in ${nextGameCountdown}s` : 'Round over')
                    : 'Waiting for game...'}
                </p>
                <button onClick={() => setActiveTab('store')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold active:scale-95">
                  <ShoppingCart className="w-4 h-4" /> Buy Cards
                </button>
              </div>
            )}

            {/* Card tabs + cartela during active game */}
            {isGameActive && playerCartelas.length > 0 && (
              <div className="px-4 py-3">
                {/* Card tabs */}
                {playerCartelas.length > 1 && (
                  <div className="flex gap-1 mb-3 bg-muted rounded-xl p-1">
                    {playerCartelas.map((c, i) => (
                      <button key={c.id} onClick={() => setActiveCardIdx(i)}
                        className={cn('flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
                          activeCardIdx === i ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
                        Card #{i + 1}
                      </button>
                    ))}
                  </div>
                )}

                {/* Current cartela */}
                {currentCartela && (
                  <BingoCartela
                    numbers={currentCartela.numbers as number[][]}
                    drawnNumbers={drawnSet}
                    markedCells={markedMap.get(currentCartela.id) || new Set<string>()}
                    onMarkCell={isSpectator ? undefined : (row, col) => handleMarkCell(currentCartela.id, row, col)}
                    size="lg"
                    label={`Card #${activeCardIdx + 1}`}
                  />
                )}

                {/* Proximity hint */}
                {currentCartela && (() => {
                  const patternCells = getPatternCells(gamePattern);
                  const nums = currentCartela.numbers as number[][];
                  let needed = 0;
                  for (let r = 0; r < 5; r++)
                    for (let c = 0; c < 5; c++)
                      if (patternCells[r][c] && !(r === 2 && c === 2) && !drawnSet.has(nums[r][c]))
                        needed++;
                  if (needed > 0 && needed <= 3) {
                    return (
                      <div className="mt-3 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-2">
                        <span className="text-primary text-sm">ℹ️</span>
                        <span className="text-sm text-foreground">
                          You are only <span className="font-bold text-primary">{needed}</span> number{needed > 1 ? 's' : ''} away from a {gamePattern} pattern!
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* BINGO button */}
                {!isSpectator && currentCartela && (
                  <button
                    onClick={() => handleClaimBingo(currentCartela.id, currentCartela)}
                    disabled={claimedCartelas.has(currentCartela.id)}
                    className={cn(
                      'w-full mt-4 py-4 rounded-2xl font-bold text-xl active:scale-95 transition-all',
                      claimedCartelas.has(currentCartela.id)
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-primary text-primary-foreground shadow-lg'
                    )}>
                    {claimedCartelas.has(currentCartela.id) ? 'Verifying...' : 'BINGO!'}
                  </button>
                )}
              </div>
            )}

            {/* Spectator message */}
            {isGameActive && playerCartelas.length === 0 && (
              <div className="px-4 py-10 text-center text-muted-foreground">
                <p className="text-sm">You don't have any cards for this game.</p>
                <p className="text-xs mt-1">Buy cards in the Store tab for the next round.</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'cards' && (
          <div className="px-4 py-4 space-y-3">
            <h2 className="text-lg font-bold text-foreground">My Cards</h2>
            {playerCartelas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No cards purchased yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {playerCartelas.map((c, i) => (
                  <BingoCartela key={c.id} numbers={c.numbers as number[][]} drawnNumbers={drawnSet}
                    markedCells={markedMap.get(c.id) || new Set<string>()} size="sm" label={`Card #${i + 1}`} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'store' && (
          <div className="py-4">
            <h2 className="text-lg font-bold text-foreground px-4 mb-3">Card Shop</h2>
            <CartelaShop onBuy={refreshGameData} cartelaPrice={10} gameStatus={gameStatus} />
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="px-4 py-4 space-y-4">
            <div className="text-center p-6 rounded-2xl bg-card border border-border">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <User className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">{displayName || 'Player'}</h2>
              <p className="text-2xl font-bold text-primary mt-2">{balance} ETB</p>
              <p className="text-xs text-muted-foreground">Wallet Balance</p>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
              <span className="text-sm text-foreground">Theme</span>
              <ThemeToggle />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
              <span className="text-sm text-foreground">Sound</span>
              <MuteToggle />
            </div>
            <button onClick={() => navigate('/payment')}
              className="w-full py-3.5 rounded-xl font-bold bg-primary text-primary-foreground text-sm active:scale-95 flex items-center justify-center gap-2">
              <Wallet className="w-4 h-4" /> Wallet / Deposit
            </button>
            <button onClick={handleLogout}
              className="w-full py-3.5 rounded-xl font-bold bg-destructive text-destructive-foreground text-sm active:scale-95">
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Bottom nav - matching reference */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-bottom z-40">
        <div className="flex">
          {([
            { key: 'play' as Tab, label: 'Play', icon: Gamepad2 },
            { key: 'cards' as Tab, label: 'Cards', icon: LayoutGrid },
            { key: 'store' as Tab, label: 'Store', icon: ShoppingCart },
            { key: 'profile' as Tab, label: 'Profile', icon: User },
          ]).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={cn('flex-1 flex flex-col items-center py-2.5 text-[10px] font-medium transition-colors',
                activeTab === key ? 'text-primary' : 'text-muted-foreground')}>
              <Icon className={cn('w-5 h-5 mb-0.5', activeTab === key && 'text-primary')} />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
