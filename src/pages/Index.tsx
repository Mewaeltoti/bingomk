import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useUser } from '@/lib/auth';

export default function Index() {
  const navigate = useNavigate();
  const user = useUser();

  useEffect(() => {
    if (user) navigate('/game', { replace: true });
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 safe-top">
      <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-6">
        <span className="text-3xl">🎱</span>
      </div>
      <h1 className="text-3xl font-bold text-foreground mb-2">Bingo Mekele</h1>
      <p className="text-muted-foreground text-center mb-8 max-w-xs">
        Play real-time bingo online. Buy cards, match patterns, win prizes!
      </p>
      <div className="w-full max-w-xs space-y-3">
        <button onClick={() => navigate('/login')}
          className="w-full py-4 rounded-xl font-bold text-lg bg-primary text-primary-foreground active:scale-95 transition-transform">
          Sign In
        </button>
        <button onClick={() => navigate('/signup')}
          className="w-full py-4 rounded-xl font-bold text-lg bg-muted text-foreground active:scale-95 transition-transform">
          Create Account
        </button>
      </div>
    </div>
  );
}
