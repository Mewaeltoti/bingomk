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
import { playDrawSound, playWinSound, playMarkSound, playClaimApprovedSound, playClaimRejectedSound, isMuted, setMuted } from '@/lib/sounds';
import { invokeWithRetry } from '@/lib/edgeFn';
import { t, getLang, toggleLang } from '@/lib/i18n';
import { useTheme } from '@/hooks/useTheme';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Eye, Hand, ShoppingCart, ChevronDown, ChevronUp,
  Wallet, Settings, X, Volume2, VolumeX,
  Moon, Sun, Globe, LogOut, User, Send
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

// ─── Cartela Shop with + Button ─────────────────────────────
function CartelaShop({ onBuy, cartelaPrice, gameStatus, prizeAmount, balance }: {
  onBuy: () => void; cartelaPrice: number; gameStatus: string; prizeAmount: number; balance: number;
}) {
  const [cart, setCart] = useState<any[]>([]);
  const [buying, setBuying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [adding, setAdding] = useState(false);
  const user = useUser();

  const addRandomCartela = async () => {
    setAdding(true);
    const existingIds = cart.map(c => c.id);
    let query = supabase.from('cartelas').select('*').eq('is_used', false).eq('banned_for_game', false);
    if (existingIds.length > 0) {
      // Exclude already-in-cart cartelas
      for (const id of existingIds) {
        query = query.neq('id', id);
      }
    }
    const { data } = await query.limit(50);
    if (data && data.length > 0) {
      const random = data[Math.floor(Math.random() * data.length)];
      setCart(prev => [...prev, random]);
    } else {
      toast.info('No more cartelas available');
    }
    setAdding(false);
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(c => c.id !== id));
  };

  const [showDepositPrompt, setShowDepositPrompt] = useState(false);
  const navigate = useNavigate();

  const handleBuy = async () => {
    if (!user?.id || cart.length === 0) return;
    setBuying(true);
    const { data, error } = await invokeWithRetry('purchase-cartela', {
      body: { cartela_ids: cart.map(c => c.id) },
    });
    if (error || data?.error) {
      const msg = data?.error || t('purchaseFailed');
      if (msg.toLowerCase().includes('insufficient')) {
        setShowDepositPrompt(true);
      } else {
        toast.error(msg);
      }
      setBuying(false);
      setShowConfirm(false);
      return;
    }
    setCart([]);
    setBuying(false);
    setShowConfirm(false);
    toast.success(t('purchased'));
    onBuy();
  };

  const cost = cart.length * cartelaPrice;

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

      <p className="text-xs text-muted-foreground text-center">{cartelaPrice} ETB each — tap + to get a random cartela</p>

      {/* Cart items */}
      {cart.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {cart.map(c => (
            <div key={c.id} className="relative">
              <BingoCartela numbers={c.numbers as number[][]} size="xs" label={`#${c.id}`} selected />
              <button
                onClick={() => removeFromCart(c.id)}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Floating circle add button — bottom left */}
      <button
        onClick={addRandomCartela}
        disabled={adding}
        className="fixed bottom-20 left-4 z-40 w-14 h-14 rounded-full gradient-neon text-primary-foreground shadow-xl glow-neon flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
      >
        {adding ? (
          <span className="animate-spin w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full" />
        ) : (
          <span className="text-3xl font-bold leading-none">+</span>
        )}
      </button>

      {/* Buy bar */}
      {cart.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="text-muted-foreground">Cart: <span className="font-bold text-foreground">{cost} ETB</span></span>
            <span className={cn('font-bold', balance >= cost ? 'text-primary' : 'text-destructive')}>
              Balance: {balance} ETB {balance < cost ? '⚠️' : '✓'}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCart([])}
              className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground font-bold text-sm active:scale-95">
              Clear ({cart.length})
            </button>
            <button onClick={() => setShowConfirm(true)}
              className={cn('flex-1 py-3 rounded-xl font-bold text-sm active:scale-95',
                balance >= cost ? 'gradient-neon text-primary-foreground glow-neon' : 'bg-destructive/80 text-destructive-foreground'
              )}>
              {balance >= cost ? `Buy ${cart.length} — ${cost} ETB` : `Need ${cost - balance} more ETB`}
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
                {cart.map(c => (
                  <div key={c.id} className="relative">
                    <BingoCartela numbers={c.numbers as number[][]} size="xs" label={`#${c.id}`} />
                    <button
                      onClick={() => removeFromCart(c.id)}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[10px]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-2 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{cart.length} cartela(s)</span>
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
      {/* Insufficient balance modal */}
      <AnimatePresence>
        {showDepositPrompt && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
            onClick={() => setShowDepositPrompt(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-xl p-5 max-w-xs w-full text-center space-y-4"
            >
              <div className="text-4xl">💰</div>
              <h3 className="font-display font-bold text-foreground text-lg">Insufficient Balance</h3>
              <p className="text-sm text-muted-foreground">You don't have enough balance to buy these cartelas. Deposit now to continue playing!</p>
              <div className="flex gap-2">
                <button onClick={() => setShowDepositPrompt(false)}
                  className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground font-bold text-sm">
                  Cancel
                </button>
                <button onClick={() => { setShowDepositPrompt(false); navigate('/payment'); }}
                  className="flex-1 py-3 rounded-xl gradient-neon text-primary-foreground font-bold text-sm active:scale-95 glow-neon">
                  <Wallet className="w-4 h-4 inline mr-1" /> Deposit
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
        setHasPendingClaim(claimsRes.data.some((c: any) => c.user_id === user.id && c.is_valid === null));
      }
    }
    fetchGameState();
    // Fetch sold count
    supabase.from('cartelas').select('id', { count: 'exact', head: true }).eq('is_used', true).not('owner_id', 'is', null)
      .then(({ count }) => setSoldCount(count || 0));
  }, [user?.id]);

  const drawnSet = useMemo(() => new Set(drawnNumbers), [drawnNumbers]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('game-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_numbers', filter: 'game_id=eq.current' },
        (payload: any) => {
          const num = payload.new.number;
          setDrawnNumbers(prev => {
            if (prev.includes(num)) return prev;
            return [...prev, num];
          });
          playDrawSound();
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: 'id=eq.current' },
        (payload: any) => {
          const game = payload.new;
          if (!game) return;
          setGameStatus(game.status);
          setSessionNumber(game.session_number || 1);
          if (game.status === 'buying') {
            setDrawnNumbers([]);
            setShowResult(false);
            setGameResult(null);
            setShowConfetti(false);
            setMarkedMap(new Map());
            setClaimedCartelas(new Set());
            setHasPendingClaim(false);
            setShowShop(true);
            setNextGameCountdown(0);
            setSoldCount(0);
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
            // Re-fetch drawn numbers to ensure sync
            supabase.from('game_numbers').select('number').eq('game_id', 'current').order('id', { ascending: true })
              .then(({ data }) => {
                if (data) setDrawnNumbers(data.map((n: any) => n.number));
              });
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
            if (game.winner_id && game.winner_id === user?.id) {
              setGameResult({ type: 'winner', message: t('youWon') });
              setShowConfetti(true);
              playWinSound();
            } else if (game.winner_id) {
              setGameResult({ type: 'winner', message: t('winnerAnnounced') });
              playWinSound();
            } else {
              // House win — no player won
              setGameResult({ type: 'winner', message: 'Better luck next time! 🎰' });
            }
            setShowResult(true);
            fetchWinnerCartela();
            if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
            resultTimerRef.current = setTimeout(() => {
              setShowResult(false);
              setShowConfetti(false);
            }, 30000);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bingo_claims', filter: 'game_id=eq.current' },
        (payload: any) => {
          const claim = payload.new;
          if (!claim || claim.user_id !== user?.id) return;
          const cid = claim.cartela_id;
          if (claim.is_valid === null) {
            setHasPendingClaim(true);
          }
          if (claim.is_valid === false) {
            playClaimRejectedSound();
            toast.error(`❌ Claim rejected — Cartela #${cid} banned`, { duration: 6000 });
            setClaimedCartelas(prev => { const next = new Set(prev); next.delete(cid); return next; });
            setBannedCartelas(prev => new Set(prev).add(cid));
            setHasPendingClaim(false);
          }
          if (claim.is_valid === true) {
            playClaimApprovedSound();
            toast.success('🏆 BINGO CONFIRMED! Prize credited to your wallet!', { duration: 8000 });
            setShowConfetti(true);
            setHasPendingClaim(false);
            refreshGameData();
          }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cartelas' },
        (payload: any) => {
          const prev = payload.old;
          const next = payload.new;
          if (!prev?.is_used && next?.is_used && next?.owner_id) {
            setSoldCount(c => c + 1);
          }
          if (next?.is_used && next?.owner_id) {
            supabase.from('games').select('prize_amount').eq('id', 'current').maybeSingle()
              .then(({ data }) => {
                if (data?.prize_amount !== undefined) setPrizeAmount(data.prize_amount);
              });
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
          {/* Pending claim badge */}
          {hasPendingClaim && (
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="px-2 py-1 rounded-lg bg-accent/15 border border-accent/30 text-[10px] font-bold text-accent flex items-center gap-1"
            >
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-1.5 h-1.5 rounded-full bg-accent inline-block"
              />
              Verifying
            </motion.div>
          )}
          <button onClick={() => navigate('/payment')} className="rounded-lg bg-primary/10 px-2 py-1.5 text-[11px] font-display font-bold text-primary flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5" /> {balance}
          </button>
          <button onClick={() => setSettingsOpen(true)} className="relative rounded-lg bg-muted p-2 text-muted-foreground hover:text-foreground">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Buying state with countdown */}
      {showBuyPrompt && !isGameActive && (
        <div className="px-3 pt-3">
          <div className="p-4 rounded-xl bg-card border border-border text-center mb-3">
            {/* Game info */}
            <div className="flex items-center justify-center gap-3 mb-2 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-display font-bold">Game #{sessionNumber}</span>
              <span className="flex items-center gap-1">🎯 {gamePattern}</span>
              <span className="flex items-center gap-1">🎫 {cartelaPrice} ETB</span>
            </div>
            {gameStatus === 'buying' && buyingCountdown > 0 && (
              <div className="mb-2">
                <div className="text-3xl font-display font-bold text-primary">
                  {Math.floor(buyingCountdown / 60)}:{String(buyingCountdown % 60).padStart(2, '0')}
                </div>
                <p className="text-xs text-muted-foreground">{t('buying')} — game starts when timer ends</p>
                {/* Live stats */}
                <div className="flex items-center justify-center gap-4 mt-2">
                  <motion.div key={`p-${players.length}`} initial={{ scale: 1.2 }} animate={{ scale: 1 }}
                    className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span className="font-bold text-foreground">{players.length}</span> online
                  </motion.div>
                  <motion.div key={`s-${soldCount}`} initial={{ scale: 1.3 }} animate={{ scale: 1 }}
                    className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ShoppingCart className="w-3.5 h-3.5 text-primary" />
                    <span className="font-bold text-foreground">{soldCount}</span> sold
                  </motion.div>
                </div>
              </div>
            )}
            <p className="text-sm text-muted-foreground mb-3">
              {gameStatus === 'buying' && buyingCountdown <= 0
                ? 'Starting soon...'
                : gameStatus === 'won' ? (nextGameCountdown > 0 ? `${t('nextGameIn')} ${nextGameCountdown} ${t('seconds')}` : t('roundOver'))
                : gameStatus !== 'buying' ? t('waitingForGame') : null}
            </p>
            {(gameStatus === 'buying' || gameStatus === 'waiting') && (
              <button onClick={() => setShowShop(!showShop)}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl gradient-neon text-primary-foreground text-sm font-bold active:scale-95 shadow-lg glow-neon">
                <ShoppingCart className="w-5 h-5" />
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
              balance={balance}
            />
          )}
        </div>
      )}

      {/* ACTIVE GAME — redesigned to match reference UI */}
      {isGameActive && (
        <div className="px-3 py-3 space-y-3">
          {/* Show More / Less toggle */}
          <div className="flex justify-end">
            <button
              onClick={() => setBoardOpen(prev => !prev)}
              className="flex items-center gap-1 text-rose-500 text-sm font-bold active:scale-95"
            >
              {boardOpen ? (
                <><ChevronUp className="w-4 h-4" /> Show Less</>
              ) : (
                <><ChevronDown className="w-4 h-4" /> Show More</>
              )}
            </button>
          </div>

          {/* Collapsible game info — only when boardOpen */}
          {boardOpen && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2 text-sm">
                <span className="text-primary">✦</span>
                <span className="text-muted-foreground">Game:</span>
                <span className="font-bold text-foreground">{gamePattern}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 px-4 py-3 text-xs border-b border-border">
                <div><span className="text-muted-foreground">ID: </span><span className="font-mono text-foreground">#{sessionNumber}</span></div>
                <div><span className="text-muted-foreground">Players: </span><span className="font-bold text-foreground">{players.length}</span></div>
                <div className="text-right"><span className="text-muted-foreground">Status: </span><span className="font-bold text-emerald-600">Playing</span></div>
              </div>
              <div className="grid grid-cols-3 gap-2 px-4 py-3 text-xs">
                <div><span className="text-muted-foreground">Price: </span><span className="font-bold text-emerald-600">${cartelaPrice}</span></div>
                <div><span className="text-muted-foreground">Cards: </span><span className="font-bold text-foreground">{playerCartelas.length}</span></div>
                <div className="text-right"><span className="text-muted-foreground">Prize: </span><span className="font-bold text-amber-500">${prizeAmount}</span></div>
              </div>
            </div>
          )}

          {/* Called Numbers panel */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-foreground text-sm">Called Numbers:</span>
              <span className="text-muted-foreground text-sm">Drawn: {drawnNumbers.length}</span>
            </div>

            {drawnNumbers.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-2">Not called yet</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {drawnNumbers.slice().reverse().map((num, i) => {
                  const rowIdx = Math.floor((num - 1) / 15);
                  const ballGradients = [
                    'bg-gradient-to-br from-blue-400 to-blue-700',
                    'bg-gradient-to-br from-rose-400 to-rose-700',
                    'bg-gradient-to-br from-teal-400 to-teal-700',
                    'bg-gradient-to-br from-purple-400 to-purple-700',
                    'bg-gradient-to-br from-orange-400 to-orange-700',
                  ];
                  const isLatest = i === 0;
                  return (
                    <motion.div
                      key={num}
                      initial={isLatest ? { scale: 0, rotate: -180 } : false}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', damping: 14, stiffness: 200 }}
                      className={cn(
                        'flex items-center justify-center rounded-full text-white font-display font-bold shadow-lg',
                        ballGradients[rowIdx],
                        isLatest ? 'w-14 h-14 text-base ring-4 ring-white/40' : 'w-10 h-10 text-xs'
                      )}
                    >
                      {isLatest ? `${getBingoLetter(num)}-${num}` : num}
                    </motion.div>
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
