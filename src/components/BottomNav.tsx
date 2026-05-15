import { Chrome as Home, Gamepad2, ShoppingCart, Wallet, CircleUser as UserCircle, LogOut, Shield } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useUser } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

const hiddenRoutes = ['/login', '/signup', '/', '/admin', '/leaderboard', '/cartelas'];

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
    { to: '/home', icon: Home, label: 'Home' },
    { to: '/game', icon: Gamepad2, label: 'Play' },
    { to: '/cards', icon: ShoppingCart, label: 'Cards' },
    { to: '/payment', icon: Wallet, label: 'Pay' },
    { to: '/profile', icon: UserCircle, label: 'Profile' },
  ];

  const items = isAdmin ? adminItems : playerItems;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around">
        {items.map(({ to, icon: Icon, label }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-all duration-200',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className={cn(
                'w-6 h-6 flex items-center justify-center rounded-lg transition-all duration-200',
                active && 'bg-primary/20 shadow-lg shadow-primary/30'
              )}>
                <Icon className={cn('w-5 h-5 transition-transform duration-200', active && 'scale-110')} />
              </div>
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
