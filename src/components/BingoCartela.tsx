import { BINGO_LETTERS } from '@/lib/bingo';
import { cn } from '@/lib/utils';

interface BingoCartelaProps {
  numbers: number[][];
  drawnNumbers?: Set<number>;
  markedCells?: Set<string>;
  onMarkCell?: (row: number, col: number) => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  selected?: boolean;
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
  label,
}: BingoCartelaProps) {
  const cellSize =
    size === 'xs' ? 'text-[8px] w-5 h-5' :
    size === 'sm' ? 'text-xs w-10 h-10' :
    size === 'lg' ? 'text-lg w-14 h-14' :
    'text-sm w-12 h-12';

  const headerSize =
    size === 'xs' ? 'text-[8px] w-5 h-5' :
    size === 'sm' ? 'text-[10px] w-10 h-7' :
    size === 'lg' ? 'text-base w-14 h-9' :
    'text-sm w-12 h-8';

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
        'rounded-2xl border-2 p-1.5 transition-all bg-card',
        selected ? 'border-primary shadow-md' : 'border-border',
        onClick && 'cursor-pointer active:scale-[0.98]'
      )}
      onClick={onClick}
    >
      {label && (
        <div className="text-center text-[10px] font-bold text-primary mb-1">{label}</div>
      )}
      {/* BINGO Header */}
      <div className="grid grid-cols-5 gap-1 mb-1">
        {BINGO_LETTERS.map((l) => (
          <div key={l} className={cn('flex items-center justify-center font-bold text-muted-foreground', headerSize)}>
            {l}
          </div>
        ))}
      </div>
      {/* Grid */}
      <div className="space-y-1">
        {Array.from({ length: 5 }, (_, row) => (
          <div key={row} className="grid grid-cols-5 gap-1">
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
                    'flex items-center justify-center font-bold rounded-lg transition-all',
                    cellSize,
                    isClickable && 'cursor-pointer active:scale-90',
                    isFree
                      ? 'bg-primary/10 text-primary'
                      : isMarked
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : isDrawn
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-muted text-foreground border border-border'
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
