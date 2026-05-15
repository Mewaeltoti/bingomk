import { motion } from 'framer-motion';

interface ClaimBannersProps {
  activeClaimId: number | null;
  activeWinnerId: number | null;
  publicBannedIds: number[];
  onViewCartela: (id: number, status: 'banned' | 'claimed' | 'winner') => void;
}

export function ClaimBanners({
  activeClaimId,
  activeWinnerId,
  publicBannedIds,
  onViewCartela,
}: ClaimBannersProps) {
  return (
    <>
      {/* GLOBAL BINGO claim banner */}
      {activeClaimId !== null && (
        <motion.button
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          onClick={() => onViewCartela(activeClaimId, 'claimed')}
          className="w-full p-3 rounded-xl bg-amber-500/15 border-2 border-amber-500 text-left flex items-center gap-3 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="text-2xl">
            <span role="img" aria-label="Target">&#127919;</span>
          </motion.span>
          <div className="flex-1">
            <div className="font-display font-bold text-amber-600 text-sm">BINGO claimed - verifying!</div>
            <div className="text-xs text-muted-foreground">Tap to view Cartela #{activeClaimId}</div>
          </div>
        </motion.button>
      )}

      {/* Winner confirmed banner */}
      {activeWinnerId !== null && (
        <motion.button
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          onClick={() => onViewCartela(activeWinnerId, 'winner')}
          className="w-full p-3 rounded-xl bg-emerald-500/15 border-2 border-emerald-500 text-left flex items-center gap-3 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-2xl" role="img" aria-label="Trophy">&#127942;</span>
          <div className="flex-1">
            <div className="font-display font-bold text-emerald-600 text-sm">Winner confirmed!</div>
            <div className="text-xs text-muted-foreground">Tap to view Cartela #{activeWinnerId}</div>
          </div>
        </motion.button>
      )}

      {/* Banned cartelas */}
      {publicBannedIds.length > 0 && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30">
          <div className="text-xs font-bold text-destructive mb-2">
            <span role="img" aria-label="Banned">&#128683;</span> Banned cartelas this round:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {publicBannedIds.map(id => (
              <button
                key={id}
                onClick={() => onViewCartela(id, 'banned')}
                className="px-2 py-1 rounded-md bg-destructive/20 text-destructive text-xs font-bold active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                #{id}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default ClaimBanners;
