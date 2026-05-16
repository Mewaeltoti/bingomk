import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageShell from '@/components/PageShell';
import SettingsDrawer from '@/components/SettingsDrawer';
import { t, getLang } from '@/lib/i18n';

export default function Profile() {
  const user = useUser();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stats, setStats] = useState({
    balance: 0,
    wins: 0,
    cards: 0,
    totalWon: 0,
    totalDeposited: 0,
  });

  useEffect(() => {
    if (!user?.id) return;

    const loadProfile = async () => {
      const [profileRes, cartelasRes, historyRes, depositsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('cartelas').select('id').eq('owner_id', user.id).eq('is_used', true),
        supabase.from('game_history').select('prize').eq('winner_id', user.id),
        supabase.from('deposits').select('amount').eq('user_id', user.id).eq('status', 'approved'),
      ]);

      if (profileRes.data) setProfile(profileRes.data);

      const wins = (historyRes.data || []).length;
      const totalWon = (historyRes.data || []).reduce((sum, h: any) => sum + (h.prize || 0), 0);
      const totalDeposited = (depositsRes.data || []).reduce((sum, d: any) => sum + (d.amount || 0), 0);
      const cards = (cartelasRes.data || []).length;

      setStats({
        balance: profileRes.data?.balance || 0,
        wins,
        cards,
        totalWon,
        totalDeposited,
      });
    };

    loadProfile();
  }, [user?.id]);

  const getInitial = () => {
    const name = profile?.display_name || profile?.phone;
    if (!name) return 'D';
    return name.charAt(0).toUpperCase();
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <PageShell title="Profile">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="space-y-6"
      >
        {/* Profile header with avatar */}
        <motion.div variants={itemVariants} className="text-center pt-4">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-3xl font-display font-bold text-primary-foreground shadow-lg">
              {getInitial()}
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">
            {profile?.display_name || profile?.phone || 'Player'}
          </h1>
          <p className="text-xs text-muted-foreground">{profile?.phone || 'No phone'}</p>
        </motion.div>

        {/* Stats cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3">
          {[
            { icon: '💰', label: 'Balance', value: `${stats.balance.toFixed(2)} ETB`, color: 'from-primary' },
            { icon: '🏆', label: 'Wins', value: stats.wins.toString(), color: 'from-accent' },
            { icon: '🎫', label: 'Cards', value: stats.cards.toString(), color: 'from-secondary' },
          ].map((stat, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-card border border-border/50 text-center"
            >
              <div className="text-2xl mb-2">{stat.icon}</div>
              <p className="text-[10px] text-muted-foreground mb-1">{stat.label}</p>
              <p className="font-display font-bold text-lg text-foreground">{stat.value}</p>
            </div>
          ))}
        </motion.div>

        {/* Earnings section */}
        <motion.div variants={itemVariants}>
          <h2 className="font-display text-sm font-bold text-foreground mb-3 uppercase tracking-wider">Earnings</h2>
          <div className="space-y-2">
            <div className="p-4 rounded-xl bg-card border border-border/50 flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0 text-lg">
                💚
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Total Won</p>
                <p className="font-display font-bold text-emerald-500 text-lg">{stats.totalWon} ETB</p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border/50 flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 text-lg">
                🟡
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Total Deposited</p>
                <p className="font-display font-bold text-amber-500 text-lg">{stats.totalDeposited} ETB</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Settings section */}
        <motion.div variants={itemVariants}>
          <h2 className="font-display text-sm font-bold text-foreground mb-3 uppercase tracking-wider">Settings</h2>
          <div className="space-y-2 rounded-xl bg-card border border-border/50 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">🎨</span>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">Theme</p>
                  <p className="text-[10px] text-muted-foreground">System default</p>
                </div>
              </div>
              <span className="text-lg">→</span>
            </button>
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">🌐</span>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">Language</p>
                  <p className="text-[10px] text-muted-foreground">{getLang() === 'ti' ? 'ትግርኛ' : 'English'}</p>
                </div>
              </div>
              <span className="text-lg">→</span>
            </button>
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">🔊</span>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">Sound Effects</p>
                  <p className="text-[10px] text-muted-foreground">On</p>
                </div>
              </div>
              <span className="text-lg">→</span>
            </button>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div variants={itemVariants} className="text-center py-8 text-muted-foreground">
          <p className="text-xs font-display font-bold">Bingo Ethio v1.0.0</p>
          <p className="text-[10px] mt-1">© 2026 Bingo Ethio</p>
        </motion.div>
      </motion.div>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </PageShell>
  );
}
