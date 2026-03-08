import { Gamepad2, Wallet, LogOut, Shield, Plus, UserCircle, Volume2, VolumeX } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useUser } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { isMuted, setMuted } from '@/lib/sounds';

const hiddenRoutes = ['/login', '/signup', '/'];

export default function BottomNav() {
  const { pathname } = useLocation();
  const user = useUser();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [muted, setLocalMuted] = useState(isMuted());

  useEffect(() => {
    async function checkAdmin() {
      if (!user?.id) return;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      setIsAdmin(!!data);
    }
    checkAdmin();
  }, [user?.id]);

  if (hiddenRoutes.includes(pathname)) return null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
    navigate('/login');
  };

  const adminItems = [
    { to: '/game', icon: Gamepad2, label: 'Game' },
    { to: '/admin', icon: Shield, label: 'Admin' },
  ];

  const playerItems = [
    { to: '/game', icon: Gamepad2, label: 'Game' },
    { to: '/cartelas', icon: Plus, label: 'Cartelas' },
    { to: '/payment', icon: Wallet, label: 'Wallet' },
    { to: '/profile', icon: UserCircle, label: 'Profile' },
  ];

  const items = isAdmin ? adminItems : playerItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md">
      <div className="flex items-center justify-around py-2 max-w-lg mx-auto">
        {items.map(({ to, icon: Icon, label }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
        {user && (
          <>
            <button
              onClick={() => { const next = !muted; setMuted(next); setLocalMuted(next); }}
              className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs text-muted-foreground transition-colors"
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              <span className="font-medium">{muted ? 'Muted' : 'Sound'}</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
