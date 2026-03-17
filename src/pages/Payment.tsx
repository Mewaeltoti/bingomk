import { useState, useEffect, useCallback } from 'react';
import PageShell from '@/components/PageShell';
import PullToRefresh from '@/components/PullToRefresh';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/auth';
import { ArrowDownCircle, ArrowUpCircle, ArrowLeft, Clock, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { t } from '@/lib/i18n';
import telebirrLogo from '@/assets/telebirr.webp';
import cbeBirrLogo from '@/assets/cbe-birr.jpg';

const banks = ['Commercial Bank of Ethiopia', 'Awash Bank', 'Dashen Bank', 'Bank of Abyssinia'];

const paymentMethods = [
  { name: 'Telebirr', logo: telebirrLogo, badgeClass: 'bg-primary/15 text-primary border border-primary/30', comingSoon: true },
  { name: 'CBE Birr', logo: cbeBirrLogo, badgeClass: 'bg-secondary/20 text-secondary-foreground border border-border', comingSoon: true },
];

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

  const inputClass = "w-full p-3.5 rounded-xl bg-muted text-foreground text-base focus:ring-2 focus:ring-primary outline-none";

  return (
    <PageShell title={t('wallet')}>
      <PullToRefresh onRefresh={loadData}>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 mb-4 px-4 py-3 rounded-xl bg-muted text-foreground text-sm font-medium active:scale-95 transition-transform w-full"
      >
        <ArrowLeft className="w-5 h-5" />
        {t('back')}
      </button>

      {/* Balance */}
      <div className="text-center mb-4 p-4 rounded-2xl gradient-card border border-border">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{t('balance')}</div>
        <div className="text-3xl font-display font-bold text-primary">{balance} ETB</div>
      </div>

      {/* Payment Methods - Coming Soon */}
      <div className="mb-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {paymentMethods.map(pm => (
            <div key={pm.name} className="relative p-4 rounded-xl bg-muted/50 border border-border flex flex-col items-center gap-2 opacity-80">
              <div className={cn('w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm', pm.badgeClass)}>
                {pm.name === 'Telebirr' ? 'TB' : 'CBE'}
              </div>
              <span className="text-xs font-medium text-foreground">{pm.name}</span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="w-3 h-3" /> {t('comingSoon')}
              </span>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Support on Telegram: <span className="font-semibold text-foreground">+251978187178</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('deposit')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-colors active:scale-95',
            tab === 'deposit' ? 'gradient-neon text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}
        >
          <ArrowDownCircle className="w-4 h-4" /> {t('deposit')}
        </button>
        <button
          onClick={() => setTab('withdraw')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-colors active:scale-95',
            tab === 'withdraw' ? 'gradient-neon text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}
        >
          <ArrowUpCircle className="w-4 h-4" /> {t('withdraw')}
        </button>
      </div>

      {tab === 'deposit' && (
        <>
          <motion.form initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onSubmit={handleDeposit} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('bankName')}</label>
              <select value={bank} onChange={(e) => setBank(e.target.value)} className={inputClass}>
                <option value="">{t('selectBank')}</option>
                {banks.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('amount')} (ETB)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 100" className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('reference')}</label>
              <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction reference" className={inputClass} />
            </div>
            <button type="submit" disabled={loading} className="w-full py-4 rounded-xl font-display font-bold gradient-neon text-primary-foreground text-base active:scale-95 transition-transform disabled:opacity-50">
              {loading ? '...' : t('submitDeposit')}
            </button>
          </motion.form>

          <section className="mt-6">
            <h2 className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('recentDeposits')}</h2>
            <div className="space-y-1.5">
              {deposits.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div>
                    <div className="text-sm font-medium text-foreground">{d.bank} — {d.amount} ETB</div>
                    <div className="text-xs text-muted-foreground">Ref: {d.reference}</div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    d.status === 'approved' ? 'bg-primary/20 text-primary' :
                    d.status === 'pending' ? 'bg-accent/20 text-accent' :
                    'bg-destructive/20 text-destructive'
                  }`}>{d.status}</span>
                </div>
              ))}
              {deposits.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">{t('noDeposits')}</p>}
            </div>
          </section>
        </>
      )}

      {tab === 'withdraw' && (
        <>
          <motion.form initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onSubmit={handleWithdraw} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('bankName')}</label>
              <select value={bank} onChange={(e) => setBank(e.target.value)} className={inputClass}>
                <option value="">{t('selectBank')}</option>
                {banks.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('accountNumber')}</label>
              <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Your account number" className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('amount')} (ETB)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 50" className={inputClass} />
              <p className="text-xs text-muted-foreground mt-1">{t('available')}: {balance} ETB</p>
            </div>
            <button type="submit" disabled={loading} className="w-full py-4 rounded-xl font-display font-bold gradient-neon text-primary-foreground text-base active:scale-95 transition-transform disabled:opacity-50">
              {loading ? '...' : t('requestWithdraw')}
            </button>
          </motion.form>

          <section className="mt-6">
            <h2 className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('recentWithdrawals')}</h2>
            <div className="space-y-1.5">
              {withdrawals.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div>
                    <div className="text-sm font-medium text-foreground">{w.bank} — {w.amount} ETB</div>
                    <div className="text-xs text-muted-foreground">Acct: {w.account_number}</div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    w.status === 'approved' ? 'bg-primary/20 text-primary' :
                    w.status === 'pending' ? 'bg-accent/20 text-accent' :
                    'bg-destructive/20 text-destructive'
                  }`}>{w.status}</span>
                </div>
              ))}
              {withdrawals.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">{t('noWithdrawals')}</p>}
            </div>
          </section>
        </>
      )}
      </PullToRefresh>
    </PageShell>
  );
}
