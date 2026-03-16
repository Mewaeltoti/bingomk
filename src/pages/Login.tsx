import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { invokeWithRetry } from '@/lib/edgeFn';

// Detect Telegram Mini App environment
function getTelegramWebApp(): any {
  return (window as any).Telegram?.WebApp;
}

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [tgLoading, setTgLoading] = useState(false);
  const navigate = useNavigate();

  // Auto-login via Telegram if in Mini App
  useEffect(() => {
    const tg = getTelegramWebApp();
    if (tg?.initDataUnsafe?.user) {
      handleTelegramLogin(tg);
    }
  }, []);

  const handleTelegramLogin = async (tg: any) => {
    setTgLoading(true);
    const telegramUser = tg.initDataUnsafe.user;
    
    const { data, error } = await invokeWithRetry('telegram-auth', {
      body: {
        initData: tg.initData,
        telegramUser: {
          id: telegramUser.id,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          username: telegramUser.username,
          phone_number: telegramUser.phone_number,
        },
      },
    });

    if (error || !data?.ok) {
      toast.error('Telegram login failed');
      setTgLoading(false);
      return;
    }

    // Sign in with the credentials
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    setTgLoading(false);
    if (signInError) {
      toast.error('Authentication failed');
      return;
    }

    toast.success(`Welcome, ${data.displayName}!`);
    navigate('/game');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const formattedPhone = phone.startsWith('+') ? phone : `+251${phone.replace(/^0/, '')}`;
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
    navigate('/game');
  };

  if (tgLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Signing in via Telegram...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-10">
            <h1 className="font-display text-4xl font-bold">
              <span className="text-secondary">Bingo</span>{' '}
              <span className="text-primary">Ethio</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-2">Sign in to play</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Phone Number</label>
              <div className="flex gap-2">
                <span className="flex items-center px-3 rounded-xl bg-muted text-muted-foreground text-sm font-medium">+251</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9XXXXXXXX"
                  className="flex-1 px-4 py-3.5 rounded-xl bg-muted text-foreground text-base outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3.5 rounded-xl bg-muted text-foreground text-base outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl font-display font-bold text-lg gradient-neon text-primary-foreground active:scale-95 transition-transform disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="text-center mt-4">
            <p className="text-xs text-muted-foreground">
              Forgot password? Contact an admin to reset it.
            </p>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary font-bold">Sign up</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
