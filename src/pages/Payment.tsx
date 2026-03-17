import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/auth';
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, Clock, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const banks = ['Commercial Bank of Ethiopia', 'Awash Bank', 'Dashen Bank', 'Bank of Abyssinia'];
const popularAmounts = [50, 100, 200, 500];
const quickWithdraw = [100, 500, 1000, 2000];

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
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    const [profileRes, depositsRes, withdrawalsRes] = await Promise.all([
      supabase.from('profiles').select('balance').eq('id', user.id).single(),
      supabase.from('deposits').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      (supabase.from('withdrawals' as any) as any).select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);
    if (profileRes.data) setBalance((profileRes.data as any).balance || 0);
    setDeposits(depositsRes.data || []);
    setWithdrawals(withdrawalsRes.data || []);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bank || !amount || !reference || !user?.id) { toast.error('Please fill all fields'); return; }
    setLoading(true);
    const { data, error } = await supabase.from('deposits')
      .insert({ user_id: user.id, bank, amount: parseFloat(amount), reference }).select().single();
    setLoading(false);
    if (error) { toast.error('Failed to submit deposit'); return; }
    setDeposits(prev => [data, ...prev]);
    toast.success('Deposit request submitted!');
    setBank(''); setAmount(''); setReference('');
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bank || !amount || !accountNumber || !user?.id) { toast.error('Please fill all fields'); return; }
    const withdrawAmount = parseFloat(amount);
    if (withdrawAmount <= 0) { toast.error('Invalid amount'); return; }
    if (withdrawAmount > balance) { toast.error('Insufficient balance'); return; }
    setLoading(true);
    const { data, error } = await (supabase.from('withdrawals' as any) as any)
      .insert({ user_id: user.id, bank, amount: withdrawAmount, account_number: accountNumber }).select().single();
    setLoading(false);
    if (error) { toast.error('Failed to submit withdrawal'); return; }
    setWithdrawals((prev: any[]) => [data, ...prev]);
    toast.success('Withdrawal request submitted!');
    setBank(''); setAmount(''); setAccountNumber('');
  };

  return (
    <div className="min-h-screen bg-background safe-top">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center active:scale-95">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground flex-1">
          {tab === 'deposit' ? 'Deposit' : 'Withdraw Funds'}
        </h1>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* Balance card */}
        <div className="text-center py-6 rounded-2xl bg-card border border-border">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <Wallet className="w-7 h-7 text-primary" />
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Available Balance</div>
          <div className="text-3xl font-bold text-foreground mt-1">ETB {balance.toLocaleString()}</div>
        </div>

        {/* Payment methods - coming soon */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: 'Telebirr', abbr: 'Tb', color: 'bg-primary' },
            { name: 'CBE Birr', abbr: 'C', color: 'bg-blue-600' },
          ].map(pm => (
            <div key={pm.name} className="p-4 rounded-xl bg-card border border-border flex items-center gap-3 opacity-60">
              <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm', pm.color)}>
                {pm.abbr}
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">{pm.name}</div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Coming Soon</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button onClick={() => setTab('deposit')}
            className={cn('flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-colors active:scale-95',
              tab === 'deposit' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
            <ArrowDownCircle className="w-4 h-4" /> Deposit
          </button>
          <button onClick={() => setTab('withdraw')}
            className={cn('flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-colors active:scale-95',
              tab === 'withdraw' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
            <ArrowUpCircle className="w-4 h-4" /> Withdraw
          </button>
        </div>

        {tab === 'deposit' && (
          <form onSubmit={handleDeposit} className="space-y-4">
            {/* Popular amounts */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Popular amounts</label>
              <div className="grid grid-cols-2 gap-2">
                {popularAmounts.map(a => (
                  <button key={a} type="button" onClick={() => setAmount(String(a))}
                    className={cn('py-3.5 rounded-xl text-sm font-bold transition-colors',
                      amount === String(a) ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground border border-border')}>
                    {a} <span className="text-xs font-normal">ETB</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Or enter custom amount</label>
              <div className="flex items-center gap-2 p-3.5 rounded-xl bg-muted border border-border">
                <span className="text-muted-foreground text-sm font-medium">ETB</span>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00" className="flex-1 bg-transparent text-foreground text-base outline-none" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Bank</label>
              <select value={bank} onChange={(e) => setBank(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary border border-border">
                <option value="">Select bank</option>
                {banks.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Transaction Reference</label>
              <input type="text" value={reference} onChange={(e) => setReference(e.target.value)}
                placeholder="Enter reference" className="w-full p-3.5 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary border border-border" />
            </div>
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-2">
              <span className="text-primary mt-0.5">ℹ️</span>
              <span className="text-xs text-muted-foreground">Min deposit is 10 ETB. Funds will be available in your Bingo balance instantly after confirmation.</span>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-4 rounded-xl font-bold text-base bg-primary text-primary-foreground active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? '...' : 'Next →'}
            </button>
          </form>
        )}

        {tab === 'withdraw' && (
          <form onSubmit={handleWithdraw} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Amount to Withdraw</label>
              <div className="flex items-center gap-2 p-3.5 rounded-xl bg-muted border border-border">
                <span className="text-muted-foreground text-sm font-medium">ETB</span>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00" className="flex-1 bg-transparent text-foreground text-base outline-none" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Quick Selection</label>
              <div className="grid grid-cols-2 gap-2">
                {quickWithdraw.map(a => (
                  <button key={a} type="button" onClick={() => setAmount(prev => String((Number(prev) || 0) + a))}
                    className="py-3 rounded-xl text-sm font-bold bg-muted text-foreground border border-border active:scale-95">
                    + {a.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Bank</label>
              <select value={bank} onChange={(e) => setBank(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary border border-border">
                <option value="">Select bank</option>
                {banks.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Account Number</label>
              <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Your account number" className="w-full p-3.5 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary border border-border" />
            </div>
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-2">
              <span className="text-primary mt-0.5">ℹ️</span>
              <span className="text-xs text-muted-foreground">Minimum withdrawal amount is <strong>ETB 50.00</strong>. Transfers are usually processed within 24 hours to your linked bank account or mobile wallet.</span>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-4 rounded-xl font-bold text-base bg-primary text-primary-foreground active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? '...' : 'Next →'}
            </button>
          </form>
        )}

        {/* History */}
        <section>
          <h2 className="text-sm font-bold text-foreground mb-2">{tab === 'deposit' ? 'Recent Deposits' : 'Recent Withdrawals'}</h2>
          <div className="space-y-1.5">
            {(tab === 'deposit' ? deposits : withdrawals).map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border">
                <div>
                  <div className="text-sm font-medium text-foreground">{item.bank} — {item.amount} ETB</div>
                  <div className="text-xs text-muted-foreground">{tab === 'deposit' ? `Ref: ${item.reference}` : `Acct: ${item.account_number}`}</div>
                </div>
                <span className={cn('text-xs font-semibold px-2 py-1 rounded-full',
                  item.status === 'approved' ? 'bg-primary/15 text-primary' :
                  item.status === 'pending' ? 'bg-accent/15 text-accent' : 'bg-destructive/15 text-destructive'
                )}>{item.status}</span>
              </div>
            ))}
            {(tab === 'deposit' ? deposits : withdrawals).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No transactions yet</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
