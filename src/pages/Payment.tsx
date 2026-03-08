import { useState, useEffect } from 'react';
import PageShell from '@/components/PageShell';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/auth';

const banks = ['Commercial Bank of Ethiopia', 'Awash Bank', 'Dashen Bank', 'Bank of Abyssinia', 'Telebirr'];

export default function Payment() {
  const [bank, setBank] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [deposits, setDeposits] = useState<any[]>([]);
  const user = useUser();

  useEffect(() => {
    if (!user?.id) return;
    async function fetchDeposits() {
      const { data } = await supabase
        .from('deposits')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      setDeposits(data || []);
    }
    fetchDeposits();
  }, [user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bank || !amount || !reference) {
      toast.error('Please fill all fields');
      return;
    }
    if (!user?.id) {
      toast.error('You must be logged in');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('deposits')
      .insert({ user_id: user.id, bank, amount: parseFloat(amount), reference })
      .select()
      .single();
    setLoading(false);

    if (error) {
      toast.error('Failed to submit deposit');
      console.error(error);
      return;
    }

    setDeposits((prev) => [data, ...prev]);
    toast.success('Deposit request submitted! Waiting for approval.');
    setBank('');
    setAmount('');
    setReference('');
  };

  return (
    <PageShell title="Deposit">
      <motion.form
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Bank Name</label>
          <select
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            className="w-full p-3 rounded-xl bg-muted border border-border text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
          >
            <option value="">Select bank</option>
            {banks.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Amount (ETB)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 100"
            className="w-full p-3 rounded-xl bg-muted border border-border text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
          />
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Reference Number</label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Transaction reference"
            className="w-full p-3 rounded-xl bg-muted border border-border text-foreground text-sm focus:ring-2 focus:ring-primary outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-xl font-display font-bold gradient-gold text-primary-foreground text-lg active:scale-95 transition-transform disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit Deposit'}
        </button>
      </motion.form>

      <section className="mt-8">
        <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Deposits</h2>
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
