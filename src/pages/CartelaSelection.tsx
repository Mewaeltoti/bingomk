import { useState, useEffect } from 'react';
import PageShell from '@/components/PageShell';
import BingoCartela from '@/components/BingoCartela';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/lib/auth';

interface Cartela {
  id: string;
  numbers: number[][];
  is_used: boolean;
}

export default function CartelaSelection() {
  const [cartelas, setCartelas] = useState<Cartela[]>([]);
  const [visibleCartelas, setVisibleCartelas] = useState<Cartela[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const navigate = useNavigate();
  const user = useUser();

  useEffect(() => {
    async function fetchCartelas() {
      const { data, error } = await supabase
        .from('cartelas')
        .select('*')
        .eq('is_used', false)
        .order('id', { ascending: true });

      if (error) {
        toast.error('Failed to fetch cartelas');
        console.error(error);
        return;
      }

      setCartelas((data || []) as unknown as Cartela[]);
    }
    fetchCartelas();
  }, []);

  useEffect(() => {
    const start = (page - 1) * pageSize;
    const end = page * pageSize;
    const nextBatch = cartelas.slice(start, end);
    setVisibleCartelas((prev) => [...prev, ...nextBatch]);
  }, [page, cartelas]);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBuy = async () => {
    if (!user?.id) {
      toast.error('You must be logged in!');
      return;
    }
    if (selected.size === 0) {
      toast.error('Select at least one cartela!');
      return;
    }

    const { error } = await supabase
      .from('cartelas')
      .update({ is_used: true, owner_id: user.id } as any)
      .in('id', Array.from(selected).map(Number));

    if (error) {
      toast.error('Failed to purchase cartelas');
      console.error(error);
      return;
    }

    setVisibleCartelas((prev) => prev.filter((c) => !selected.has(c.id)));
    setSelected(new Set());
    toast.success('Cartelas purchased!');
    navigate('/game');
  };

  const hasMore = visibleCartelas.length < cartelas.length;

  return (
    <PageShell title="Choose Cartela">
      <p className="text-sm text-muted-foreground mb-4">
        Select your favorite cartelas and buy them (20 ETB each)
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {visibleCartelas.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            <BingoCartela
              numbers={c.numbers}
              size="sm"
              label={`#${c.id}`}
              selected={selected.has(c.id)}
              onClick={() => toggleSelect(c.id)}
              isFavorite={favorites.has(c.id)}
              onFavorite={() => toggleFavorite(c.id)}
            />
          </motion.div>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center mb-6">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="px-5 py-2 rounded-lg bg-primary text-primary-foreground"
          >
            Load More
          </button>
        </div>
      )}

      {selected.size > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-20 left-4 right-4 z-40"
        >
          <button
            onClick={handleBuy}
            className="w-full py-4 rounded-xl font-bold gradient-gold text-primary-foreground text-lg"
          >
            Buy Selected Cartelas — {selected.size * 20} ETB
          </button>
        </motion.div>
      )}
    </PageShell>
  );
}
