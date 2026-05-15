import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import CalledNumbersGrid from '@/components/CalledNumbersGrid';

interface CalledNumbersDisplayProps {
  drawnNumbers: number[];
  boardOpen: boolean;
}

const BALL_GRADIENTS = [
  'bg-gradient-to-br from-blue-400 to-blue-700',
  'bg-gradient-to-br from-rose-400 to-rose-700',
  'bg-gradient-to-br from-emerald-400 to-emerald-700',
  'bg-gradient-to-br from-purple-400 to-purple-700',
  'bg-gradient-to-br from-orange-400 to-orange-700',
];

const LETTERS = ['B', 'I', 'N', 'G', 'O'];

export function CalledNumbersDisplay({ drawnNumbers, boardOpen }: CalledNumbersDisplayProps) {
  if (drawnNumbers.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-foreground text-sm">Called Numbers:</span>
          <span className="text-muted-foreground text-sm">Drawn: 0</span>
        </div>
        <p className="text-center text-sm text-muted-foreground py-2">Not called yet</p>
      </div>
    );
  }

  if (boardOpen) {
    return <CalledNumbersGrid drawnNumbers={drawnNumbers} />;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-foreground text-sm">Called Numbers:</span>
        <span className="text-muted-foreground text-sm">Drawn: {drawnNumbers.length}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 max-h-44 overflow-y-auto pr-1 scroll-smooth">
        {drawnNumbers.slice().reverse().map((num, i) => {
          const rowIdx = Math.floor((num - 1) / 15);
          const isLatest = i === 0;
          return (
            <motion.div
              key={num}
              initial={isLatest ? { scale: 0, rotate: -180 } : false}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 14, stiffness: 200 }}
              className={cn(
                'shrink-0 flex items-center justify-center rounded-full text-white font-display font-bold shadow-lg',
                BALL_GRADIENTS[rowIdx],
                isLatest ? 'w-14 h-14 text-base ring-4 ring-white/40' : 'w-10 h-10 text-xs'
              )}
            >
              {isLatest ? `${LETTERS[rowIdx]}-${num}` : num}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default CalledNumbersDisplay;
