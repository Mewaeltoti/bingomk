import { ChevronDown, ChevronUp } from 'lucide-react';

interface GameInfoPanelProps {
  boardOpen: boolean;
  onToggle: () => void;
  gamePattern: string;
  sessionNumber: number;
  cartelaPrice: number;
  prizeAmount: number;
}

export function GameInfoPanel({
  boardOpen,
  onToggle,
  gamePattern,
  sessionNumber,
  cartelaPrice,
  prizeAmount,
}: GameInfoPanelProps) {
  return (
    <>
      {/* Show More / Less toggle */}
      <div className="flex justify-end">
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-rose-500 text-sm font-bold active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          {boardOpen ? (
            <><ChevronUp className="w-4 h-4" /> Show Less</>
          ) : (
            <><ChevronDown className="w-4 h-4" /> Show More</>
          )}
        </button>
      </div>

      {/* Collapsible game info */}
      {boardOpen && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2 text-sm">
            <span className="text-primary">&#10022;</span>
            <span className="text-muted-foreground">Game:</span>
            <span className="font-bold text-foreground">{gamePattern}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 px-4 py-3 text-xs">
            <div>
              <span className="text-muted-foreground">ID: </span>
              <span className="font-mono text-foreground">#{sessionNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground">Status: </span>
              <span className="font-bold text-emerald-600">Playing</span>
            </div>
            <div>
              <span className="text-muted-foreground">Price: </span>
              <span className="font-bold text-emerald-600">${cartelaPrice}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground">Prize: </span>
              <span className="font-bold text-amber-500">${prizeAmount}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default GameInfoPanel;
