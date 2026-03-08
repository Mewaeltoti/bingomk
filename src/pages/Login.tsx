import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();

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

  const handleForgotPassword = async () => {
    if (!phone) {
      toast.error('Enter your phone number first');
      return;
    }
    setLoading(true);
    const formattedPhone = phone.startsWith('+') ? phone : `+251${phone.replace(/^0/, '')}`;
    const fakeEmail = `${formattedPhone.replace('+', '')}@bingo.local`;
    const { error } = await supabase.auth.resetPasswordForEmail(fakeEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error('Failed to send reset link');
      return;
    }
    setResetSent(true);
    toast.success('Password reset link sent!');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full"
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
              className="w-full py-4 rounded-xl font-display font-bold text-lg gradient-gold text-primary-foreground active:scale-95 transition-transform disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => setForgotMode(!forgotMode)}
              className="text-sm text-primary font-medium py-2"
            >
              Forgot password?
            </button>
            {forgotMode && (
              <div className="mt-2">
                <button
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-sm px-4 py-2.5 rounded-xl bg-muted text-foreground font-medium disabled:opacity-50"
                >
                  {resetSent ? 'Link sent!' : 'Send Reset Link'}
                </button>
              </div>
            )}
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
