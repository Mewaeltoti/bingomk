import { motion } from 'framer-motion';
import { CheckCircle, Ban, Trophy, Star } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface WinnerSummaryPanelProps {
  ownedCartelas: number[];
  bannedCartelas: number[];
  winnerCartelas: number[];
  finished?: boolean;
}

/**
 * Post-game summary: Bingo Cards / Blocked / Winners — matches reference image 3.
 */
export default function WinnerSummaryPanel({
  ownedCartelas,
  bannedCartelas,
  winnerCartelas,
  finished = true,
}: WinnerSummaryPanelProps) {
  const [showAllBlocked, setShowAllBlocked] = useState(false);
  const visibleBlocked = showAllBlocked ? bannedCartelas : bannedCartelas.slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      {/* Bingo Cards (owned) */}
      {ownedCartelas.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-card border border-border">
          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
          <span className="text-sm font-bold text-foreground">Bingo Cards:</span>
          <div className="flex flex-wrap gap-1.5">
            {ownedCartelas.map((id) => (
              <span
                key={id}
                className="px-3 py-1 rounded-md bg-emerald-500 text-white font-display font-bold text-xs"
              >
                {id}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Blocked (banned) */}
      {bannedCartelas.length > 0 && (
        <div className="flex items-start gap-3 px-3 py-3 rounded-xl bg-card border border-border">
          <Ban className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-start flex-wrap gap-1.5">
              <span className="text-sm font-bold text-foreground mr-1">Blocked:</span>
              {visibleBlocked.map((id) => (
                <span
                  key={id}
                  className="px-3 py-1 rounded-md bg-rose-500 text-white font-display font-bold text-xs"
                >
                  {id}
                </span>
              ))}
              {bannedCartelas.length > 4 && (
                <button
                  onClick={() => setShowAllBlocked(!showAllBlocked)}
                  className="px-3 py-1 rounded-md bg-blue-500 text-white text-xs font-bold active:scale-95"
                >
                  {showAllBlocked ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Winners */}
      {winnerCartelas.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-card border border-border">
          <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
          <span className="text-sm font-bold text-foreground">Winners:</span>
          <div className="flex flex-wrap gap-1.5">
            {winnerCartelas.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-amber-400 text-amber-900 font-display font-bold text-xs"
              >
                <Star className="w-3 h-3 fill-amber-900" />
                {id}
              </span>
            ))}
          </div>
        </div>
      )}

      {finished && (
        <div className="text-center py-2 text-rose-500 font-bold text-sm">
          Bingo window finished!
        </div>
      )}
    </motion.div>
  );
}

/**
 * Floating right-edge stack of countdown/milestone balls (10/5/3/2/1).
 * Decorative — matches reference image 3.
 */
export function FloatingBallsStack() {
  const balls = [10, 5, 3, 2, 1];
  return (
    <div className="fixed right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-3 pointer-events-none">
      {balls.map((n, i) => (
        <motion.div
          key={n}
          initial={{ x: 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: i * 0.08, type: 'spring', damping: 18 }}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center text-white font-display font-bold shadow-xl',
            'bg-gradient-to-br from-orange-400 to-rose-500 ring-2 ring-white/40'
          )}
        >
          {n}
        </motion.div>
      ))}
    </div>
  );
}
