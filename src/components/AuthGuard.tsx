import { useUser } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useUser();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
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

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
