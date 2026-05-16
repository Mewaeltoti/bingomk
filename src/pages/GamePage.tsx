import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import PullToRefresh from '@/components/PullToRefresh';
import BingoCartela from '@/components/BingoCartela';
import CartelaDetailModal from '@/components/CartelaDetailModal';
import PublicCartelaModal from '@/components/PublicCartelaModal';
import WinnerSummaryPanel, { FloatingBallsStack } from '@/components/WinnerSummaryPanel';
import SettingsDrawer from '@/components/SettingsDrawer';
import { 
  Confetti, 
  GameHeader, 
  ClaimBanners, 
  GameInfoPanel, 
  CalledNumbersDisplay, 
  PlayerCartelas, 
  PatternHelpModal, 
  WinnerOverlay 
} from '@/components/game';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/auth';
import { useGamePresence } from '@/hooks/useGamePresence';

import { checkWin, getPatternCells } from '@/lib/winDetection';
import { PATTERNS } from '@/lib/bingo';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { playDrawSound, playWinSound, playMarkSound, playClaimApprovedSound, playClaimRejectedSound } from '@/lib/sounds';
import { invokeWithRetry } from '@/lib/edgeFn';
import { t } from '@/lib/i18n';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Hand, Eye, X } from 'lucide-react';

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string>('');
  const [balance, setBalance] = useState(0);
  const [prizeAmount, setPrizeAmount] = useState(0);
  const [cartelaPrice, setCartelaPrice] = useState(10);
  const [, setLangTick] = useState(0);
  const [soldCount, setSoldCount] = useState(0);
  const [hasPendingClaim, setHasPendingClaim] = useState(false);
  const [detailCartelaId, setDetailCartelaId] = useState<number | null>(null);
  const [winnerCartelaIds, setWinnerCartelaIds] = useState<number[]>([]);
  const [publicBannedIds, setPublicBannedIds] = useState<number[]>([]);
  const [activeClaimId, setActiveClaimId] = useState<number | null>(null);
  const [activeWinnerId, setActiveWinnerId] = useState<number | null>(null);
  const [publicModal, setPublicModal] = useState<{ id: number; status: 'banned' | 'claimed' | 'winner' } | null>(null);
  const [showPatternHelp, setShowPatternHelp] = useState(false);
  const [phone, setPhone] = useState<string>('');
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
          setPhone((data as any).phone || '');
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
    supabase.from('cartelas').select('id, banned_for_game, is_used, owner_id').eq('is_used', true).not('owner_id', 'is', null)
      .then(({ data }) => {
        setSoldCount((data || []).length);
        setPublicBannedIds((data || []).filter((c: any) => c.banned_for_game).map((c: any) => c.id));
      });
    // Initial: any pending claim?
    supabase.from('bingo_claims').select('cartela_id, is_valid').eq('game_id', 'current')
      .then(({ data }) => {
        const pending = (data || []).find((c: any) => c.is_valid === null);
        const winner = (data || []).find((c: any) => c.is_valid === true);
        if (pending?.cartela_id) setActiveClaimId(pending.cartela_id);
        if (winner?.cartela_id) setActiveWinnerId(winner.cartela_id);
      });
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
            setWinnerCartelaIds([]);
            setNextGameCountdown(0);
            setSoldCount(0);
            setPublicBannedIds([]);
            setActiveClaimId(null);
            setActiveWinnerId(null);
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
          if (!claim) return;

          // GLOBAL broadcast: any pending claim shows BINGO banner to all players
          if (claim.is_valid === null && claim.cartela_id) {
            setActiveClaimId(claim.cartela_id);
          }
          // Confirmed winner: announce to all
          if (claim.is_valid === true && claim.cartela_id) {
            setActiveWinnerId(claim.cartela_id);
            setActiveClaimId(null);
          }
          // Rejected: clear active claim banner
          if (claim.is_valid === false) {
            setActiveClaimId(prev => prev === claim.cartela_id ? null : prev);
          }

          // Personal feedback
          if (claim.user_id !== user?.id) return;
          const cid = claim.cartela_id;
          if (claim.is_valid === null) setHasPendingClaim(true);
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
          // GLOBAL: track newly banned cartelas for everyone
          if (next?.banned_for_game && !prev?.banned_for_game && next?.id) {
            setPublicBannedIds(ids => ids.includes(next.id) ? ids : [...ids, next.id]);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  async function fetchWinnerCartela() {
    const { data: claims } = await supabase.from('bingo_claims').select('cartela_id').eq('game_id', 'current').eq('is_valid', true);
    if (claims && claims.length > 0) {
      const ids = claims.map((c: any) => c.cartela_id).filter(Boolean);
      setWinnerCartelaIds(ids);
      const cid = ids[0];
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
    const sourceCartela = playerCartelas.find(c => c.id === cartelaId);
    const tappedNumber = sourceCartela?.numbers?.[row]?.[col];
    if (tappedNumber == null) return;

    const syncAcross = localStorage.getItem('bingo-sync-marks') !== '0';
    const sourceKey = `${row}-${col}`;
    const sourceMarked = markedMap.get(cartelaId)?.has(sourceKey) ?? false;
    const shouldMark = !sourceMarked;

    setMarkedMap(prev => {
      const next = new Map(prev);
      if (!syncAcross) {
        const cells = new Set(next.get(cartelaId) || []);
        if (shouldMark) cells.add(sourceKey); else cells.delete(sourceKey);
        next.set(cartelaId, cells);
        return next;
      }
      for (const c of playerCartelas) {
        const grid = c.numbers as number[][];
        if (!grid) continue;
        const cells = new Set(next.get(c.id) || []);
        let touched = false;
        for (let r = 0; r < 5; r++) {
          for (let col2 = 0; col2 < 5; col2++) {
            if (r === 2 && col2 === 2) continue;
            if (grid[r]?.[col2] === tappedNumber) {
              const k = `${r}-${col2}`;
              if (shouldMark) cells.add(k); else cells.delete(k);
              touched = true;
            }
          }
        }
        if (touched) next.set(c.id, cells);
      }
      return next;
    });
  }, [playerCartelas, markedMap]);

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
      <AnimatePresence><Confetti show={showConfetti} /></AnimatePresence>

      {/* Winner overlay */}
      <AnimatePresence>
        <WinnerOverlay
          show={showResult}
          gameResult={gameResult}
          drawnSet={drawnSet}
          nextGameCountdown={nextGameCountdown}
          onDismiss={() => { setShowResult(false); setShowConfetti(false); }}
        />
      </AnimatePresence>

      {/* Settings drawer */}
      <AnimatePresence>
        {settingsOpen && <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
      </AnimatePresence>

      {/* Top bar */}
      <GameHeader
        sessionNumber={sessionNumber}
        isSpectator={isSpectator}
        hasPendingClaim={hasPendingClaim}
        balance={balance}
        onSettingsClick={() => setSettingsOpen(true)}
        onHelpClick={() => setShowPatternHelp(true)}
      />


      {/* ACTIVE GAME */}
      {isGameActive && (
        <div className="px-3 py-3 space-y-3">
          {/* Claim banners */}
          <ClaimBanners
            activeClaimId={activeClaimId}
            activeWinnerId={activeWinnerId}
            publicBannedIds={publicBannedIds}
            onViewCartela={(id, status) => setPublicModal({ id, status })}
          />

          {/* Game info panel */}
          <GameInfoPanel
            boardOpen={boardOpen}
            onToggle={() => setBoardOpen(prev => !prev)}
            gamePattern={gamePattern}
            sessionNumber={sessionNumber}
            cartelaPrice={cartelaPrice}
            prizeAmount={prizeAmount}
          />

          {/* Called Numbers */}
          <CalledNumbersDisplay drawnNumbers={drawnNumbers} boardOpen={boardOpen} />
          {showResult && (
            <>
              <WinnerSummaryPanel
                ownedCartelas={playerCartelas.map(c => c.id).filter(id => !bannedCartelas.has(id))}
                bannedCartelas={Array.from(bannedCartelas)}
                winnerCartelas={winnerCartelaIds}
                finished={true}
              />
              <FloatingBallsStack />
            </>
          )}

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
                      onClick={() => setDetailCartelaId(c.id)}
                      size="sm"
                      label={`#${c.id}`}
                      banned={isBanned}
                      lastDrawn={lastNumber}
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

          {/* Cartela detail popup */}
          <AnimatePresence>
            {detailCartelaId !== null && (() => {
              const c = playerCartelas.find(x => x.id === detailCartelaId);
              if (!c) return null;
              const cellsMarked = markedMap.get(c.id) || new Set<string>();
              const isBanned = bannedCartelas.has(c.id) || c.banned_for_game;
              return (
                <CartelaDetailModal
                  open={true}
                  onClose={() => setDetailCartelaId(null)}
                  cartelaId={c.id}
                  numbers={c.numbers as number[][]}
                  phone={phone}
                  drawnNumbers={drawnSet}
                  markedCells={cellsMarked}
                  lastDrawn={lastNumber}
                  onMarkCell={isSpectator || isBanned ? undefined : (row, col) => handleMarkCell(c.id, row, col)}
                />
              );
            })()}
          </AnimatePresence>
        </div>
      )}

      {/* Public cartela modal — visible to all players */}
      <AnimatePresence>
        {publicModal && (
          <PublicCartelaModal
            cartelaId={publicModal.id}
            status={publicModal.status}
            drawnNumbers={drawnSet}
            onClose={() => setPublicModal(null)}
          />
        )}
      </AnimatePresence>
      {/* Pattern help modal */}
      <AnimatePresence>
        {showPatternHelp && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-background/85 backdrop-blur-sm p-4"
            onClick={() => setShowPatternHelp(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-foreground text-lg">How to win</h3>
                <button onClick={() => setShowPatternHelp(false)} className="p-1.5 rounded-lg bg-muted text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-center space-y-2">
                <div className="text-xs text-muted-foreground">Winning pattern this round</div>
                <div className="font-display font-bold text-primary text-xl">{gamePattern}</div>
                <div className="flex justify-center py-2">
                  <div className="grid grid-cols-5 gap-1 p-3 rounded-xl bg-muted/40 border border-border">
                    {getPatternCells(gamePattern).flat().map((on, i) => (
                      <div
                        key={i}
                        className={cn(
                          'w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-bold',
                          on ? 'bg-primary text-primary-foreground shadow' : 'bg-card text-muted-foreground border border-border'
                        )}
                      >
                        {i === 12 ? 'F' : ''}
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mark the highlighted cells on your cartela to win.
                </p>
              </div>

              <div className="space-y-2 text-sm text-foreground">
                <p className="font-bold">How to play</p>
                <ol className="list-decimal pl-5 space-y-1 text-xs text-muted-foreground">
                  <li>Buy one or more cartelas during the buying phase.</li>
                  <li>When numbers are called, tap the matching cells on your cartela to mark them.</li>
                  <li>The center <span className="font-bold text-foreground">F</span> cell is free.</li>
                  <li>When your marked cells match the pattern above, tap <span className="font-bold text-primary">BINGO!</span></li>
                </ol>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </PullToRefresh>
    </div>
  );
}
