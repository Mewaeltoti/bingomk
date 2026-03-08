import { BINGO_LETTERS } from '@/lib/bingo';
import { cn } from '@/lib/utils';
import { Heart } from 'lucide-react';
// lightweight: no framer-motion

interface BingoCartelaProps {
  numbers: number[][];
  /** Set of drawn numbers — used to gate clicks */
  drawnNumbers?: Set<number>;
  /** Set of "row-col" strings the player has marked */
  markedCells?: Set<string>;
  /** Called with (row, col) when a valid cell is tapped */
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

  const handleCellClick = (num: number, row: number, col: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (row === 2 && col === 2) return; // free cell
    if (!onMarkCell) return;
    // Only allow marking if the number has been drawn
    if (!drawnNumbers.has(num)) return;
    onMarkCell(row, col);
  };

  return (
    <div
      className={cn(
        'relative rounded-xl border-2 p-1 transition-all duration-200 bg-card',
        selected ? 'border-primary glow-gold' : 'border-border',
        onClick && 'cursor-pointer active:scale-[0.98]'
      )}
      onClick={onClick}
    >
      {label && (
        <div className="text-center text-[10px] font-display text-muted-foreground mb-0.5">{label}</div>
      )}
      {onFavorite && (
        <button
          onClick={(e) => { e.stopPropagation(); onFavorite(); }}
          className="absolute top-1 right-1 p-0.5 z-10"
        >
          <Heart className={cn('w-3.5 h-3.5', isFavorite ? 'fill-destructive text-destructive' : 'text-muted-foreground')} />
        </button>
      )}
      {/* Header */}
      <div className="grid grid-cols-5 gap-0.5 mb-0.5">
        {BINGO_LETTERS.map((l) => (
          <div key={l} className={cn('flex items-center justify-center font-display font-bold text-primary text-xs', size === 'sm' && 'text-[10px]')}>
            {l}
          </div>
        ))}
      </div>
      {/* Grid */}
      <div className="rounded-md overflow-hidden">
        {Array.from({ length: 5 }, (_, row) => (
          <div key={row} className="grid grid-cols-5 gap-0.5">
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
                    'flex items-center justify-center font-display font-bold rounded transition-colors',
                    cellSize,
                    isClickable && 'cursor-pointer active:scale-90',
                    isFree
                      ? 'bg-secondary text-secondary-foreground'
                      : isMarked
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-muted text-foreground'
                  )}
                >
                  {isFree ? '★' : num}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}