import { useState, useEffect } from 'react';
import PageShell from '@/components/PageShell';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/auth';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

const banks = ['Commercial Bank of Ethiopia', 'Awash Bank', 'Dashen Bank', 'Bank of Abyssinia', 'Telebirr'];

export default function Payment() {
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [bank, setBank] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const user = useUser();

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('balance').eq('id', user.id).single()
      .then(({ data }) => { if (data) setBalance((data as any).balance || 0); });
    supabase.from('deposits').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => setDeposits(data || []));
    supabase.from('withdrawals' as any).select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }: any) => setWithdrawals(data || []));
  }, [user?.id]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bank || !amount || !reference || !user?.id) {
      toast.error('Please fill all fields');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('deposits')
      .insert({ user_id: user.id, bank, amount: parseFloat(amount), reference })
      .select().single();
    setLoading(false);
    if (error) { toast.error('Failed to submit deposit'); return; }
    setDeposits((prev) => [data, ...prev]);
    toast.success('Deposit request submitted!');
    setBank(''); setAmount(''); setReference('');
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bank || !amount || !accountNumber || !user?.id) {
      toast.error('Please fill all fields');
      return;
    }
    const withdrawAmount = parseFloat(amount);
    if (withdrawAmount <= 0) { toast.error('Invalid amount'); return; }
    if (withdrawAmount > balance) { toast.error('Insufficient balance'); return; }

    setLoading(true);
    const { data, error } = await (supabase.from('withdrawals' as any) as any)
      .insert({ user_id: user.id, bank, amount: withdrawAmount, account_number: accountNumber })
      .select().single();
    setLoading(false);
    if (error) { toast.error('Failed to submit withdrawal'); console.error(error); return; }
    setWithdrawals((prev: any[]) => [data, ...prev]);
    toast.success('Withdrawal request submitted!');
    setBank(''); setAmount(''); setAccountNumber('');
  };

  const inputClass = "w-full p-3 rounded-xl bg-muted border border-border text-foreground text-sm focus:ring-2 focus:ring-primary outline-none";

  return (
    <PageShell title="Wallet">
      {/* Balance */}
      <div className="text-center mb-4 p-4 rounded-xl bg-card border border-border">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">Your Balance</div>
        <div className="text-3xl font-display font-bold text-primary">{balance} ETB</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('deposit')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            tab === 'deposit' ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          <ArrowDownCircle className="w-4 h-4" /> Deposit
        </button>
        <button
          onClick={() => setTab('withdraw')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            tab === 'withdraw' ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          <ArrowUpCircle className="w-4 h-4" /> Withdraw
        </button>
      </div>

      {tab === 'deposit' && (
        <>
          <motion.form initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onSubmit={handleDeposit} className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Bank Name</label>
              <select value={bank} onChange={(e) => setBank(e.target.value)} className={inputClass}>
                <option value="">Select bank</option>
                {banks.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Amount (ETB)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 100" className={inputClass} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Reference Number</label>
              <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction reference" className={inputClass} />
            </div>
            <button type="submit" disabled={loading} className="w-full py-4 rounded-xl font-display font-bold gradient-gold text-primary-foreground text-lg active:scale-95 transition-transform disabled:opacity-50">
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
                  }`}>{d.status}</span>
                </div>
              ))}
              {deposits.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No deposits yet</p>}
            </div>
          </section>
        </>
      )}

      {tab === 'withdraw' && (
        <>
          <motion.form initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onSubmit={handleWithdraw} className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Bank / Service</label>
              <select value={bank} onChange={(e) => setBank(e.target.value)} className={inputClass}>
                <option value="">Select bank</option>
                {banks.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Account Number</label>
              <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Your account number" className={inputClass} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Amount (ETB)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 50" className={inputClass} />
              <p className="text-xs text-muted-foreground mt-1">Available: {balance} ETB</p>
            </div>
            <button type="submit" disabled={loading} className="w-full py-4 rounded-xl font-display font-bold gradient-gold text-primary-foreground text-lg active:scale-95 transition-transform disabled:opacity-50">
              {loading ? 'Submitting...' : 'Request Withdrawal'}
            </button>
          </motion.form>

          <section className="mt-8">
            <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Withdrawals</h2>
            <div className="space-y-2">
              {withdrawals.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <div className="text-sm font-medium text-foreground">{w.bank} — {w.amount} ETB</div>
                    <div className="text-xs text-muted-foreground">Acct: {w.account_number}</div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    w.status === 'approved' ? 'bg-secondary/20 text-secondary' :
                    w.status === 'pending' ? 'bg-primary/20 text-primary' :
                    'bg-destructive/20 text-destructive'
                  }`}>{w.status}</span>
                </div>
              ))}
              {withdrawals.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No withdrawals yet</p>}
            </div>
          </section>
        </>
      )}
    </PageShell>
  );
}
