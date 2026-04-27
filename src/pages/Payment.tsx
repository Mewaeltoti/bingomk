import { useState, useEffect, useCallback } from 'react';
import PageShell from '@/components/PageShell';
import PullToRefresh from '@/components/PullToRefresh';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/auth';
import { ArrowDownCircle, ArrowUpCircle, ArrowLeft, Wallet, DollarSign, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { t } from '@/lib/i18n';

const DEPOSIT_ACCOUNTS = [
  { method: 'Telebirr', number: '0978187178', name: 'Ephrem' },
  { method: 'CBE', number: '1000217643426', name: 'Ephrem' },
];

const PAY_METHODS = [
  { id: 'Telebirr', label: 'Telebirr' },
  { id: 'CBE', label: 'CBE Bank' },
];

const WITHDRAW_METHODS = [
  { id: 'Telebirr', label: 'Telebirr' },
  { id: 'CBE', label: 'CBE Bank' },
];

const MIN_DEPOSIT = 50;
const MIN_WITHDRAW = 100;
const MAX_WITHDRAW = 5000;

export default function Payment() {
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [bank, setBank] = useState('Telebirr');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('Telebirr');
  const [accountNumber, setAccountNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [phone, setPhone] = useState('');
  const user = useUser();
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    const [profileRes, depositsRes, withdrawalsRes] = await Promise.all([
      supabase.from('profiles').select('balance, phone').eq('id', user.id).single(),
      supabase.from('deposits').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      (supabase.from('withdrawals' as any) as any).select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);
    if (profileRes.data) {
      setBalance((profileRes.data as any).balance || 0);
      setPhone((profileRes.data as any).phone || '');
    }
    setDeposits(depositsRes.data || []);
    setWithdrawals(withdrawalsRes.data || []);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!bank || !amt || !reference || !user?.id) {
      toast.error('Please fill all fields');
      return;
    }
    if (amt < MIN_DEPOSIT) {
      toast.error(`${t('minDeposit')}: ${MIN_DEPOSIT} ETB`);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('deposits')
      .insert({ user_id: user.id, bank, amount: amt, reference: reference.trim() })
      .select().single();
    setLoading(false);
    if (error) { toast.error('Failed to submit deposit'); return; }
    setDeposits((prev) => [data, ...prev]);
    toast.success('Deposit request submitted!');
    setAmount(''); setReference('');
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const withdrawAmount = parseFloat(amount);
    if (!withdrawMethod || !withdrawAmount || !accountNumber || !user?.id) {
      toast.error('Please fill all fields');
      return;
    }
    if (withdrawAmount < MIN_WITHDRAW || withdrawAmount > MAX_WITHDRAW) {
      toast.error(`${t('minMaxLimit')}: ${MIN_WITHDRAW} | ${t('maxLimit')}: ${MAX_WITHDRAW} ETB`);
      return;
    }
    if (withdrawAmount > balance) { toast.error(t('insufficientBalance')); return; }

    setLoading(true);
    const { data, error } = await (supabase.from('withdrawals' as any) as any)
      .insert({ user_id: user.id, bank: withdrawMethod, amount: withdrawAmount, account_number: accountNumber.trim() })
      .select().single();
    setLoading(false);
    if (error) { toast.error('Failed to submit withdrawal'); console.error(error); return; }
    setWithdrawals((prev: any[]) => [data, ...prev]);
    toast.success('Withdrawal request submitted!');
    setAmount(''); setAccountNumber('');
  };

  const inputClass = "w-full p-3.5 rounded-xl bg-muted text-foreground text-base focus:ring-2 focus:ring-primary outline-none border border-border";

  return (
    <PageShell title={t('wallet')}>
      <PullToRefresh onRefresh={loadData}>
        {/* Back */}
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

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setTab('deposit'); setAmount(''); }}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-colors active:scale-95',
              tab === 'deposit' ? 'gradient-neon text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}
          >
            <ArrowDownCircle className="w-4 h-4" /> {t('deposit')}
          </button>
          <button
            onClick={() => { setTab('withdraw'); setAmount(''); }}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-colors active:scale-95',
              tab === 'withdraw' ? 'gradient-neon text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}
          >
            <ArrowUpCircle className="w-4 h-4" /> {t('withdraw')}
          </button>
        </div>

        {tab === 'deposit' && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-4">
            {/* Title + intro */}
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold text-foreground">{t('depositTitle')}</h2>
              <p className="text-sm text-muted-foreground mt-2">{t('depositInstructions')}</p>
            </div>

            {/* Deposit accounts */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="font-display text-sm font-bold text-primary mb-3">{t('depositAccountsTitle')}</h3>
              <ul className="space-y-2">
                {DEPOSIT_ACCOUNTS.map((acc) => (
                  <li key={acc.number} className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    <span className="font-semibold text-primary">{acc.number}</span>
                    <span className="text-muted-foreground">({acc.method} — {acc.name})</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 pt-4 border-t border-border space-y-3">
                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" /> {t('yourPhone')}
                  </div>
                  <div className="font-semibold text-foreground mt-1">{phone || '—'}</div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <DollarSign className="w-3.5 h-3.5" /> {t('minDeposit')}
                  </div>
                  <div className="font-semibold text-foreground mt-1">{MIN_DEPOSIT} ETB</div>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleDeposit} className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">{t('payVia')}:</label>
                <div className="space-y-2">
                  {PAY_METHODS.map((m) => (
                    <label
                      key={m.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                        bank === m.id ? 'border-primary bg-primary/5' : 'border-border bg-card'
                      )}
                    >
                      <input
                        type="radio"
                        name="bank"
                        value={m.id}
                        checked={bank === m.id}
                        onChange={() => setBank(m.id)}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="font-medium text-foreground">{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('amount')} (ETB)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`min ${MIN_DEPOSIT}`}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-sm font-bold text-foreground mb-1 block">{t('transactionNumber')}</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={t('transactionNumberPlaceholder')}
                  className={inputClass}
                  maxLength={64}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl font-display font-bold gradient-neon text-primary-foreground text-base active:scale-95 transition-transform disabled:opacity-50"
              >
                {loading ? '...' : t('submitDeposit')}
              </button>
            </form>

            <section className="mt-2">
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
          </motion.div>
        )}

        {tab === 'withdraw' && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-4">
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Wallet className="w-4 h-4 text-primary" />
                  <h3 className="font-display text-sm font-bold text-foreground">{t('withdrawMethod')}</h3>
                </div>
                <div className="space-y-2">
                  {WITHDRAW_METHODS.map((m) => (
                    <label
                      key={m.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors',
                        withdrawMethod === m.id ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'
                      )}
                    >
                      <span className="font-medium text-foreground">{m.label}</span>
                      <input
                        type="radio"
                        name="wmethod"
                        value={m.id}
                        checked={withdrawMethod === m.id}
                        onChange={() => setWithdrawMethod(m.id)}
                        className="w-4 h-4 accent-primary"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <h3 className="font-display text-sm font-bold text-foreground">{t('amount')}</h3>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="ETB 500"
                  className={inputClass}
                />
                <p className="text-xs text-muted-foreground">
                  {t('minMaxLimit')}: {MIN_WITHDRAW} ETB | {t('maxLimit')}: {MAX_WITHDRAW} ETB
                </p>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t('accountNumber')}</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Your account number"
                    className={inputClass}
                    maxLength={32}
                  />
                </div>

                <p className="text-xs text-muted-foreground">{t('available')}: {balance} ETB</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl font-display font-bold gradient-neon text-primary-foreground text-base active:scale-95 transition-transform disabled:opacity-50"
              >
                {loading ? '...' : t('requestWithdraw')}
              </button>

              {parseFloat(amount) > balance && balance >= 0 && amount && (
                <div className="rounded-xl bg-destructive/10 text-destructive text-sm font-medium px-4 py-3 text-center">
                  {t('insufficientBalance')}
                </div>
              )}
            </form>

            <section className="mt-2">
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
          </motion.div>
        )}
      </PullToRefresh>
    </PageShell>
  );
}
