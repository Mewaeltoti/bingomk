import { Gamepad2, Wallet, LogOut, Shield, Plus, UserCircle, Trophy } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useUser } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

const hiddenRoutes = ['/login', '/signup', '/', '/admin'];

export default function BottomNav() {
  const { pathname } = useLocation();
  const user = useUser();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

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
    { to: '/leaderboard', icon: Trophy, label: 'Ranks' },
    { to: '/profile', icon: UserCircle, label: 'Profile' },
  ];

  const items = isAdmin ? adminItems : playerItems;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around py-1.5">
        {items.map(({ to, icon: Icon, label }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex flex-col items-center gap-0.5 min-w-[56px] py-1.5 text-[10px] transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <div className={cn(
                'w-10 h-7 flex items-center justify-center rounded-full transition-colors',
                active && 'bg-primary/10'
              )}>
                <Icon className={cn('w-5 h-5', active && 'scale-110')} />
              </div>
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
        {user && !isAdmin && (
          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-0.5 min-w-[56px] py-1.5 text-[10px] text-muted-foreground transition-colors active:text-destructive"
          >
            <div className="w-10 h-7 flex items-center justify-center rounded-full">
              <LogOut className="w-5 h-5" />
            </div>
            <span className="font-medium">Logout</span>
          </button>
        )}
        {user && isAdmin && (
          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-0.5 min-w-[56px] py-1.5 text-[10px] text-muted-foreground transition-colors active:text-destructive"
          >
            <div className="w-10 h-7 flex items-center justify-center rounded-full">
              <LogOut className="w-5 h-5" />
            </div>
            <span className="font-medium">Logout</span>
          </button>
        )}
      </div>
    </nav>
  );
}
