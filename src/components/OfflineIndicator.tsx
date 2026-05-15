import { WifiOff, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * OfflineIndicator - Shows a banner when the user loses internet connection
 * Automatically appears when offline and shows a brief "Back online" message when reconnected
 */
export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      // Hide the "back online" message after 3 seconds
      setTimeout(() => setShowReconnected(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const shouldShow = !isOnline || showReconnected;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 safe-area-inset-top ${
            isOnline
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-destructive text-destructive-foreground'
          }`}
        >
          {isOnline ? (
            <>
              <Wifi className="w-4 h-4" />
              <span>Back online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              <span>You are offline. Some features may be unavailable.</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
