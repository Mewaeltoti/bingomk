import { BINGO_LETTERS } from '@/lib/bingo';
import { cn } from '@/lib/utils';

// Bingo header colors using design tokens for theme consistency
const HEADER_COLORS = [
  'bg-bingo-b text-white',   // B
  'bg-bingo-i text-white',   // I
  'bg-bingo-n text-white',   // N
  'bg-bingo-g text-white',   // G
  'bg-bingo-o text-white',   // O
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
  /** Last drawn number — kept for API compat, no longer rendered as a hint */
  lastDrawn?: number | null;
}

export default function BingoCartela({
  numbers,
  markedCells = new Set(),
  onMarkCell,
  size = 'md',
  onClick,
  selected,
  label,
  banned,
}: BingoCartelaProps) {
  const cellText =
    size === 'xs' ? 'text-[9px]' :
    size === 'sm' ? 'text-xs' :
    size === 'lg' ? 'text-lg' :
    'text-sm';

  const headerText =
    size === 'xs' ? 'text-[9px] py-1' :
    size === 'sm' ? 'text-xs py-1.5' :
    size === 'lg' ? 'text-base py-2' :
    'text-sm py-1.5';

  const handleCellClick = (row: number, col: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (row === 2 && col === 2) return;
    if (!onMarkCell) return;
    onMarkCell(row, col);
  };

  return (
    <div
      className={cn(
        'relative p-2 transition-all duration-200 rounded-2xl',
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

      <div className="grid grid-cols-5 gap-1 mb-1.5">
        {BINGO_LETTERS.map((l, i) => (
          <div
            key={l}
            className={cn(
              'flex items-center justify-center font-display font-bold rounded-md shadow-sm',
              headerText,
              HEADER_COLORS[i]
            )}
          >
            {l}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-1">
        {Array.from({ length: 5 }, (_, row) => (
          Array.from({ length: 5 }, (_, col) => {
            const num = numbers[row]?.[col] ?? 0;
            const isFree = row === 2 && col === 2;
            const isMarked = isFree || markedCells.has(`${row}-${col}`);
            const isClickable = !!onMarkCell && !isFree;

            return (
              <div
                key={`${row}-${col}`}
                onClick={(e) => handleCellClick(row, col, e)}
                className={cn(
                  'relative aspect-square w-full flex items-center justify-center font-display font-bold rounded-md transition-all',
                  cellText,
                  isClickable && 'cursor-pointer active:scale-90',
                  isFree
                    ? 'bg-bingo-free text-white shadow-md'
                    : isMarked
                    ? 'bg-bingo-marked text-white shadow-md'
                    : 'bg-muted/60 text-foreground border border-border'
                )}
              >
                {isFree ? 'F' : num}
              </div>
            );
          })
        ))}
      </div>
    </div>
  );
}
