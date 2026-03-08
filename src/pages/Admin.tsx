import { useState, useEffect, useRef } from 'react';
import PageShell from '@/components/PageShell';
import { Users, CreditCard, Check, X, Plus, Minus } from 'lucide-react';
import { PatternName } from '@/lib/bingo';
import { checkWin } from '@/lib/winDetection';
import { supabase } from '@/integrations/supabase/client';
import { useGamePresence } from '@/hooks/useGamePresence';
import { useUser } from '@/lib/auth';
import { toast } from 'sonner';

export default function Admin() {
  const [tab, setTab] = useState<'deposits' | 'players'>('deposits');

  const [deposits, setDeposits] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [adjustingPlayer, setAdjustingPlayer] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');

  const user = useUser();
  const onlinePlayers = useGamePresence(user?.id, 'Admin');

  const tabs = [
    { key: 'deposits' as const, label: 'Deposits', icon: CreditCard },
    { key: 'players' as const, label: 'Players', icon: Users },
  ];

  const enrichWithProfiles = async (records: any[], userIdField = 'user_id') => {
    if (!records.length) return records;
    const userIds = [...new Set(records.map(r => r[userIdField]))];
    const { data: profiles } = await supabase.from('profiles').select('id, phone, display_name').in('id', userIds);
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    return records.map(r => ({ ...r, profile: profileMap.get(r[userIdField]) || null }));
  };

  // Listen for claims and auto-validate
  useEffect(() => {
    const channel = supabase
      .channel('admin-claims')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bingo_claims' },
        async (payload: any) => {
          await validateAndResolveClaim(payload.new);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const validateAndResolveClaim = async (claim: any) => {
    const { data: cartelas } = await supabase
      .from('cartelas')
      .select('numbers')
      .eq('owner_id', claim.user_id);

    const { data: gameData } = await supabase
      .from('games')
      .select('pattern')
      .eq('id', 'current')
      .single();

    const currentPattern = (gameData as any)?.pattern || 'Full House';

    const { data: nums } = await supabase
      .from('game_numbers')
      .select('number')
      .eq('game_id', 'current');

    const drawnSet = new Set((nums || []).map((n: any) => n.number));

    let isValid = false;
    if (cartelas) {
      for (const c of cartelas) {
        if (checkWin(c.numbers as number[][], drawnSet, currentPattern as PatternName)) {
          isValid = true;
          break;
        }
      }
    }

    if (isValid) {
      const drawnNumbersList = (nums || []).map((n: any) => n.number);

      await supabase.from('games').update({
        status: 'won',
        winner_id: claim.user_id,
      }).eq('id', 'current');

      await supabase.from('bingo_claims').update({ is_valid: true }).eq('id', claim.id);

      await supabase.from('game_history').insert({
        game_id: 'current',
        winner_id: claim.user_id,
        pattern: currentPattern,
        players_count: 0,
        prize: 0,
        drawn_numbers: drawnNumbersList,
      } as any);

      await supabase.from('game_numbers').delete().eq('game_id', 'current');

      toast.success('🏆 System verified winner!');
    } else {
      await supabase.from('bingo_claims').update({ is_valid: false }).eq('id', claim.id);
      toast.error('❌ Invalid bingo claim rejected by system');
    }
  };

  useEffect(() => {
    if (tab !== 'deposits') return;
    supabase.from('deposits').select('*')
      .order('created_at', { ascending: false })
      .then(async ({ data }) => setDeposits(await enrichWithProfiles(data || [])));
  }, [tab]);

  useEffect(() => {
    if (tab !== 'players') return;
    supabase.from('profiles').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setPlayers(data || []));
  }, [tab]);

  const handleDeposit = async (id: string, action: 'approved' | 'rejected', userId: string, amount: number) => {
    const { error } = await supabase.from('deposits').update({ status: action }).eq('id', id);
    if (error) { toast.error('Failed'); return; }

    if (action === 'approved') {
      const { data: profile } = await supabase.from('profiles').select('balance').eq('id', userId).single();
      const bal = (profile as any)?.balance || 0;
      await supabase.from('profiles').update({ balance: bal + amount } as any).eq('id', userId);
      toast.success(`✅ Approved & credited ${amount} ETB`);
    } else {
      toast.success('Deposit rejected');
    }

    setDeposits((prev) => prev.map((d) => d.id === id ? { ...d, status: action } : d));
  };

  return (
    <PageShell title="Admin Panel">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/10 text-xs">
          <Users className="w-3.5 h-3.5 text-secondary" />
          <span className="font-bold text-secondary">{onlinePlayers.length}</span>
          <span className="text-muted-foreground">players online</span>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              tab === key ? 'gradient-gold text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'deposits' && (
        <div className="space-y-2">
          {deposits.length === 0 && <p className="text-center text-muted-foreground py-8">No deposits yet</p>}
          {deposits.map((d) => (
            <div key={d.id} className="p-3 rounded-xl bg-muted/50 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">{d.bank} — {d.amount} ETB</div>
                  <div className="text-xs text-muted-foreground">
                    Ref: {d.reference} · {d.profile?.display_name || d.profile?.phone || 'Unknown'}
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  d.status === 'approved' ? 'bg-secondary/20 text-secondary' :
                  d.status === 'pending' ? 'bg-primary/20 text-primary' :
                  'bg-destructive/20 text-destructive'
                }`}>{d.status}</span>
              </div>
              {d.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => handleDeposit(d.id, 'approved', d.user_id, d.amount)}
                    className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium flex items-center justify-center gap-1">
                    <Check className="w-4 h-4" /> Approve
                  </button>
                  <button onClick={() => handleDeposit(d.id, 'rejected', d.user_id, d.amount)}
                    className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium flex items-center justify-center gap-1">
                    <X className="w-4 h-4" /> Decline
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'players' && (() => {
        const handleAdjust = async (playerId: string, amount: number) => {
          const player = players.find(p => p.id === playerId);
          if (!player) return;
          const newBalance = Math.max(0, (player.balance || 0) + amount);
          const { error } = await supabase.from('profiles').update({ balance: newBalance }).eq('id', playerId);
          if (error) { toast.error('Failed'); return; }
          setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, balance: newBalance } : p));
          setAdjustingPlayer(null);
          setAdjustAmount('');
          toast.success(`Balance → ${newBalance} ETB`);
        };

        return (
          <div className="space-y-2">
            {players.length === 0 && <p className="text-center text-muted-foreground py-8">No players yet</p>}
            {players.map((p) => (
              <div key={p.id} className="p-3 rounded-xl bg-muted/50 space-y-2">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setAdjustingPlayer(adjustingPlayer === p.id ? null : p.id)}>
                  <div>
                    <div className="text-sm font-medium text-foreground">{p.display_name || p.phone || 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">{p.phone}</div>
                  </div>
                  <div className="text-sm font-display font-bold text-primary">{p.balance || 0} ETB</div>
                </div>
                {adjustingPlayer === p.id && (
                  <div className="flex gap-2 items-center pt-1">
                    <input
                      type="number"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      placeholder="Amount"
                      className="flex-1 px-3 py-2 rounded-lg bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      onClick={() => handleAdjust(p.id, Math.abs(Number(adjustAmount)))}
                      disabled={!adjustAmount || Number(adjustAmount) <= 0}
                      className="p-2 rounded-lg bg-secondary text-secondary-foreground disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleAdjust(p.id, -Math.abs(Number(adjustAmount)))}
                      disabled={!adjustAmount || Number(adjustAmount) <= 0}
                      className="p-2 rounded-lg bg-destructive text-destructive-foreground disabled:opacity-50"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })()}
    </PageShell>
  );
}
