import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Don't show if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Check if dismissed recently
    const lastDismissed = localStorage.getItem('pwa-install-dismissed');
    if (lastDismissed && Date.now() - Number(lastDismissed) < 1000 * 60 * 60 * 24 * 3) {
      setDismissed(true);
      return;
    }

    // iOS detection
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isiOS);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', String(Date.now()));
  };

  // Already installed or dismissed
  if (dismissed) return null;
  if (window.matchMedia('(display-mode: standalone)').matches) return null;

  // Nothing to show on non-iOS without prompt
  if (!deferredPrompt && !isIOS) return null;

  return (
    <>
      <div className="fixed bottom-20 left-3 right-3 z-40 animate-in slide-in-from-bottom fade-in duration-300">
        <div className="rounded-2xl bg-card border border-border p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center flex-shrink-0">
              <Download className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-bold text-sm text-foreground">Install Bingo Ethio</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isIOS ? 'Add to your home screen for the best experience' : 'Install for faster access & offline support'}
              </p>
            </div>
            <button onClick={handleDismiss} className="p-1 -mt-1 -mr-1 text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            {isIOS ? (
              <button
                onClick={() => setShowIOSGuide(true)}
                className="flex-1 py-2.5 rounded-xl gradient-gold text-primary-foreground text-sm font-bold active:scale-95 transition-transform"
              >
                Show me how
              </button>
            ) : (
              <button
                onClick={handleInstall}
                className="flex-1 py-2.5 rounded-xl gradient-gold text-primary-foreground text-sm font-bold active:scale-95 transition-transform"
              >
                Install
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="px-4 py-2.5 rounded-xl bg-muted text-muted-foreground text-sm font-medium"
            >
              Later
            </button>
          </div>
        </div>
      </div>

      {/* iOS install guide overlay */}
      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => setShowIOSGuide(false)}
        >
          <div className="w-full max-w-sm mx-3 mb-6 p-5 rounded-2xl bg-card border border-border shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-bold text-foreground mb-3">Install on iPhone/iPad</h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-bold text-primary">1.</span>
                Tap the <span className="font-medium text-foreground">Share</span> button (square with arrow)
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">2.</span>
                Scroll down and tap <span className="font-medium text-foreground">"Add to Home Screen"</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">3.</span>
                Tap <span className="font-medium text-foreground">"Add"</span> to confirm
              </li>
            </ol>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full mt-4 py-2.5 rounded-xl bg-muted text-foreground text-sm font-bold"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
