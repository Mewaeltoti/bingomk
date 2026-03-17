import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import BingoCartela from '@/components/BingoCartela';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/auth';
import { useGamePresence } from '@/hooks/useGamePresence';
import { getBingoLetter } from '@/lib/bingoEngine';
import { checkWin, getPatternCells } from '@/lib/winDetection';
import { PATTERNS } from '@/lib/bingo';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { playDrawSound, playWinSound, playMarkSound, announceNumber } from '@/lib/sounds';
import { invokeWithRetry } from '@/lib/edgeFn';
import { t, getLang, toggleLang } from '@/lib/i18n';
import { Users, Eye, Hand, ShoppingCart, ChevronDown, ChevronUp, Wallet, LogOut, Search, Shuffle, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MuteToggle from '@/components/MuteToggle';
import ThemeToggle from '@/components/ThemeToggle';

function PatternGrid({ pattern }: { pattern: string }) {
  const cells = getPatternCells(pattern);
  return (
    <div className="grid grid-cols-5 gap-px w-8 h-8 overflow-hidden border border-primary/30 rounded-sm">
      {cells.flat().map((on, i) => (
        <div key={i} className={cn('w-full h-full', on ? 'bg-primary' : 'bg-muted/30')} />
      ))}
    </div>
  );
}

type GameResult = {
  type: 'winner' | 'split' | 'disqualified';
  message: string;
  winnerCartela?: number[][];
};

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
    if (picks.length > 0) toast.success(`${picks.length} cartela(s) added!`);
  };

  const handleBuy = async () => {
    if (!user?.id || selected.size === 0) return;
    setBuying(true);
    const { data, error } = await invokeWithRetry('purchase-cartela', {
      body: { cartela_ids: Array.from(selected).map(Number) },
    });
    if (error || data?.error) {
      toast.error(data?.error || t('purchaseFailed'));
      setBuying(false);
      return;
    }
    setCartelas(prev => prev.filter(c => !selected.has(String(c.id))));
    setSelected(new Set());
    setBuying(false);
    toast.success(t('purchased'));
    onBuy();
  };

  const cost = selected.size * cartelaPrice;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('search')}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground flex items-center gap-1"><Shuffle className="w-3.5 h-3.5" /> {t('quick')}:</span>
        {[1, 3, 5].map(n => (
          <button key={n} onClick={() => quickPick(n)}
            className="px-3 py-1.5 rounded bg-primary/10 text-primary text-xs font-bold active:scale-95">
            {n} {t('cards')}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} {t('available')} · {cartelaPrice} ETB {t('each')}</p>

      <div className="grid grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto">
        {visible.map(c => (
          <div key={c.id} onClick={() => toggleSelect(String(c.id))} className="cursor-pointer">
            <BingoCartela
              numbers={c.numbers as number[][]}
              size="xs"
              label={`#${c.id}`}
              selected={selected.has(String(c.id))}
            />
          </div>
        ))}
      </div>
      <div ref={loaderRef} className="h-4" />

      {selected.size > 0 && (
        <button onClick={handleBuy} disabled={buying}
          className="w-full py-3.5 rounded-lg font-display font-bold gradient-neon text-primary-foreground text-sm active:scale-95 glow-neon disabled:opacity-50">
          <ShoppingCart className="w-4 h-4 inline mr-2" />
          {buying ? '...' : `${t('buy')} ${selected.size} — ${cost} ETB`}
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
  const [boardOpen, setBoardOpen] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [displayName, setDisplayName] = useState<string>('');
  const [balance, setBalance] = useState(0);
  const [prizeAmount, setPrizeAmount] = useState(0);
  const [lastWinNumber, setLastWinNumber] = useState<number | null>(null);
  const [, setLangTick] = useState(0); // force re-render on lang change
  const user = useUser();
  const navigate = useNavigate();
  const players = useGamePresence(user?.id, displayName);

  const handleToggleLang = () => {
    toggleLang();
    setLangTick(n => n + 1);
  };

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('display_name, balance, phone').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setDisplayName((data as any).phone || (data as any).display_name || '');
          setBalance((data as any).balance || 0);
        }
      });
    const ch = supabase
      .channel('balance-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload: any) => setBalance(payload.new.balance || 0)
      ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  useEffect(() => {
    supabase.from('game_history').select('drawn_numbers').order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const nums = data[0].drawn_numbers as number[];
          if (Array.isArray(nums) && nums.length > 0) {
            setLastWinNumber(nums[nums.length - 1]);
          }
        }
      });
  }, []);

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
      if (gameRes.data.status === 'won') {
        setGameResult({ type: 'winner', message: t('winnerAnnounced') });
        setShowResult(true);
        if (gameRes.data.winner_id === user?.id) {
          setGameResult({ type: 'winner', message: t('youWon') });
        }
      }
    }
    if (claimsRes.data) {
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
    supabase.from('cartelas').select('*').eq('owner_id', user.id).eq('is_used', true).order('id', { ascending: true })
      .then(({ data }) => { setPlayerCartelas(data || []); setIsSpectator(!data || data.length === 0); });
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
        setGameStatus(gameRes.data.status || 'waiting');
        setPrizeAmount((gameRes.data as any).prize_amount || 0);
        setSessionNumber((gameRes.data as any).session_number || 1);
        if (gameRes.data.status === 'won') {
          setGameResult({ type: 'winner', message: t('winnerAnnounced') });
          setShowResult(true);
          if (gameRes.data.winner_id === user?.id) setGameResult({ type: 'winner', message: t('youWon') });
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

  useEffect(() => {
    const channel = supabase
      .channel('game-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_numbers' },
        (payload: any) => {
          const num = payload.new.number;
          setDrawnNumbers(prev => [...prev, num]);
          playDrawSound();
          announceNumber(num);
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' },
        (payload: any) => {
          const game = payload.new;
          setGameStatus(game.status);
          setSessionNumber(game.session_number || 1);
          if (game.status === 'buying') {
            setDrawnNumbers([]);
            setShowResult(false);
            setGameResult(null);
            setMarkedMap(new Map());
            setClaimedCartelas(new Set());
            setShowShop(true);
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
            toast(t('newGameStarting'));
          }
          if (game.status === 'active') {
            setBuyingCountdown(0);
            setShowShop(false);
            if (buyingTimerRef.current) clearInterval(buyingTimerRef.current);
            if (user?.id) {
              supabase.from('cartelas').select('*').eq('owner_id', user.id).eq('is_used', true)
                .then(({ data }) => { setPlayerCartelas(data || []); setIsSpectator(!data || data.length === 0); });
            }
            toast(t('gameStarted'));
          }
          if (game.status === 'waiting') {
            setDrawnNumbers([]); setShowResult(false); setGameResult(null); setMarkedMap(new Map()); setClaimedCartelas(new Set());
          }
          if (game.status === 'won') {
            setGameResult({ type: 'winner', message: t('winnerAnnounced') });
            setShowResult(true);
            playWinSound();
            if (game.winner_id === user?.id) setGameResult({ type: 'winner', message: t('youWon') });
            fetchWinnerCartela();
            // Auto-countdown to next game (60 seconds)
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
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bingo_claims' },
        (payload: any) => {
          const claim = payload.new;
          if (claim.user_id !== user?.id) return;
          const cid = claim.cartela_id;
          if (claim.is_valid === false) {
            toast.warning(`${t('claimInvalid')} #${cid}`);
            setClaimedCartelas(prev => { const next = new Set(prev); next.delete(cid); return next; });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  async function fetchWinnerCartela() {
    const { data: claims } = await supabase.from('bingo_claims').select('cartela_id').eq('game_id', 'current').eq('is_valid', true).limit(1);
    if (claims && claims.length > 0) {
      const cid = (claims[0] as any).cartela_id;
      if (cid) {
        const { data: cartela } = await supabase.from('cartelas').select('numbers').eq('id', cid).single();
        if (cartela) {
          setGameResult(prev => prev ? { ...prev, winnerCartela: cartela.numbers as number[][] } : prev);
        }
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
      if (!drawnSet.has(num)) { toast.error(t('markedUndrawn')); return; }
    }
    if (!checkWin(numbers, markedNums, gamePattern)) { toast.error(t('patternNoMatch')); return; }
    setClaimedCartelas(prev => new Set(prev).add(cartelaId));
    const { error } = await supabase.from('bingo_claims').insert({ game_id: 'current', user_id: user.id, cartela_id: cartelaId } as any);
    if (error) {
      toast.error('Failed to claim');
      setClaimedCartelas(prev => { const next = new Set(prev); next.delete(cartelaId); return next; });
      return;
    }
    toast.success(t('claimSuccess'));
  };

  const isGameActive = gameStatus === 'active';
  const showBuyPrompt = gameStatus === 'buying' || gameStatus === 'waiting' || gameStatus === 'stopped' || gameStatus === 'won';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <PullToRefresh onRefresh={refreshGameData}>

      {/* Winner overlay */}
      {showResult && gameResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm animate-in fade-in" onClick={() => setShowResult(false)}>
          <div className="text-center p-6 rounded-xl bg-card border-2 border-primary max-w-xs mx-4 glow-neon">
            <div className="text-5xl mb-3">{gameResult.type === 'winner' ? '🏆' : '🔄'}</div>
            <h2 className="text-xl font-display font-bold text-primary mb-1">
              {gameResult.type === 'disqualified' ? 'RESTART' : t('bingo') + '!'}
            </h2>
            <p className="text-muted-foreground text-sm mb-3">{gameResult.message}</p>
            {gameResult.winnerCartela && (
              <div className="flex justify-center">
                <BingoCartela numbers={gameResult.winnerCartela} drawnNumbers={drawnSet} size="sm" label="Winner's Card" />
              </div>
            )}
            {nextGameCountdown > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                {t('nextGameIn')} <span className="text-primary font-bold">{nextGameCountdown}</span> {t('seconds')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-sm font-bold text-primary">{t('bingo')}</h1>
          <span className="text-[10px] font-display font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
            {t('session')} #{sessionNumber}
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="w-3 h-3" /> {players.length}
          </span>
          {isSpectator && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"><Eye className="w-3 h-3 inline" /> {t('spectating')}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleToggleLang} className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground text-[10px] font-bold">
            {getLang() === 'ti' ? 'EN' : 'ትግ'}
          </button>
          <ThemeToggle />
          <MuteToggle />
          <button onClick={() => navigate('/payment')} className="text-xs font-display font-bold text-primary flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5" /> {balance}
          </button>
          <button onClick={handleLogout} className="text-muted-foreground p-1"><LogOut className="w-4 h-4" /></button>
        </div>
      </header>

      {/* Last win number */}
      {lastWinNumber && !isGameActive && (
        <div className="text-center py-1 bg-primary/5 text-xs text-muted-foreground">
          {t('lastWinNumber')}: <span className="font-bold text-primary">{getBingoLetter(lastWinNumber)} {lastWinNumber}</span>
        </div>
      )}

      {/* Buy/Waiting state */}
      {showBuyPrompt && !isGameActive && (
        <div className="px-3 pt-3">
          <div className="p-4 rounded-xl bg-card border border-border text-center mb-3">
            <p className="text-sm text-muted-foreground mb-2">
              {gameStatus === 'buying'
                ? `${t('buying')}! ${buyingCountdown > 0 ? `(${buyingCountdown}s)` : ''}`
                : gameStatus === 'won' ? (nextGameCountdown > 0 ? `${t('nextGameIn')} ${nextGameCountdown} ${t('seconds')}` : t('roundOver'))
                : t('waitingForGame')}
            </p>
            <button onClick={() => setShowShop(!showShop)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl gradient-neon text-primary-foreground text-sm font-bold active:scale-95">
              <ShoppingCart className="w-4 h-4" />
              {showShop ? t('hideShop') : t('buyCartelas')}
            </button>
          </div>
          {showShop && (
            <CartelaShop
              onBuy={refreshGameData}
              cartelaPrice={10}
              gameStatus={gameStatus}
            />
          )}
        </div>
      )}

      {/* ACTIVE GAME */}
      {isGameActive && (
        <div className="px-3 py-3 space-y-3">
          {/* Current number + pattern */}
          <div className="flex items-center gap-3">
            {lastNumber ? (
              <div key={lastNumber}
                className="w-16 h-16 rounded-xl gradient-neon flex flex-col items-center justify-center text-primary-foreground shadow-lg glow-neon flex-shrink-0">
                <span className="text-[10px] font-medium opacity-80">{getBingoLetter(lastNumber)}</span>
                <span className="text-2xl font-display font-bold -mt-1">{lastNumber}</span>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center text-muted-foreground text-xs flex-shrink-0">--</div>
            )}
            <div className="flex-1 flex items-center gap-2">
              <PatternGrid pattern={gamePattern} />
              <div>
                <div className="text-sm font-display font-bold text-foreground">{gamePattern}</div>
                <div className="text-xs text-muted-foreground">{drawnNumbers.length}/75 {t('drawn')}</div>
                {prizeAmount > 0 && <div className="text-xs font-bold text-primary">🏆 {prizeAmount} ETB</div>}
              </div>
            </div>
          </div>

          {/* Drawn numbers */}
          {drawnNumbers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {drawnNumbers.map(num => {
                const rowIdx = Math.floor((num - 1) / 15);
                const colors = ['bg-neon-blue', 'bg-neon-pink', 'bg-neon-green', 'bg-neon-yellow', 'bg-neon-purple'];
                return (
                  <div key={num} className={cn('w-7 h-7 flex items-center justify-center text-[9px] font-bold rounded text-white shadow', colors[rowIdx])}>
                    {num}
                  </div>
                );
              })}
            </div>
          )}

          {/* Collapsible 1-75 board */}
          <div className="rounded-xl overflow-hidden bg-muted/30 border border-border">
            <button onClick={() => setBoardOpen(prev => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-primary/80 to-secondary/80 text-primary-foreground text-xs font-bold">
              <span>{t('board')} ({drawnNumbers.length}/75)</span>
              {boardOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {boardOpen && (
              <div className="p-1.5">
                {['B', 'I', 'N', 'G', 'O'].map((letter, rowIdx) => {
                  const colorClasses = ['bg-neon-blue', 'bg-neon-pink', 'bg-neon-green', 'bg-neon-yellow', 'bg-neon-purple'];
                  return (
                    <div key={letter} className="flex items-center gap-[2px] mb-[3px] last:mb-0">
                      <div className={cn('w-5 h-5 flex-shrink-0 flex items-center justify-center font-display font-bold text-[10px] text-white rounded-sm', colorClasses[rowIdx])}>
                        {letter}
                      </div>
                      <div className="flex flex-1 gap-[2px] justify-between">
                        {Array.from({ length: 15 }, (_, i) => {
                          const num = rowIdx * 15 + i + 1;
                          const isDrawn = drawnSet.has(num);
                          return (
                            <div key={num}
                              className={cn('w-[20px] h-[20px] flex items-center justify-center text-[7px] font-bold border border-border/30 rounded-sm',
                                isDrawn ? `${colorClasses[rowIdx]} text-white` : 'bg-muted/30 text-muted-foreground'
                              )}>
                              {num}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Player's cartelas */}
          {playerCartelas.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {playerCartelas.map(c => {
                const cellsMarked = markedMap.get(c.id) || new Set<string>();
                const isClaimed = claimedCartelas.has(c.id);
                return (
                  <div key={c.id} className="flex flex-col gap-2">
                    <BingoCartela
                      numbers={c.numbers as number[][]}
                      drawnNumbers={drawnSet}
                      markedCells={cellsMarked}
                      onMarkCell={isSpectator ? undefined : (row, col) => handleMarkCell(c.id, row, col)}
                      size="sm"
                      label={`#${c.id}`}
                    />
                    {!isSpectator && (
                      <button onClick={() => handleClaimBingo(c.id, c)} disabled={isClaimed}
                        className={cn('w-full py-3 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all',
                          isClaimed ? 'bg-muted text-muted-foreground' : 'gradient-neon text-primary-foreground glow-neon'
                        )}>
                        <Hand className="w-4 h-4" />
                        {isClaimed ? t('verifying') : t('bingo') + '!'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Eye className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t('noCartelas')}</p>
            </div>
          )}
        </div>
      )}
      </PullToRefresh>
    </div>
  );
}
