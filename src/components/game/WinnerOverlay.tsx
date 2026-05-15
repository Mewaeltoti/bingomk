import { motion } from 'framer-motion';
import BingoCartela from '@/components/BingoCartela';
import { t } from '@/lib/i18n';

interface GameResult {
  type: 'winner' | 'split' | 'disqualified';
  message: string;
  winnerCartela?: number[][];
}

interface WinnerOverlayProps {
  show: boolean;
  gameResult: GameResult | null;
  drawnSet: Set<number>;
  nextGameCountdown: number;
  onDismiss: () => void;
}

export function WinnerOverlay({
  show,
  gameResult,
  drawnSet,
  nextGameCountdown,
  onDismiss,
}: WinnerOverlayProps) {
  if (!show || !gameResult) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0.8 }} animate={{ scale: 1 }}
        className="text-center p-6 rounded-xl bg-card border-2 border-primary max-w-xs mx-4 glow-neon"
      >
        <div className="text-5xl mb-3">
          {gameResult.type === 'winner' ? (
            <span role="img" aria-label="Trophy">&#127942;</span>
          ) : (
            <span role="img" aria-label="Refresh">&#128260;</span>
          )}
        </div>
        <h2 className="text-xl font-display font-bold text-primary mb-1">
          {gameResult.type === 'disqualified' ? 'RESTART' : t('bingo') + '!'}
        </h2>
        <p className="text-muted-foreground text-sm mb-3">{gameResult.message}</p>
        {gameResult.winnerCartela && (
          <div className="flex justify-center">
            <BingoCartela numbers={gameResult.winnerCartela} drawnNumbers={drawnSet} size="sm" label="Winner's Card" />
          </div>
        )}
        {nextGameCountdown > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            {t('nextGameIn')} <span className="text-primary font-bold">{nextGameCountdown}</span> {t('seconds')}
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}

export default WinnerOverlay;
