import { Eye, Hand } from 'lucide-react';
import BingoCartela from '@/components/BingoCartela';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

interface PlayerCartelasProps {
  playerCartelas: any[];
  drawnSet: Set<number>;
  markedMap: Map<number, Set<string>>;
  claimedCartelas: Set<number>;
  bannedCartelas: Set<number>;
  isSpectator: boolean;
  lastNumber?: number;
  onMarkCell: (cartelaId: number, row: number, col: number) => void;
  onClaimBingo: (cartelaId: number) => void;
  onCartelaClick: (cartelaId: number) => void;
}

export function PlayerCartelas({
  playerCartelas,
  drawnSet,
  markedMap,
  claimedCartelas,
  bannedCartelas,
  isSpectator,
  lastNumber,
  onMarkCell,
  onClaimBingo,
  onCartelaClick,
}: PlayerCartelasProps) {
  if (playerCartelas.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Eye className="w-6 h-6 mx-auto mb-2 opacity-40" />
        <p className="text-sm">{t('noCartelas')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {playerCartelas.map(c => {
        const cellsMarked = markedMap.get(c.id) || new Set<string>();
        const isClaimed = claimedCartelas.has(c.id);
        const isBanned = bannedCartelas.has(c.id) || c.banned_for_game;
        
        return (
          <div key={c.id} className="flex flex-col gap-2">
            <BingoCartela
              numbers={c.numbers as number[][]}
              drawnNumbers={drawnSet}
              markedCells={cellsMarked}
              onMarkCell={isSpectator || isBanned ? undefined : (row, col) => onMarkCell(c.id, row, col)}
              onClick={() => onCartelaClick(c.id)}
              size="sm"
              label={`#${c.id}`}
              banned={isBanned}
              lastDrawn={lastNumber}
            />
            {!isSpectator && (
              <button 
                onClick={() => onClaimBingo(c.id)} 
                disabled={isClaimed || isBanned}
                className={cn(
                  'w-full py-3 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isBanned 
                    ? 'bg-destructive/15 text-destructive border border-destructive/30' 
                    : isClaimed 
                    ? 'bg-muted text-muted-foreground' 
                    : 'gradient-neon text-primary-foreground glow-neon'
                )}
              >
                <Hand className="w-4 h-4" />
                {isBanned ? 'Banned' : isClaimed ? t('verifying') : t('bingo') + '!'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default PlayerCartelas;
