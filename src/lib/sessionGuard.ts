import { supabase } from '@/integrations/supabase/client';

/**
 * Checks if the current session token matches the one stored in DB.
 * If another device logged in, this device gets signed out.
 */
export async function checkSessionValidity(userId: string): Promise<boolean> {
  const localToken = localStorage.getItem('bingo-session-token');
  if (!localToken) return false;

  const { data } = await supabase
    .from('user_sessions' as any)
    .select('session_token')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return false;
  return (data as any).session_token === localToken;
}

export async function registerSession(userId: string): Promise<void> {
  const token = crypto.randomUUID();
  localStorage.setItem('bingo-session-token', token);
  await supabase.from('user_sessions' as any).upsert(
    { user_id: userId, session_token: token, created_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
}
