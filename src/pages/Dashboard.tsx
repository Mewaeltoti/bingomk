import { Wallet, ShoppingCart, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageShell from '@/components/PageShell';
import BingoCartela from '@/components/BingoCartela';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/auth';

export default function Dashboard() {
  const user = useUser();
  const [balance, setBalance] = useState(0);
  const [myCartelas, setMyCartelas] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    async function load() {
      const [profileRes, cartelasRes, depositsRes] = await Promise.all([
        supabase.from('profiles').select('balance').eq('id', user!.id).single(),
        supabase.from('cartelas').select('*').eq('owner_id', user!.id).order('id', { ascending: true }),
        supabase.from('deposits').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(10),
      ]);
      setBalance((profileRes.data as any)?.balance || 0);
      setMyCartelas(cartelasRes.data || []);
      setDeposits(depositsRes.data || []);
    }
    load();
  }, [user?.id]);

  return (
    <PageShell title="My Wallet">
      {/* Balance */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="gradient-card rounded-2xl border border-border p-5 mb-6 glow-gold"
      >
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
          <Wallet className="w-4 h-4" /> Balance
        </div>
        <div className="font-display text-3xl font-bold text-primary">{balance.toFixed(2)} ETB</div>
        <div className="mt-3 flex gap-2">
          <Link
            to="/payment"
            className="flex-1 py-2 rounded-lg gradient-gold text-primary-foreground text-center text-sm font-semibold"
          >
            Deposit
          </Link>
          <Link
            to="/cartelas"
            className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-center text-sm font-semibold"
          >
            Buy Cartela
          </Link>
        </div>
      </motion.div>

      {/* Purchased Cartelas */}
      <section className="mb-6">
        <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" /> My Cartelas ({myCartelas.length})
        </h2>
        {myCartelas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No cartelas yet. Buy some to play!</p>
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
        <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <History className="w-4 h-4" /> Recent Deposits
        </h2>
        <div className="space-y-2">
          {deposits.map((d) => (
            <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
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
          ))}
          {deposits.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No deposits yet</p>
          )}
        </div>
      </section>
    </PageShell>
  );
}
