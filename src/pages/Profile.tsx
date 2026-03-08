import { useState, useEffect } from 'react';
import PageShell from '@/components/PageShell';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/auth';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { User, Phone, Save, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const user = useUser();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, phone, balance')
        .eq('id', user!.id)
        .single();
      if (data) {
        setDisplayName(data.display_name || '');
        setPhone(data.phone || '');
        setBalance((data as any).balance || 0);
      }
    }
    load();
  }, [user?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', user.id);

    setLoading(false);
    if (error) {
      toast.error('Failed to update profile');
      return;
    }
    toast.success('Profile updated!');
  };

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
        {/* Avatar + balance */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-full gradient-gold flex items-center justify-center glow-gold mb-2">
            <User className="w-10 h-10 text-primary-foreground" />
          </div>
          <div className="text-xs text-muted-foreground">Balance</div>
          <div className="font-display text-2xl font-bold text-primary">{balance} ETB</div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-3.5 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Phone Number</label>
            <div className="flex items-center gap-2 px-4 py-3.5 rounded-xl bg-muted/50 text-muted-foreground text-sm">
              <Phone className="w-4 h-4" />
              <span>{phone || 'Not set'}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl font-display font-bold gradient-gold text-primary-foreground text-base active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

        <button
          onClick={handleLogout}
          className="w-full mt-4 py-3.5 rounded-xl bg-muted text-destructive font-medium text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </motion.div>
    </PageShell>
  );
}
