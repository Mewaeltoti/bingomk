import { BINGO_LETTERS } from '@/lib/bingo';
import { cn } from '@/lib/utils';
import { Heart } from 'lucide-react';

interface BingoCartelaProps {
  numbers: number[][];
  markedNumbers?: Set<number>;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  selected?: boolean;
  isFavorite?: boolean;
  onFavorite?: () => void;
  label?: string;
}

export default function BingoCartela({
  numbers,
  markedNumbers = new Set(),
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
              const isMarked = isFree || markedNumbers.has(num);

              return (
                <div
                  key={`${row}-${col}`}
                  className={cn(
                    'bingo-cell border-r border-border last:border-r-0',
                    cellSize,
                    isFree
                      ? 'bingo-cell-free'
                      : isMarked
                      ? 'bingo-cell-marked'
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
