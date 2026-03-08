import { Home, LayoutGrid, Gamepad2, Wallet, User, LogOut, Shield, Trophy } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useUser } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/game', icon: Gamepad2, label: 'Game' },
  { to: '/leaderboard', icon: Trophy, label: 'Rank', hideOnAdmin: true },
  { to: '/dashboard', icon: Wallet, label: 'Wallet', hideOnAdmin: true },
  { to: '/profile', icon: User, label: 'Profile', hideOnAdmin: true },
];

const hiddenRoutes = ['/login', '/signup'];

export default function BottomNav() {
  const { pathname } = useLocation();
  const user = useUser();
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

  // Admin only sees Home, Game, Admin, Logout
  const isAdminPage = pathname === '/admin';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out');
  };

  const isOnAdmin = pathname === '/admin';
  const filteredNav = isOnAdmin ? navItems.filter((n) => !(n as any).hideOnAdmin) : navItems;
  const allItems = [
    ...filteredNav,
    ...(isAdmin ? [{ to: '/admin', icon: Shield, label: 'Admin' }] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md safe-area-pb">
      <div className="flex items-center justify-around py-2">
        {allItems.map(({ to, icon: Icon, label }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2 py-1 text-xs transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
        {user && (
          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-0.5 px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        )}
      </div>
    </nav>
  );
}
