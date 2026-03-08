import { BINGO_LETTERS } from '@/lib/bingo';
import { cn } from '@/lib/utils';
import { Heart } from 'lucide-react';
import { playMarkSound } from '@/lib/sounds';

interface BingoCartelaProps {
  numbers: number[][];
  drawnNumbers?: Set<number>;
  playerMarked?: Set<number>;
  onMarkNumber?: (num: number) => void;
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
  playerMarked = new Set(),
  onMarkNumber,
  size = 'md',
  onClick,
  selected,
  isFavorite,
  onFavorite,
  label,
}: BingoCartelaProps) {
  const cellSize =
    size === 'xs' ? 'text-[9px] w-5 h-5' :
    size === 'sm' ? 'text-xs w-8 h-8' :
    size === 'lg' ? 'text-base w-12 h-12' :
    'text-sm w-10 h-10';

  const handleCellClick = (num: number, row: number, col: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (row === 2 && col === 2) return; // free space
    if (!onMarkNumber) return;
    if (!drawnNumbers.has(num)) return; // can only mark drawn numbers
    onMarkNumber(num);
    playMarkSound();
  };

  return (
    <div
      className={cn(
        'relative rounded-xl border-2 p-1.5 transition-all duration-200 gradient-card',
        selected ? 'border-primary glow-gold' : 'border-border hover:border-muted-foreground',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      {label && (
        <div className="text-center text-[10px] font-display text-muted-foreground mb-0.5">{label}</div>
      )}
      {onFavorite && (
        <button
          onClick={(e) => { e.stopPropagation(); onFavorite(); }}
          className="absolute top-0.5 right-0.5 p-0.5 z-10"
        >
          <Heart className={cn('w-3 h-3', isFavorite ? 'fill-red-eth text-red-eth' : 'text-muted-foreground')} />
        </button>
      )}
      {/* Header */}
      <div className="grid grid-cols-5 gap-0.5 mb-0.5">
        {BINGO_LETTERS.map((l) => (
          <div key={l} className={cn('flex items-center justify-center font-display font-bold text-primary', cellSize)}>
            {l}
          </div>
        ))}
      </div>
      {/* Grid */}
      <div className="border border-border rounded-md overflow-hidden">
        {Array.from({ length: 5 }, (_, row) => (
          <div key={row} className="grid grid-cols-5 border-b border-border last:border-b-0">
            {Array.from({ length: 5 }, (_, col) => {
              const num = numbers[row]?.[col] ?? 0;
              const isFree = row === 2 && col === 2;
              const isDrawn = drawnNumbers.has(num);
              const isMarked = isFree || playerMarked.has(num);
              // Wrong mark: player marked but number wasn't drawn
              const isWrongMark = !isFree && playerMarked.has(num) && !isDrawn;

              return (
                <div
                  key={`${row}-${col}`}
                  onClick={(e) => handleCellClick(num, row, col, e)}
                  className={cn(
                    'bingo-cell border-r border-border last:border-r-0 transition-all',
                    cellSize,
                    onMarkNumber && isDrawn && !isMarked && 'cursor-pointer hover:bg-primary/10',
                    isFree
                      ? 'bingo-cell-free'
                      : isWrongMark
                      ? 'bg-destructive/30 text-destructive'
                      : isMarked
                      ? 'bingo-cell-marked'
                      : isDrawn
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'bingo-cell-default'
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
