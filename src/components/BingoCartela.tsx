import { BINGO_LETTERS } from '@/lib/bingo';
import { cn } from '@/lib/utils';

// Bold, professional bingo header colors — match reference UI exactly.
const HEADER_COLORS = [
  'bg-emerald-500 text-white',  // B
  'bg-rose-500 text-white',     // I
  'bg-teal-500 text-white',     // N
  'bg-blue-500 text-white',     // G
  'bg-orange-500 text-white',   // O
];

interface BingoCartelaProps {
  numbers: number[][];
  drawnNumbers?: Set<number>;
  markedCells?: Set<string>;
  onMarkCell?: (row: number, col: number) => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  selected?: boolean;
  label?: string;
  banned?: boolean;
  /** Last drawn number — gets a special highlight ring */
  lastDrawn?: number | null;
}

export default function BingoCartela({
  numbers,
  drawnNumbers = new Set(),
  markedCells = new Set(),
  onMarkCell,
  size = 'md',
  onClick,
  selected,
  label,
  banned,
  lastDrawn = null,
}: BingoCartelaProps) {
  // Bigger, rounder cells to match the reference circle UI.
  const cellSize =
    size === 'xs' ? 'text-[9px] w-6 h-6' :
    size === 'sm' ? 'text-xs w-10 h-10' :
    size === 'lg' ? 'text-lg w-14 h-14' :
    'text-sm w-11 h-11';

  const headerSize =
    size === 'xs' ? 'text-[9px] w-6 h-5' :
    size === 'sm' ? 'text-xs w-10 h-7' :
    size === 'lg' ? 'text-base w-14 h-9' :
    'text-sm w-11 h-8';

  const handleCellClick = (num: number, row: number, col: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (row === 2 && col === 2) return;
    if (!onMarkCell) return;
    if (!drawnNumbers.has(num)) return;
    onMarkCell(row, col);
  };

  return (
    <div
      className={cn(
        'relative p-2 transition-all duration-200 rounded-2xl',
        // Clean white card look (matches reference screenshots)
        'bg-card border shadow-sm',
        selected ? 'border-primary ring-2 ring-primary/40' : 'border-border',
        banned && 'opacity-50 grayscale',
        onClick && 'cursor-pointer active:scale-[0.98]'
      )}
      onClick={onClick}
    >
      {label && (
        <div className="text-center text-[11px] font-display font-bold text-foreground mb-1">
          {label}
        </div>
      )}

      {/* BINGO Header — colored pills */}
      <div className="grid grid-cols-5 gap-1 mb-1.5">
        {BINGO_LETTERS.map((l, i) => (
          <div
            key={l}
            className={cn(
              'flex items-center justify-center font-display font-bold rounded-md shadow-sm',
              headerSize,
              HEADER_COLORS[i]
            )}
          >
            {l}
          </div>
        ))}
      </div>

      {/* Number grid — circular cells */}
      <div className="space-y-1">
        {Array.from({ length: 5 }, (_, row) => (
          <div key={row} className="grid grid-cols-5 gap-1">
            {Array.from({ length: 5 }, (_, col) => {
              const num = numbers[row]?.[col] ?? 0;
              const isFree = row === 2 && col === 2;
              const isMarked = isFree || markedCells.has(`${row}-${col}`);
              const isDrawn = drawnNumbers.has(num);
              const isLast = !isFree && lastDrawn != null && num === lastDrawn;
              const isClickable = onMarkCell && isDrawn && !isFree;

              return (
                <div
                  key={`${row}-${col}`}
                  onClick={(e) => handleCellClick(num, row, col, e)}
                  className={cn(
                    'relative flex items-center justify-center font-display font-bold rounded-md transition-all',
                    cellSize,
                    isClickable && 'cursor-pointer active:scale-90',
                    isFree
                      ? 'bg-orange-500 text-white shadow-md'
                      : isLast
                      ? 'bg-orange-500 text-white shadow-[0_0_0_3px_hsl(0_84%_60%)] ring-2 ring-rose-500'
                      : isMarked
                      ? 'bg-emerald-500 text-white shadow-md'
                      : 'bg-muted/60 text-foreground border border-border'
                  )}
                >
                  {isFree ? 'FREE' : num}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
