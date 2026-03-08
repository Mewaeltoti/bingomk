import { useState, useEffect } from 'react';
import PageShell from '@/components/PageShell';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/auth';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { User, Phone, Save } from 'lucide-react';

export default function Profile() {
  const user = useUser();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, phone')
        .eq('id', user!.id)
        .single();
      if (data) {
        setDisplayName(data.display_name || '');
        setPhone(data.phone || '');
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

  return (
    <PageShell title="Profile">
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="max-w-sm mx-auto"
      >
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full gradient-gold flex items-center justify-center glow-gold">
            <User className="w-10 h-10 text-primary-foreground" />
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-3 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Phone Number</label>
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted/50 text-muted-foreground text-sm">
              <Phone className="w-4 h-4" />
              <span>{phone || 'Not set'}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl font-display font-bold gradient-gold text-primary-foreground text-lg active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </motion.div>
    </PageShell>
  );
}
