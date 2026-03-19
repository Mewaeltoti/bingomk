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
import { playDrawSound, playWinSound, playMarkSound, playClaimApprovedSound, playClaimRejectedSound, announceNumber, isMuted, setMuted } from '@/lib/sounds';
import { invokeWithRetry } from '@/lib/edgeFn';
import { t, getLang, toggleLang } from '@/lib/i18n';
import { useTheme } from '@/hooks/useTheme';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Eye, Hand, ShoppingCart, ChevronDown, ChevronUp,
  Wallet, Search, Shuffle, Settings, X, Volume2, VolumeX,
  Moon, Sun, Globe, LogOut, User, MessageCircle, Send
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ─── Pattern preview grid ───────────────────────────────────
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

// ─── Confetti animation ─────────────────────────────────────
function Confetti() {
  const pieces = useMemo(() =>
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2,
      color: ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--neon-pink))', 'hsl(var(--neon-blue))'][Math.floor(Math.random() * 5)],
      size: 6 + Math.random() * 8,
    })), []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {pieces.map(p => (
        <motion.div
          key={p.id}
          initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0 }}
          animate={{ y: '110vh', opacity: 0, rotate: 720 }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
          style={{ position: 'absolute', width: p.size, height: p.size, backgroundColor: p.color, borderRadius: Math.random() > 0.5 ? '50%' : '2px' }}
        />
      ))}
    </div>
  );
}

