import { ReactNode } from 'react';
import ThemeToggle from './ThemeToggle';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PageShell({ children, title, whiteBg, noPadding, showBack }: { children: ReactNode; title?: string; whiteBg?: boolean; noPadding?: boolean; showBack?: boolean }) {
  const navigate = useNavigate();
  return (
    <div className={`min-h-screen ${whiteBg ? 'bg-white dark:bg-background' : ''}`}>
      {title && (
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="flex items-center gap-2">
            {showBack && (
              <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="font-display text-lg font-bold text-foreground">{title}</h1>
          </div>
          <ThemeToggle />
        </header>
      )}
      <main className={noPadding ? '' : 'px-3 py-3'}>{children}</main>
    </div>
  );
}
