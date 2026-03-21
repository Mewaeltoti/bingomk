import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { playDrawSound } from '@/lib/sounds';

/** Request notification permission on first user interaction */
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendPushNotification(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/pwa-192.png', badge: '/pwa-192.png' });
  } catch {
    // Mobile Safari doesn't support new Notification directly
    navigator.serviceWorker?.ready.then(reg => {
      reg.showNotification(title, { body, icon: '/pwa-192.png', badge: '/pwa-192.png' });
    }).catch(() => {});
  }
}

/**
 * Hook that listens for game state changes and shows notifications.
 * Should be mounted once at the app level.
 */
export function useGameNotifications() {
  useEffect(() => {
    // Ask for permission early
    requestNotificationPermission();

    const channel = supabase
      .channel('game-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games' },
        (payload: any) => {
          const game = payload.new;
          if (!game) return;

          if (game.status === 'buying') {
            playDrawSound();
            toast('🛒 New game! Buy cartelas now!', {
              description: `Pattern: ${game.pattern}`,
              duration: 10000,
            });
            sendPushNotification('🎮 Bingo Ethio', `New game starting! Pattern: ${game.pattern}. Buy cartelas now!`);
          }

          if (game.status === 'active') {
            sendPushNotification('🎲 Game Started!', 'Numbers are being drawn. Join now!');
          }

          if (game.status === 'won') {
            toast('🏆 Game Over!', {
              description: 'Someone won this round!',
              duration: 6000,
            });
            sendPushNotification('🏆 Round Over!', 'Someone won! New game starting soon.');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
