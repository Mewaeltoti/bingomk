import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

/**
 * Full 1-75 BINGO grid where each drawn number lights up in its row's color.
 * The most recently drawn number gets a red ring highlight.
 * Matches the reference UI screenshots exactly.
 */
interface CalledNumbersGridProps {
  drawnNumbers: number[];
}

const ROWS = [
  { letter: 'B', start: 1, end: 15, label: 'bg-blue-500 text-white border-blue-300', cell: 'bg-blue-500 text-white' },
  { letter: 'I', start: 16, end: 30, label: 'bg-rose-500 text-white border-rose-300', cell: 'bg-rose-500 text-white' },
  { letter: 'N', start: 31, end: 45, label: 'bg-emerald-500 text-white border-emerald-300', cell: 'bg-emerald-500 text-white' },
  { letter: 'G', start: 46, end: 60, label: 'bg-purple-500 text-white border-purple-300', cell: 'bg-purple-500 text-white' },
  { letter: 'O', start: 61, end: 75, label: 'bg-orange-500 text-white border-orange-300', cell: 'bg-orange-500 text-white' },
];

export default function CalledNumbersGrid({ drawnNumbers }: CalledNumbersGridProps) {
  const drawnSet = new Set(drawnNumbers);
  const last = drawnNumbers[drawnNumbers.length - 1];

  return (
    <div className="rounded-2xl bg-card border border-border p-2 shadow-sm">
      <div className="flex items-center justify-center mb-1.5">
        <span className="text-xs text-muted-foreground">
          Drawn: <span className="font-bold text-foreground">{drawnNumbers.length}</span>
        </span>
      </div>
      <div className="space-y-1">
        {ROWS.map((row) => (
          <div key={row.letter} className="flex items-center gap-1">
            {/* Letter label */}
            <div
              className={cn(
                'flex items-center justify-center rounded-md font-display font-bold text-[11px] w-6 h-6 border shrink-0',
                row.label
              )}
            >
              {row.letter}
            </div>
            {/* 15 number cells */}
            <div className="grid grid-cols-15 gap-[3px] flex-1" style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}>
              {Array.from({ length: 15 }, (_, i) => {
                const n = row.start + i;
                const isDrawn = drawnSet.has(n);
                const isLast = n === last;
                return (
                  <motion.div
                    key={n}
                    initial={isLast ? { scale: 0 } : false}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 14, stiffness: 220 }}
                    className={cn(
                      'aspect-square flex items-center justify-center rounded-md text-[10px] font-display font-bold transition-all',
                      isLast
                        ? 'bg-rose-600 text-white ring-2 ring-rose-300 shadow-lg'
                        : isDrawn
                        ? row.cell
                        : 'bg-muted/50 text-muted-foreground/70'
                    )}
                  >
                    {n}
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
