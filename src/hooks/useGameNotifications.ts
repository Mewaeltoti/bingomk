import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { playDrawSound } from '@/lib/sounds';

/**
 * Hook that listens for game state changes and shows notifications.
 * Should be mounted once at the app level.
 */
export function useGameNotifications() {
  useEffect(() => {
    const channel = supabase
      .channel('game-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games' },
        (payload: any) => {
          const game = payload.new;
          if (!game) return;

          if (game.status === 'waiting' && payload.eventType === 'UPDATE') {
            playDrawSound();
            toast('🎮 New game starting!', {
              description: `Pattern: ${game.pattern}. Get ready!`,
              duration: 8000,
            });
          }

          if (game.status === 'won') {
            toast('🏆 Game Over!', {
              description: 'Someone won this round!',
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