// ─── Cartela Shop with Cart ─────────────────────────────────
function CartelaShop({ onBuy, cartelaPrice, gameStatus, prizeAmount }: {
  onBuy: () => void; cartelaPrice: number; gameStatus: string; prizeAmount: number;
}) {
  const [cartelas, setCartelas] = useState<any[]>([]);
  const [cart, setCart] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [buying, setBuying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const user = useUser();
  const pageSize = 30;
  const loaderRef = useRef<HTMLDivElement>(null);

  const loadCartelas = useCallback(() => {
    supabase.from('cartelas').select('*').eq('is_used', false).eq('banned_for_game', false).order('id', { ascending: false })
      .then(({ data }) => setCartelas((data || []).sort(() => Math.random() - 0.5)));
  }, []);

  useEffect(() => { loadCartelas(); }, [loadCartelas]);

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

  const toggleCart = (id: number) => {
    setCart(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const quickPick = (count: number) => {
    const available = filtered.filter(c => !cart.has(c.id));
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const picks = shuffled.slice(0, count);
    setCart(prev => { const next = new Set(prev); picks.forEach(c => next.add(c.id)); return next; });
    if (picks.length > 0) toast.success(`${picks.length} cartela(s) added to cart!`);
  };

  const changeCartelas = () => {
    setCart(new Set());
    loadCartelas();
    toast.success('Cartelas reshuffled!');
  };

  const handleBuy = async () => {
    if (!user?.id || cart.size === 0) return;
    setBuying(true);
    const { data, error } = await invokeWithRetry('purchase-cartela', {
      body: { cartela_ids: Array.from(cart) },
    });
    if (error || data?.error) {
      toast.error(data?.error || t('purchaseFailed'));
      setBuying(false);
      setShowConfirm(false);
      return;
    }
    setCartelas(prev => prev.filter(c => !cart.has(c.id)));
    setCart(new Set());
    setBuying(false);
    setShowConfirm(false);
    toast.success(t('purchased'));
    onBuy();
  };

  const cost = cart.size * cartelaPrice;
  const selectedCartelas = cartelas.filter(c => cart.has(c.id));

  return (
    <div className="space-y-3">
      {/* Live prize pool */}
      <motion.div
        key={prizeAmount}
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        className="text-center py-2 px-3 rounded-xl bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30"
      >
        <span className="text-xs text-muted-foreground">Live Prize Pool</span>
        <div className="text-2xl font-display font-bold text-primary">🏆 {prizeAmount} ETB</div>
      </motion.div>

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
        <button onClick={changeCartelas} className="px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-bold active:scale-95">
          <Shuffle className="w-4 h-4" />
        </button>
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

      <div className="grid grid-cols-3 gap-2 max-h-[40vh] overflow-y-auto">
        {visible.map(c => (
          <div key={c.id} onClick={() => toggleCart(c.id)} className="cursor-pointer">
            <BingoCartela
              numbers={c.numbers as number[][]}
              size="xs"
              label={`#${c.id}`}
              selected={cart.has(c.id)}
            />
          </div>
        ))}
      </div>
      <div ref={loaderRef} className="h-4" />

      {/* Cart bar */}
      {cart.size > 0 && (
        <div className="sticky bottom-0 bg-card border-t border-border p-3 -mx-3 -mb-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-foreground"><ShoppingCart className="w-4 h-4 inline mr-1" />{cart.size} in cart</span>
            <span className="text-sm font-display font-bold text-primary">{cost} ETB</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCart(new Set())}
              className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-bold active:scale-95">
              Clear
            </button>
            <button onClick={() => setShowConfirm(true)}
              className="flex-1 py-2.5 rounded-lg gradient-neon text-primary-foreground text-sm font-bold active:scale-95 glow-neon">
              Checkout
            </button>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-xl p-4 max-w-sm w-full max-h-[70vh] overflow-y-auto space-y-3"
            >
              <h3 className="font-display font-bold text-foreground text-center">Confirm Purchase</h3>
              <div className="grid grid-cols-3 gap-2">
                {selectedCartelas.map(c => (
                  <div key={c.id} className="relative">
                    <BingoCartela numbers={c.numbers as number[][]} size="xs" label={`#${c.id}`} />
                    <button
                      onClick={() => toggleCart(c.id)}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[10px]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-2 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{cart.size} cartela(s)</span>
                <span className="font-display font-bold text-primary text-lg">{cost} ETB</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground font-bold text-sm">
                  Cancel
                </button>
                <button onClick={handleBuy} disabled={buying}
                  className="flex-1 py-3 rounded-xl gradient-neon text-primary-foreground font-bold text-sm disabled:opacity-50 active:scale-95">
                  {buying ? '...' : `Pay ${cost} ETB`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Settings Drawer ────────────────────────────────────────
function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [muted, setMutedLocal] = useState(isMuted());
  const { theme, toggle: toggleTheme } = useTheme();
  const [, setTick] = useState(0);
  const user = useUser();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id || !open) return;
    supabase.from('profiles').select('display_name, phone').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) { setDisplayName(data.display_name || ''); setPhone(data.phone || ''); }
      });
  }, [user?.id, open]);

  const handleSaveName = async () => {
    if (!user?.id) return;
    setSaving(true);
    await supabase.from('profiles').update({ display_name: displayName }).eq('id', user.id);
    setSaving(false);
    toast.success('Name updated!');
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedLocal(next);
  };

  const handleToggleLang = () => {
    toggleLang();
    setTick(t => t + 1);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
    navigate('/login');
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="absolute right-0 top-0 bottom-0 w-72 bg-card border-l border-border p-4 space-y-5 overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-foreground">Settings</h2>
          <button onClick={onClose} className="p-2 rounded-lg bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        {/* Profile */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> Display Name</label>
          <div className="flex gap-2">
            <input
              type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="Your name"
            />
            <button onClick={handleSaveName} disabled={saving}
              className="px-3 py-2 rounded-lg gradient-neon text-primary-foreground text-xs font-bold disabled:opacity-50">
              {saving ? '...' : 'Save'}
            </button>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-muted-foreground text-xs">
            <span>📱 {phone || 'Not set'}</span>
            <span className="text-[10px]">(locked)</span>
          </div>
        </div>

        {/* Sound */}
        <button onClick={handleToggleMute}
          className="w-full flex items-center justify-between px-3 py-3 rounded-lg bg-muted text-foreground text-sm">
          <span className="flex items-center gap-2">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            Sound
          </span>
          <span className={cn('text-xs font-bold', muted ? 'text-destructive' : 'text-primary')}>
            {muted ? 'OFF' : 'ON'}
          </span>
        </button>

        {/* Theme */}
        <button onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-3 rounded-lg bg-muted text-foreground text-sm">
          <span className="flex items-center gap-2">
            {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            Theme
          </span>
          <span className="text-xs font-bold text-primary">{theme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>

        {/* Language */}
        <button onClick={handleToggleLang}
          className="w-full flex items-center justify-between px-3 py-3 rounded-lg bg-muted text-foreground text-sm">
          <span className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Language
          </span>
          <span className="text-xs font-bold text-primary">{getLang() === 'ti' ? 'ትግርኛ' : 'English'}</span>
        </button>

        {/* Support */}
        <a
          href="https://t.me/+251978187178"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-2 px-3 py-3 rounded-lg bg-primary/10 text-primary text-sm font-medium"
        >
          <Send className="w-4 h-4" />
          Telegram Support
        </a>

        {/* Logout */}
        <button onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg bg-destructive/10 text-destructive text-sm font-bold">
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Game Page ─────────────────────────────────────────
type GameResult = {
  type: 'winner' | 'split' | 'disqualified';
  message: string;
  winnerCartela?: number[][];
};

export default function GamePage() {
  const [playerCartelas, setPlayerCartelas] = useState<any[]>([]);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [gamePattern, setGamePattern] = useState<string>('Full House');
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [markedMap, setMarkedMap] = useState<Map<number, Set<string>>>(new Map());
  const [claimedCartelas, setClaimedCartelas] = useState<Set<number>>(new Set());
  const [bannedCartelas, setBannedCartelas] = useState<Set<number>>(new Set());
  const [gameStatus, setGameStatus] = useState<string>('waiting');
  const [sessionNumber, setSessionNumber] = useState(1);
  const [nextGameCountdown, setNextGameCountdown] = useState(0);
  const [buyingCountdown, setBuyingCountdown] = useState(0);
  const buyingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextGameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string>('');
  const [balance, setBalance] = useState(0);
  const [prizeAmount, setPrizeAmount] = useState(0);
  const [cartelaPrice, setCartelaPrice] = useState(10);
  const [, setLangTick] = useState(0);
  const [soldCount, setSoldCount] = useState(0);
  const [hasPendingClaim, setHasPendingClaim] = useState(false);
  const user = useUser();
  const navigate = useNavigate();
  const players = useGamePresence(user?.id, displayName);

  // Persist marked numbers to localStorage
  const MARKS_KEY = `bingo-marks-${sessionNumber}`;

  // Load persisted marks on mount/session change
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MARKS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const map = new Map<number, Set<string>>();
        for (const [k, v] of Object.entries(parsed)) {
          map.set(Number(k), new Set(v as string[]));
        }
        setMarkedMap(map);
      }
    } catch { /* ignore */ }
  }, [MARKS_KEY]);

  // Save marks whenever they change
  useEffect(() => {
    if (markedMap.size === 0) return;
    const obj: Record<number, string[]> = {};
    markedMap.forEach((cells, id) => { obj[id] = Array.from(cells); });
    localStorage.setItem(MARKS_KEY, JSON.stringify(obj));
  }, [markedMap, MARKS_KEY]);

  // Clear old session marks
  useEffect(() => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('bingo-marks-') && k !== MARKS_KEY);
    keys.forEach(k => localStorage.removeItem(k));
  }, [MARKS_KEY]);

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
      setCartelaPrice((gameRes.data as any).cartela_price || 10);
      setSessionNumber((gameRes.data as any).session_number || 1);
      if (gameRes.data.status === 'won') {
        setGameResult({ type: 'winner', message: t('winnerAnnounced') });
        setShowResult(true);
        if (gameRes.data.winner_id === user?.id) {
          setGameResult({ type: 'winner', message: t('youWon') });
          setShowConfetti(true);
        }
      }
    }
    if (claimsRes.data) {
      const userClaims = claimsRes.data.filter((c: any) => c.user_id === user.id);
      const claimed = new Set<number>();
      for (const claim of userClaims) {
        const cid = (claim as any).cartela_id;
        if (cid && claim.is_valid !== false) claimed.add(cid);
      }
      setClaimedCartelas(claimed);
    }
    setBannedCartelas(new Set((cartelasRes.data || []).filter((c: any) => c.banned_for_game).map((c: any) => c.id)));
    if (profileRes.data) setBalance((profileRes.data as any).balance || 0);
    // Check pending claims
    if (claimsRes.data && user?.id) {
      setHasPendingClaim(claimsRes.data.some((c: any) => c.user_id === user.id && c.is_valid === null));
    }
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
        setCartelaPrice((gameRes.data as any).cartela_price || 10);
        setSessionNumber((gameRes.data as any).session_number || 1);
        if (gameRes.data.status === 'won') {
          setGameResult({ type: 'winner', message: t('winnerAnnounced') });
          setShowResult(true);
          if (gameRes.data.winner_id === user?.id) {
            setGameResult({ type: 'winner', message: t('youWon') });
            setShowConfetti(true);
          }
        }
        // If buying, calculate remaining countdown
        if (gameRes.data.status === 'buying') {
          const createdAt = new Date(gameRes.data.created_at).getTime();
          const elapsed = Math.floor((Date.now() - createdAt) / 1000);
          const remaining = Math.max(0, 120 - elapsed);
          setBuyingCountdown(remaining);
          setShowShop(true);
          if (remaining > 0) {
            if (buyingTimerRef.current) clearInterval(buyingTimerRef.current);
            buyingTimerRef.current = setInterval(() => {
              setBuyingCountdown(prev => {
                if (prev <= 1) { if (buyingTimerRef.current) clearInterval(buyingTimerRef.current); return 0; }
                return prev - 1;
              });
            }, 1000);
          }
        }
      }
      if (claimsRes.data && user?.id) {
        const userClaims = claimsRes.data.filter((c: any) => c.user_id === user.id);
        const claimed = new Set<number>();
        for (const claim of userClaims) {
          const cid = (claim as any).cartela_id;
          if (cid && claim.is_valid !== false) claimed.add(cid);
        }
        setClaimedCartelas(claimed);
      }
    }
    fetchGameState();
  }, [user?.id]);

  const drawnSet = useMemo(() => new Set(drawnNumbers), [drawnNumbers]);

  // Realtime subscriptions
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
            setShowConfetti(false);
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
            setDrawnNumbers([]); setShowResult(false); setGameResult(null); setShowConfetti(false); setMarkedMap(new Map()); setClaimedCartelas(new Set());
          }
          if (game.status === 'won') {
            setGameResult({ type: 'winner', message: t('winnerAnnounced') });
            setShowResult(true);
            playWinSound();
            if (game.winner_id === user?.id) {
              setGameResult({ type: 'winner', message: t('youWon') });
              setShowConfetti(true);
            }
            fetchWinnerCartela();
            // Auto-hide result after 30 seconds
            if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
            resultTimerRef.current = setTimeout(() => {
              setShowResult(false);
              setShowConfetti(false);
            }, 30000);
            // Countdown to next game
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
          if (game.cartela_price !== undefined) setCartelaPrice(game.cartela_price);
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bingo_claims' },
        (payload: any) => {
          const claim = payload.new;
          if (claim.user_id !== user?.id) return;
          const cid = claim.cartela_id;
          if (claim.is_valid === false) {
            playClaimRejectedSound();
            toast.error(`❌ Claim rejected — Cartela #${cid} banned`, { duration: 6000 });
            setClaimedCartelas(prev => { const next = new Set(prev); next.delete(cid); return next; });
            setBannedCartelas(prev => new Set(prev).add(cid));
          }
          if (claim.is_valid === true) {
            playClaimApprovedSound();
            toast.success('🏆 BINGO CONFIRMED! Prize credited to your wallet!', { duration: 8000 });
            setShowConfetti(true);
            refreshGameData();
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

  const handleClaimBingo = async (cartelaId: number) => {
    if (!user?.id || isSpectator || claimedCartelas.has(cartelaId) || bannedCartelas.has(cartelaId)) return;
    setClaimedCartelas(prev => new Set(prev).add(cartelaId));
    const { data, error } = await invokeWithRetry('verify-claim', {
      body: { action: 'claim', cartela_id: cartelaId },
    });
    if (error || data?.error) {
      toast.error(data?.error || 'Failed to claim');
      setClaimedCartelas(prev => { const next = new Set(prev); next.delete(cartelaId); return next; });
      return;
    }
    if (data?.result === 'invalid_banned') {
      setBannedCartelas(prev => new Set(prev).add(cartelaId));
      toast.error('Wrong bingo: this cartela is banned for this round.');
      return;
    }
    if (data?.result === 'pending_review') {
      toast.success('🎯 BINGO claimed! Waiting for admin confirmation...');
      return;
    }
    toast.success(t('claimSuccess'));
  };

  const isGameActive = gameStatus === 'active';
  const showBuyPrompt = gameStatus === 'buying' || gameStatus === 'waiting' || gameStatus === 'stopped' || gameStatus === 'won';

  return (
    <div className="min-h-screen bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <PullToRefresh onRefresh={refreshGameData}>

      {/* Confetti */}
      <AnimatePresence>{showConfetti && <Confetti />}</AnimatePresence>

      {/* Winner overlay — shown 30 seconds */}
      <AnimatePresence>
        {showResult && gameResult && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm"
            onClick={() => { setShowResult(false); setShowConfetti(false); }}
          >
            <motion.div
              initial={{ scale: 0.8 }} animate={{ scale: 1 }}
              className="text-center p-6 rounded-xl bg-card border-2 border-primary max-w-xs mx-4 glow-neon"
            >
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings drawer */}
      <AnimatePresence>
        {settingsOpen && <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
      </AnimatePresence>

      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-3 py-2 flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-1.5">
          <h1 className="font-display text-sm font-bold text-primary leading-none">{t('bingo')}</h1>
          <span className="shrink-0 text-[10px] font-display font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded leading-none">
            #{sessionNumber}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground flex items-center gap-0.5 leading-none">
            <Users className="w-3 h-3" /> {players.length}
          </span>
          {isSpectator && <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground"><Eye className="w-3 h-3 inline" /></span>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={() => navigate('/payment')} className="rounded-lg bg-primary/10 px-2 py-1.5 text-[11px] font-display font-bold text-primary flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5" /> {balance}
          </button>
          <button onClick={() => setSettingsOpen(true)} className="rounded-lg bg-muted p-2 text-muted-foreground hover:text-foreground">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Buying state with countdown */}
      {showBuyPrompt && !isGameActive && (
        <div className="px-3 pt-3">
          <div className="p-4 rounded-xl bg-card border border-border text-center mb-3">
            {gameStatus === 'buying' && buyingCountdown > 0 && (
              <div className="mb-2">
                <div className="text-3xl font-display font-bold text-primary">
                  {Math.floor(buyingCountdown / 60)}:{String(buyingCountdown % 60).padStart(2, '0')}
                </div>
                <p className="text-xs text-muted-foreground">{t('buying')} — game starts when timer ends</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground mb-2">
              {gameStatus === 'buying' && buyingCountdown <= 0
                ? 'Starting soon...'
                : gameStatus === 'won' ? (nextGameCountdown > 0 ? `${t('nextGameIn')} ${nextGameCountdown} ${t('seconds')}` : t('roundOver'))
                : gameStatus !== 'buying' ? t('waitingForGame') : null}
            </p>
            {(gameStatus === 'buying' || gameStatus === 'waiting') && (
              <button onClick={() => setShowShop(!showShop)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl gradient-neon text-primary-foreground text-sm font-bold active:scale-95">
                <ShoppingCart className="w-4 h-4" />
                {showShop ? t('hideShop') : t('buyCartelas')}
              </button>
            )}
          </div>
          {showShop && (
            <CartelaShop
              onBuy={refreshGameData}
              cartelaPrice={cartelaPrice}
              gameStatus={gameStatus}
              prizeAmount={prizeAmount}
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
              <motion.div key={lastNumber}
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="w-16 h-16 rounded-xl gradient-neon flex flex-col items-center justify-center text-primary-foreground shadow-lg glow-neon flex-shrink-0">
                <span className="text-[10px] font-medium opacity-80">{getBingoLetter(lastNumber)}</span>
                <span className="text-2xl font-display font-bold -mt-1">{lastNumber}</span>
              </motion.div>
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
              {drawnNumbers.map((num, i) => {
                const rowIdx = Math.floor((num - 1) / 15);
                const colors = ['bg-neon-blue', 'bg-neon-pink', 'bg-neon-green', 'bg-neon-yellow', 'bg-neon-purple'];
                return (
                  <motion.div
                    key={num}
                    initial={i === drawnNumbers.length - 1 ? { scale: 0 } : false}
                    animate={{ scale: 1 }}
                    className={cn('w-7 h-7 flex items-center justify-center text-[9px] font-bold rounded text-white shadow', colors[rowIdx])}
                  >
                    {num}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* 1-75 board */}
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
                const isBanned = bannedCartelas.has(c.id) || c.banned_for_game;
                return (
                  <div key={c.id} className="flex flex-col gap-2">
                    <BingoCartela
                      numbers={c.numbers as number[][]}
                      drawnNumbers={drawnSet}
                      markedCells={cellsMarked}
                      onMarkCell={isSpectator || isBanned ? undefined : (row, col) => handleMarkCell(c.id, row, col)}
                      size="sm"
                      label={`#${c.id}`}
                      banned={isBanned}
                    />
                    {!isSpectator && (
                      <button onClick={() => handleClaimBingo(c.id)} disabled={isClaimed || isBanned}
                        className={cn('w-full py-3 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all',
                          isBanned ? 'bg-destructive/15 text-destructive border border-destructive/30' : isClaimed ? 'bg-muted text-muted-foreground' : 'gradient-neon text-primary-foreground glow-neon'
                        )}>
                        <Hand className="w-4 h-4" />
                        {isBanned ? 'Banned' : isClaimed ? t('verifying') : t('bingo') + '!'}
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
