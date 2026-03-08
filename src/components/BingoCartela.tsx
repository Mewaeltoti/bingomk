import { BINGO_LETTERS } from '@/lib/bingo';
import { cn } from '@/lib/utils';
import { Heart } from 'lucide-react';

const HEADER_COLORS = [
  'bg-blue-500 text-white',    // B
  'bg-red-500 text-white',     // I
  'bg-green-600 text-white',   // N
  'bg-orange-500 text-white',  // G
  'bg-purple-600 text-white',  // O
];

const COL_DRAWN_COLORS = [
  'bg-blue-100 dark:bg-blue-900/30',
  'bg-red-100 dark:bg-red-900/30',
  'bg-green-100 dark:bg-green-900/30',
  'bg-orange-100 dark:bg-orange-900/30',
  'bg-purple-100 dark:bg-purple-900/30',
];

interface BingoCartelaProps {
  numbers: number[][];
  drawnNumbers?: Set<number>;
  markedCells?: Set<string>;
  onMarkCell?: (row: number, col: number) => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  selected?: boolean;
  isFavorite?: boolean;
  onFavorite?: () => void;
  label?: string;
}

export default function BingoCartela({
  numbers,
  drawnNumbers = new Set(),
  markedCells = new Set(),
  onMarkCell,
  size = 'md',
  onClick,
  selected,
  isFavorite,
  onFavorite,
  label,
}: BingoCartelaProps) {
  const cellSize =
    size === 'xs' ? 'text-[9px] w-5 h-5' :
    size === 'sm' ? 'text-xs w-9 h-9' :
    size === 'lg' ? 'text-base w-12 h-12' :
    'text-sm w-10 h-10';

  const headerSize =
    size === 'xs' ? 'text-[9px] w-5 h-5' :
    size === 'sm' ? 'text-[10px] w-9 h-6' :
    size === 'lg' ? 'text-sm w-12 h-8' :
    'text-xs w-10 h-7';

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
        'relative rounded-xl border-2 p-1.5 transition-all duration-200 bg-white dark:bg-card',
        selected ? 'border-primary glow-gold' : 'border-purple-400 dark:border-border',
        onClick && 'cursor-pointer active:scale-[0.98]'
      )}
      onClick={onClick}
    >
      {label && (
        <div className="text-center text-[10px] font-display font-bold text-foreground mb-0.5">{label}</div>
      )}
      {onFavorite && (
        <button
          onClick={(e) => { e.stopPropagation(); onFavorite(); }}
          className="absolute top-1 right-1 p-0.5 z-10"
        >
          <Heart className={cn('w-3.5 h-3.5', isFavorite ? 'fill-destructive text-destructive' : 'text-muted-foreground')} />
        </button>
      )}
      {/* Colored BINGO Header */}
      <div className="grid grid-cols-5 gap-0.5 mb-0.5">
        {BINGO_LETTERS.map((l, i) => (
          <div
            key={l}
            className={cn(
              'flex items-center justify-center font-display font-bold rounded-md',
              headerSize,
              HEADER_COLORS[i]
            )}
          >
            {l}
          </div>
        ))}
      </div>
      {/* Grid with round cells — column colors match BINGO */}
      <div>
        {Array.from({ length: 5 }, (_, row) => (
          <div key={row} className="grid grid-cols-5 gap-0.5 mb-0.5 last:mb-0">
            {Array.from({ length: 5 }, (_, col) => {
              const num = numbers[row]?.[col] ?? 0;
              const isFree = row === 2 && col === 2;
              const isMarked = isFree || markedCells.has(`${row}-${col}`);
              const isDrawn = drawnNumbers.has(num);
              const isClickable = onMarkCell && isDrawn && !isFree;

              return (
                <div
                  key={`${row}-${col}`}
                  onClick={(e) => handleCellClick(num, row, col, e)}
                  className={cn(
                    'flex items-center justify-center font-display font-bold rounded-full transition-colors',
                    cellSize,
                    isClickable && 'cursor-pointer active:scale-90',
                    isFree
                      ? 'bg-green-500 text-white'
                      : isMarked
                      ? 'bg-rose-500 text-white shadow-md'
                      : isDrawn
                      ? cn(COL_DRAWN_COLORS[col], 'text-foreground')
                      : 'bg-muted/60 text-foreground'
                  )}
                >
                  {isFree ? 'F' : num}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}