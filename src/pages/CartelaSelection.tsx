import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import PageShell from '@/components/PageShell';
import BingoCartela from '@/components/BingoCartela';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/lib/auth';
import { Search, Heart } from 'lucide-react';

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
      // Restore favorites
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

  const handleBuy = async () => {
    if (!user?.id) { toast.error('Login required!'); return; }
    if (selected.size === 0) { toast.error('Select at least one cartela!'); return; }

    // Check if admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleData) {
      toast.error('Admins cannot purchase cartelas!');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
    const balance = (profile as any)?.balance || 0;
    const cost = selected.size * 20;

    if (balance < cost) {
      toast.error(`Need ${cost} ETB, have ${balance} ETB`);
      return;
    }

    const { error } = await supabase
      .from('cartelas')
      .update({ is_used: true, owner_id: user.id } as any)
      .in('id', Array.from(selected).map(Number));

    if (error) { toast.error('Purchase failed'); return; }

    await supabase.from('profiles').update({ balance: balance - cost } as any).eq('id', user.id);
    setCartelas((prev) => prev.filter((c) => !selected.has(c.id)));
    setSelected(new Set());
    toast.success('Cartelas purchased! 🎉');
    navigate('/game');
  };

  return (
    <PageShell title="Choose Cartela">
      <div className="flex gap-2 mb-4">
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
            showFavoritesOnly ? 'bg-red-500/20 text-red-500' : 'bg-muted text-muted-foreground'
          }`}
        >
          <Heart className="w-3.5 h-3.5" />
          Favs
        </button>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        {filtered.length} available · 20 ETB each · Tap to select
      </p>

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

      {selected.size > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-20 left-4 right-4 z-40"
        >
          <button
            onClick={handleBuy}
            className="w-full py-4 rounded-xl font-bold gradient-gold text-primary-foreground text-lg active:scale-95 transition-transform"
          >
            Buy {selected.size} Cartela{selected.size > 1 ? 's' : ''} — {selected.size * 20} ETB
          </button>
        </motion.div>
      )}
    </PageShell>
  );
}
