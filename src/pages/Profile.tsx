import { useState, useEffect } from 'react';
import PageShell from '@/components/PageShell';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/auth';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Phone, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const user = useUser();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('phone, balance')
        .eq('id', user!.id)
        .single();
      if (data) {
        setPhone(data.phone || '');
        setBalance((data as any).balance || 0);
      }
    }
    load();
  }, [user?.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <PageShell title="Profile">
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        {/* Phone identity + balance */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-full gradient-gold flex items-center justify-center glow-gold mb-2">
            <Phone className="w-9 h-9 text-primary-foreground" />
          </div>
          <div className="font-display text-lg font-bold text-foreground">{phone || 'Not set'}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Your phone is your identity (locked)</div>

          <div className="mt-4 text-xs text-muted-foreground">Balance</div>
          <div className="font-display text-2xl font-bold text-primary">{balance} ETB</div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Phone Number</label>
            <div className="flex items-center gap-2 px-4 py-3.5 rounded-xl bg-muted text-foreground text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{phone || 'Not set'}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">locked</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Phone number is your profile and cannot be changed.</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full mt-6 py-3.5 rounded-xl bg-muted text-destructive font-medium text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </motion.div>
    </PageShell>
  );
}
