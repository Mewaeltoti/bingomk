import { Wallet, ShoppingCart, History, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageShell from '@/components/PageShell';
import BingoCartela from '@/components/BingoCartela';
import PullToRefresh from '@/components/PullToRefresh';
import { Button } from '@/components/ui/button';
import { BalanceSkeleton, CartelaSkeleton } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/auth';

export default function Dashboard() {
  const user = useUser();
  const [balance, setBalance] = useState(0);
  const [myCartelas, setMyCartelas] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [profileRes, cartelasRes, depositsRes] = await Promise.all([
        supabase.from('profiles').select('balance').eq('id', user.id).single(),
        supabase.from('cartelas').select('*').eq('owner_id', user.id).order('id', { ascending: true }),
        supabase.from('deposits').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      ]);
      setBalance((profileRes.data as any)?.balance || 0);
      setMyCartelas(cartelasRes.data || []);
      setDeposits(depositsRes.data || []);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime: balance changes, cartela ownership changes, deposit status changes
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles',
        filter: `id=eq.${user.id}`,
      }, (payload: any) => {
        if (payload.new?.balance !== undefined) setBalance(payload.new.balance);
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'cartelas',
        filter: `owner_id=eq.${user.id}`,
      }, () => {
        supabase.from('cartelas').select('*').eq('owner_id', user!.id).order('id', { ascending: true })
          .then(({ data }) => setMyCartelas(data || []));
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'deposits',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        supabase.from('deposits').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(10)
          .then(({ data }) => setDeposits(data || []));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  return (
    <PageShell title="My Wallet">
      <PullToRefresh onRefresh={loadData}>
      {/* Balance */}
      {loading ? (
        <BalanceSkeleton />
      ) : (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="gradient-card rounded-2xl p-5 mb-4 glow-gold"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Wallet className="w-4 h-4" /> Balance
          </div>
          <div className="font-display text-3xl font-bold text-primary">{balance.toFixed(2)} ETB</div>
          <div className="mt-3 flex gap-2">
            <Button variant="gold" className="flex-1" asChild>
              <Link to="/payment">Deposit</Link>
            </Button>
            <Button variant="secondary" className="flex-1" asChild>
              <Link to="/cartelas">Buy Cartela</Link>
            </Button>
          </div>
        </motion.div>
      )}

      {/* Purchased Cartelas */}
      <section className="mb-4">
        <h2 className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
          <ShoppingCart className="w-3.5 h-3.5" /> My Cartelas ({loading ? '...' : myCartelas.length})
        </h2>
        {loading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <CartelaSkeleton key={i} />
            ))}
          </div>
        ) : myCartelas.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <CreditCard className="w-8 h-8" />
            </div>
            <p className="empty-state-title">No cartelas yet</p>
            <p className="empty-state-text">Purchase a cartela to join a game and start winning!</p>
            <Button variant="neon" size="sm" className="mt-4" asChild>
              <Link to="/cartelas">Browse Cartelas</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {myCartelas.map((c) => (
              <BingoCartela key={c.id} numbers={c.numbers as number[][]} size="xs" label={`#${c.id}`} />
            ))}
          </div>
        )}
      </section>

      {/* Transactions */}
      <section>
        <h2 className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
          <History className="w-3.5 h-3.5" /> Recent Deposits
        </h2>
        <div className="space-y-1.5">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))
          ) : deposits.length === 0 ? (
            <div className="empty-state py-8">
              <div className="empty-state-icon">
                <History className="w-8 h-8" />
              </div>
              <p className="empty-state-title">No deposits yet</p>
              <p className="empty-state-text">Add funds to your wallet to start playing.</p>
            </div>
          ) : (
            deposits.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <div>
                  <div className="text-sm font-medium text-foreground">{d.bank} — {d.amount} ETB</div>
                  <div className="text-xs text-muted-foreground">Ref: {d.reference}</div>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  d.status === 'approved' ? 'bg-secondary/20 text-secondary' :
                  d.status === 'pending' ? 'bg-primary/20 text-primary' :
                  'bg-destructive/20 text-destructive'
                }`}>
                  {d.status}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
      </PullToRefresh>
    </PageShell>
  );
}
