import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPatternCells } from '@/lib/winDetection';

interface PatternHelpModalProps {
  open: boolean;
  onClose: () => void;
  gamePattern: string;
}

export function PatternHelpModal({ open, onClose, gamePattern }: PatternHelpModalProps) {
  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}
        onClick={e => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-foreground text-lg">How to win</h3>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg bg-muted text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-center space-y-2">
          <div className="text-xs text-muted-foreground">Winning pattern this round</div>
          <div className="font-display font-bold text-primary text-xl">{gamePattern}</div>
          <div className="flex justify-center py-2">
            <div className="grid grid-cols-5 gap-1 p-3 rounded-xl bg-muted/40 border border-border">
              {getPatternCells(gamePattern).flat().map((on, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-bold',
                    on ? 'bg-primary text-primary-foreground shadow' : 'bg-card text-muted-foreground border border-border'
                  )}
                >
                  {i === 12 ? 'F' : ''}
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Mark the highlighted cells on your cartela to win.
          </p>
        </div>

        <div className="space-y-2 text-sm text-foreground">
          <p className="font-bold">How to play</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs text-muted-foreground">
            <li>Buy one or more cartelas during the buying phase.</li>
            <li>When numbers are called, tap the matching cells on your cartela to mark them.</li>
            <li>The center <span className="font-bold text-foreground">F</span> cell is free.</li>
            <li>When your marked cells match the pattern above, tap <span className="font-bold text-primary">BINGO!</span></li>
          </ol>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default PatternHelpModal;
