import { ReactNode } from 'react';
import ThemeToggle from './ThemeToggle';

export default function PageShell({ children, title, whiteBg, noPadding }: { children: ReactNode; title?: string; whiteBg?: boolean; noPadding?: boolean }) {
  return (
    <div className={`min-h-screen pb-20 ${whiteBg ? 'bg-white dark:bg-background' : ''}`}>
      {title && (
        <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
          <h1 className="font-display text-lg font-bold text-foreground">{title}</h1>
          <ThemeToggle />
        </header>
      )}
      <main className={noPadding ? '' : 'px-4 py-4'}>{children}</main>
    </div>
  );
}
