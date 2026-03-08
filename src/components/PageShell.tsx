import { ReactNode } from 'react';
import ThemeToggle from './ThemeToggle';

export default function PageShell({ children, title, whiteBg, noPadding }: { children: ReactNode; title?: string; whiteBg?: boolean; noPadding?: boolean }) {
  return (
    <div className={`min-h-screen pb-[env(safe-area-inset-bottom,72px)] ${whiteBg ? 'bg-white dark:bg-background' : ''}`} style={{ paddingBottom: 'max(72px, env(safe-area-inset-bottom, 72px))' }}>
      {title && (
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <h1 className="font-display text-lg font-bold text-foreground">{title}</h1>
          <ThemeToggle />
        </header>
      )}
      <main className={noPadding ? '' : 'px-3 py-3'}>{children}</main>
    </div>
  );
}
