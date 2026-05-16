import { useState, useEffect, useCallback } from 'react';
import PageShell from '@/components/PageShell';
import BingoCartela from '@/components/BingoCartela';
import PullToRefresh from '@/components/PullToRefresh';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { invokeWithRetry } from '@/lib/edgeFn';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useUser } from '@/lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet } from 'lucide-react';
import { t } from '@/lib/i18n';

export default function Cards() {
  const user = useUser();
  const navigate = useNavigate();
  const [myCards, setMyCards] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [availableCards, setAvailableCards] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [cartelaPrice, setCartelaPrice] = useState(10);
  const [gameStatus, setGameStatus] = useState<string>('waiting');
  const [buying, setBuying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    const [myCardsRes, availableRes, gameRes, profileRes] = await Promise.all([
      supabase.from('cartelas').select('*').eq('owner_id', user.id).eq('is_used', true).order('id', { ascending: true }),
      supabase.from('cartelas').select('*').eq('is_used', false).eq('banned_for_game', false).limit(50),
      supabase.from('games').select('cartela_price, status').eq('id', 'current').maybeSingle(),
      supabase.from('profiles').select('balance').eq('id', user.id).single(),
    ]);

    if (myCardsRes.data) setMyCards(myCardsRes.data);
    if (availableRes.data) setAvailableCards(availableRes.data);
    if (gameRes.data) {
      setCartelaPrice((gameRes.data as any).cartela_price || 10);
      setGameStatus((gameRes.data as any).status || 'waiting');
    }
    if (profileRes.data) setBalance((profileRes.data as any).balance || 0);
  }, [user?.id]);

  useEffect(() => {
    loadData();

    if (!user?.id) return;
    const channel = supabase
      .channel('cards-realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`,
      }, (payload: any) => {
        setBalance(payload.new.balance || 0);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'games',
        filter: 'id=eq.current',
      }, (payload: any) => {
        setGameStatus(payload.new?.status || 'waiting');
        setCartelaPrice(payload.new?.cartela_price || 10);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadData]);

  const addRandomCartela = async () => {
    const existingIds = cart.map(c => c.id);
    let filtered = availableCards.filter(c => !existingIds.includes(c.id));
    if (filtered.length === 0) {
      toast.info('No more cartelas available');
      return;
    }
    const random = filtered[Math.floor(Math.random() * filtered.length)];
    setCart([...cart, random]);
  };

  const removeFromCart = (id: number) => {
    setCart(cart.filter(c => c.id !== id));
  };

  const handleBuy = async () => {
    if (!user?.id || cart.length === 0) return;
    setBuying(true);
    const { data, error } = await invokeWithRetry('purchase-cartela', {
      body: { cartela_ids: cart.map(c => c.id) },
    });
    if (error || data?.error) {
      const msg = data?.error || t('purchaseFailed');
      if (msg.toLowerCase().includes('insufficient')) {
        setBuying(false);
        setShowConfirm(false);
        navigate('/payment');
        return;
      }
      toast.error(msg);
      setBuying(false);
      return;
    }
    setCart([]);
    setBuying(false);
    setShowConfirm(false);
    toast.success(t('purchased'));
    loadData();
  };

  const cost = cart.length * cartelaPrice;
  const canBuy = (gameStatus === 'buying' || gameStatus === 'waiting');

  return (
    <PageShell title="My Cards">
      <PullToRefresh onRefresh={loadData}>
        {/* Header with balance and buy button */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-card border border-border/50"
        >
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Owned ({myCards.length})</p>
          </div>
          <button
            onClick={() => canBuy && setShowConfirm(true)}
            disabled={!canBuy || cart.length === 0}
            className="px-6 py-3 rounded-xl gradient-neon text-primary-foreground font-display font-bold text-sm active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Buy Cards
          </button>
        </motion.div>

        {/* Balance card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 flex items-center gap-3"
        >
          <span className="text-2xl">💚</span>
          <div>
            <p className="text-xs text-muted-foreground">Balance:</p>
            <p className="font-display font-bold text-lg text-primary">{balance.toFixed(2)} ETB</p>
          </div>
        </motion.div>

        {/* My cards section */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="space-y-3">
            {myCards.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No cards yet. Add some from below!</p>
              </div>
            ) : (
              myCards.map((card, idx) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-4 rounded-xl bg-card border border-border/50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <p className="font-display font-bold text-foreground">Card #{card.id}</p>
                    <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">{cartelaPrice} ETB</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {['B', 'I', 'N', 'G', 'O'].map((letter, col) => (
                      <div key={col} className="text-center">
                        <p className="text-[10px] text-muted-foreground font-bold mb-1">{letter}</p>
                        <div className="grid grid-cols-1 gap-1">
                          {Array.from({ length: 5 }).map((_, row) => (
                            <div
                              key={row}
                              className="w-full aspect-square flex items-center justify-center rounded text-[10px] font-bold text-foreground bg-muted/30 border border-muted"
                            >
                              {card.numbers?.[row]?.[col] || '-'}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Available cards section */}
        {canBuy && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className="font-display text-sm font-bold text-foreground mb-3 uppercase tracking-wider">Buy More Cards</h3>
            <div className="space-y-2">
              {availableCards.slice(0, 5).map((card) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-3 rounded-lg bg-card border border-border/50 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    if (!cart.find(c => c.id === card.id)) {
                      setCart([...cart, card]);
                    }
                  }}
                >
                  <p className="text-sm font-medium text-foreground">Card #{card.id}</p>
                  <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold">{cartelaPrice} ETB</span>
                </motion.div>
              ))}
              <button
                onClick={addRandomCartela}
                className="w-full mt-3 py-3 rounded-lg bg-primary/10 text-primary font-bold text-sm border border-primary/30 active:scale-95 transition-transform"
              >
                Add Random Card
              </button>
            </div>
          </motion.div>
        )}

        {!canBuy && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-center">
            <p className="text-sm font-bold text-destructive">Game in progress</p>
            <p className="text-[10px] text-muted-foreground mt-1">You can buy cards when the game is in buying phase</p>
          </div>
        )}
      </PullToRefresh>

      {/* Cart modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-xl p-4 max-w-sm w-full max-h-[70vh] overflow-y-auto space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-foreground text-lg">Order Summary</h3>
                <button onClick={() => setShowConfirm(false)} className="p-1 rounded-lg bg-muted text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

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

              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{cart.length} card(s)</span>
                  <span className="font-display font-bold text-primary">{cost} ETB</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBuy}
                  disabled={buying}
                  className="flex-1 py-3 rounded-xl gradient-neon text-primary-foreground font-bold text-sm disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
                >
                  <Wallet className="w-4 h-4" />
                  {buying ? 'Processing...' : `Pay ${cost} ETB`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
