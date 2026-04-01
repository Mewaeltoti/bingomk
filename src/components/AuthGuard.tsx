import { Navigate } from 'react-router-dom';
import { ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { checkSessionValidity, registerSession } from '@/lib/sessionGuard';
import { toast } from 'sonner';

function AuthLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const localToken = localStorage.getItem('bingo-session-token');
        if (!localToken) {
          // First visit after OAuth redirect — register this device
          await registerSession(session.user.id);
        } else {
          const valid = await checkSessionValidity(session.user.id);
          if (!valid) {
            toast.error('Signed in on another device');
            await supabase.auth.signOut();
            setUser(null);
            return;
          }
        }
      }
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, []);

  // Periodic session check every 30s
  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(async () => {
      const valid = await checkSessionValidity(user.id);
      if (!valid) {
        toast.error('Session ended — signed in on another device');
        await supabase.auth.signOut();
        setUser(null);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  if (user === undefined) return <AuthLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (!currentUser?.id) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id)
        .eq('role', 'admin')
        .maybeSingle();

      setIsAdmin(!!data);
      setLoading(false);
    }
    init();
  }, []);

  if (loading || user === undefined) return <AuthLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
