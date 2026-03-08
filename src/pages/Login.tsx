import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import PageShell from '@/components/PageShell';
import { motion } from 'framer-motion';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Format phone: ensure it starts with country code
    const formattedPhone = phone.startsWith('+') ? phone : `+251${phone.replace(/^0/, '')}`;
    
    // Use phone as email workaround: phone@bingo.local
    const fakeEmail = `${formattedPhone.replace('+', '')}@bingo.local`;

    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password,
    });

    setLoading(false);

    if (error) {
      toast.error('Invalid phone or password');
      return;
    }

    // Check if user is admin → redirect to admin page
    if (signInData.user) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', signInData.user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (roleData) {
        toast.success('Welcome, Admin!');
        navigate('/admin');
        return;
      }
    }

    toast.success('Welcome back!');
    navigate('/');
  };

  return (
    <PageShell>
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-2">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl font-bold">
              <span className="text-secondary">Bingo</span>{' '}
              <span className="text-primary">Ethio</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-2">Sign in to play</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Phone Number</label>
              <div className="flex gap-2">
                <span className="flex items-center px-3 rounded-lg bg-muted text-muted-foreground text-sm">+251</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9XXXXXXXX"
                  className="flex-1 px-4 py-3 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl font-display font-bold text-lg gradient-gold text-primary-foreground active:scale-95 transition-transform disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary font-medium">Sign up</Link>
          </p>
        </motion.div>
      </div>
    </PageShell>
  );
}
