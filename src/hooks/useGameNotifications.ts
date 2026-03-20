import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { playDrawSound } from '@/lib/sounds';

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

/**
 * Hook that listens for game state changes and shows notifications.
 * Only sends push notifications for wins (to the winner).
 */
export function useGameNotifications() {
  useEffect(() => {
    requestNotificationPermission();

    const channel = supabase
      .channel('game-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: 'id=eq.current' },
        (payload: any) => {
          const game = payload.new;
          if (!game) return;

          if (game.status === 'buying') {
            playDrawSound();
            toast('🛒 New game! Buy cartelas now!', {
              description: `Pattern: ${game.pattern}`,
              duration: 10000,
            });
          }

          if (game.status === 'active') {
            toast('🎲 Game Started!', { description: 'Numbers are being drawn.', duration: 5000 });
          }

          if (game.status === 'won') {
            toast('🏆 Game Over!', {
              description: 'Winner announced!',
              duration: 6000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
