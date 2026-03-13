import { BINGO_LETTERS } from '@/lib/bingo';
import { cn } from '@/lib/utils';

const HEADER_COLORS = [
  'bg-neon-blue text-white',
  'bg-neon-pink text-white',
  'bg-neon-green text-primary-foreground',
  'bg-neon-yellow text-primary-foreground',
  'bg-neon-purple text-white',
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
    size === 'sm' ? 'text-xs w-9 h-9' :
    size === 'lg' ? 'text-base w-12 h-12' :
    'text-sm w-10 h-10';

  const headerSize =
    size === 'xs' ? 'text-[8px] w-5 h-5' :
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
        'relative border-2 p-1 transition-all duration-200 bg-card',
        selected ? 'border-primary glow-neon' : 'border-border',
        onClick && 'cursor-pointer active:scale-[0.98]'
      )}
      onClick={onClick}
    >
      {label && (
        <div className="text-center text-[10px] font-display font-bold text-primary mb-0.5">{label}</div>
      )}
      {/* BINGO Header */}
      <div className="grid grid-cols-5 gap-px mb-px">
        {BINGO_LETTERS.map((l, i) => (
          <div
            key={l}
            className={cn(
              'flex items-center justify-center font-display font-bold',
              headerSize,
              HEADER_COLORS[i]
            )}
          >
            {l}
          </div>
        ))}
      </div>
      {/* Grid with square cells */}
      <div>
        {Array.from({ length: 5 }, (_, row) => (
          <div key={row} className="grid grid-cols-5 gap-px mb-px last:mb-0">
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
                    'flex items-center justify-center font-display font-bold transition-colors border border-border/30',
                    cellSize,
                    isClickable && 'cursor-pointer active:scale-90',
                    isFree
                      ? 'bg-secondary text-secondary-foreground'
                      : isMarked
                      ? 'bg-primary text-primary-foreground shadow-[0_0_8px_hsl(160_100%_50%/0.4)]'
                      : 'bg-muted/60 text-foreground'
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
