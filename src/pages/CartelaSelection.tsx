import { useState, useEffect, useMemo, useRef } from 'react';
import PageShell from '@/components/PageShell';
import BingoCartela from '@/components/BingoCartela';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/lib/auth';
import { Search, Heart, X, ShoppingCart } from 'lucide-react';

interface Cartela {
  id: string;
  numbers: number[][];
  is_used: boolean;
  is_favorite: boolean;
}

export default function CartelaSelection() {
  const [cartelas, setCartelas] = useState<Cartela[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);
  const [buying, setBuying] = useState(false);
  const pageSize = 20;
  const navigate = useNavigate();
  const user = useUser();
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchCartelas() {
      const { data, error } = await supabase
        .from('cartelas')
        .select('*')
        .eq('is_used', false)
        .order('id', { ascending: true });

      if (error) {
        toast.error('Failed to fetch cartelas');
        return;
      }

      const list = (data || []) as unknown as Cartela[];
      setCartelas(list);
      const favs = new Set(list.filter(c => c.is_favorite).map(c => c.id));
      setFavorites(favs);
    }
    fetchCartelas();
  }, []);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visible.length < filtered.length) {
          setPage((p) => p + 1);
        }
      },
      { threshold: 0.1 }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, []);

  const filtered = useMemo(() => {
    let list = cartelas;
    if (showFavoritesOnly) list = list.filter(c => favorites.has(c.id));
    if (search.trim()) list = list.filter(c => String(c.id).includes(search.trim()));
    return list;
  }, [cartelas, search, showFavoritesOnly, favorites]);

  const visible = useMemo(() => filtered.slice(0, page * pageSize), [filtered, page]);

  const toggleFavorite = async (id: string) => {
    const isFav = favorites.has(id);
    setFavorites((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(id) : next.add(id);
      return next;
    });
    await supabase.from('cartelas').update({ is_favorite: !isFav } as any).eq('id', Number(id));
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const removeSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleBuy = async () => {
    if (!user?.id) { toast.error('Login required!'); return; }
    if (selected.size === 0) { toast.error('Select at least one cartela!'); return; }

    setBuying(true);

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleData) {
      toast.error('Admins cannot purchase cartelas!');
      setBuying(false);
      setShowConfirm(false);
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
    const balance = (profile as any)?.balance || 0;
    const cost = selected.size * 20;

    if (balance < cost) {
      toast.error(`Need ${cost} ETB, have ${balance} ETB`);
      setBuying(false);
      setShowConfirm(false);
      return;
    }

    const { error } = await supabase
      .from('cartelas')
      .update({ is_used: true, owner_id: user.id } as any)
      .in('id', Array.from(selected).map(Number));

    if (error) { toast.error('Purchase failed'); setBuying(false); setShowConfirm(false); return; }

    await supabase.from('profiles').update({ balance: balance - cost } as any).eq('id', user.id);
    setCartelas((prev) => prev.filter((c) => !selected.has(c.id)));
    setSelected(new Set());
    setShowConfirm(false);
    setBuying(false);
    toast.success('Cartelas purchased! 🎉');
    navigate('/game');
  };

  const cost = selected.size * 20;

  return (
    <PageShell title="Choose Cartela">
      {/* Search & filter */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by number..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`px-3 rounded-xl flex items-center gap-1 text-xs font-medium transition-colors ${
            showFavoritesOnly ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'
          }`}
        >
          <Heart className="w-3.5 h-3.5" />
          Favs
        </button>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        {filtered.length} available · 20 ETB each · Tap to select
      </p>

      {/* Selected cartelas strip */}
      {selected.size > 0 && (
        <div className="mb-3 p-2 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-foreground">{selected.size} selected</span>
            <button onClick={clearSelection} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              <X className="w-3 h-3" /> Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {Array.from(selected).map(id => (
              <span
                key={id}
                onClick={() => removeSelected(id)}
                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium cursor-pointer hover:bg-destructive/20 hover:text-destructive transition-colors"
              >
                #{id} <X className="w-2.5 h-2.5" />
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Cartela grid */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {visible.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.3) }}
          >
            <BingoCartela
              numbers={c.numbers}
              size="xs"
              label={`#${c.id}`}
              selected={selected.has(c.id)}
              onClick={() => toggleSelect(c.id)}
              isFavorite={favorites.has(c.id)}
              onFavorite={() => toggleFavorite(c.id)}
            />
          </motion.div>
        ))}
      </div>

      {/* Infinite scroll trigger */}
      <div ref={loaderRef} className="h-4" />

      {/* Fixed buy bar */}
      {selected.size > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-20 left-4 right-4 z-40"
        >
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full py-4 rounded-xl font-bold gradient-gold text-primary-foreground text-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <ShoppingCart className="w-5 h-5" />
            Buy {selected.size} Cartela{selected.size > 1 ? 's' : ''} — {cost} ETB
          </button>
        </motion.div>
      )}

      {/* Confirmation dialog */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            onClick={() => !buying && setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border-2 border-border rounded-2xl p-6 mx-4 max-w-sm w-full shadow-lg"
            >
              <h3 className="text-lg font-display font-bold text-foreground text-center mb-1">
                Confirm Purchase
              </h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Are you sure you want to buy {selected.size} cartela{selected.size > 1 ? 's' : ''}?
              </p>

              <div className="bg-muted/50 rounded-xl p-3 mb-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cartelas</span>
                  <span className="text-foreground font-medium">{selected.size}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Price each</span>
                  <span className="text-foreground font-medium">20 ETB</span>
                </div>
                <div className="border-t border-border my-1" />
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-foreground">Total</span>
                  <span className="text-primary">{cost} ETB</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-4 max-h-20 overflow-y-auto">
                {Array.from(selected).map(id => (
                  <span key={id} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    #{id}
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={buying}
                  className="flex-1 py-3 rounded-xl bg-muted text-muted-foreground font-medium text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBuy}
                  disabled={buying}
                  className="flex-1 py-3 rounded-xl gradient-gold text-primary-foreground font-bold text-sm active:scale-95 transition-transform disabled:opacity-50"
                >
                  {buying ? 'Buying...' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
