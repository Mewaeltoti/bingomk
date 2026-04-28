import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CreditCard, X } from 'lucide-react';
import { BINGO_LETTERS } from '@/lib/bingo';

const HEADER_COLORS = [
  'bg-emerald-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-blue-500',
  'bg-orange-500',
];

interface CartelaDetailModalProps {
  open: boolean;
  onClose: () => void;
  cartelaId: number;
  numbers: number[][];
  phone?: string;
  drawnNumbers: Set<number>;
  markedCells: Set<string>;
  lastDrawn?: number | null;
  onMarkCell?: (row: number, col: number) => void;
}

export default function CartelaDetailModal({
  open,
  onClose,
  cartelaId,
  numbers,
  phone,
  drawnNumbers,
  markedCells,
  lastDrawn,
  onMarkCell,
}: CartelaDetailModalProps) {
  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 22, stiffness: 260 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-sm w-full"
      >
        {/* Red header */}
        <div className="bg-rose-500 text-white px-4 py-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            <span className="font-display font-bold text-lg">Card: {cartelaId}</span>
          </div>
          {phone && (
            <div className="text-sm mt-0.5 opacity-95">Phone: {phone}</div>
          )}
          {lastDrawn != null && (
            <div className="mt-2 inline-block bg-amber-400 text-rose-900 font-display font-bold text-sm px-3 py-1 rounded-md shadow">
              Last number: {lastDrawn}
            </div>
          )}
        </div>

        {/* BINGO header pills */}
        <div className="px-4 pt-4">
          <div className="grid grid-cols-5 gap-2">
            {BINGO_LETTERS.map((l, i) => (
              <div
                key={l}
                className={cn(
                  'h-10 flex items-center justify-center rounded-lg text-white font-display font-bold text-xl shadow',
                  HEADER_COLORS[i]
                )}
              >
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* Number grid — big circles */}
        <div className="px-4 py-4">
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, row) => (
              <div key={row} className="grid grid-cols-5 gap-2">
                {Array.from({ length: 5 }, (_, col) => {
                  const num = numbers[row]?.[col] ?? 0;
                  const isFree = row === 2 && col === 2;
                  const isMarked = isFree || markedCells.has(`${row}-${col}`);
                  const isDrawn = drawnNumbers.has(num);
                  const isLast = !isFree && lastDrawn != null && num === lastDrawn;
                  const isClickable = onMarkCell && isDrawn && !isFree;

                  return (
                    <button
                      key={`${row}-${col}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isClickable) onMarkCell!(row, col);
                      }}
                      disabled={!isClickable && !isFree}
                      className={cn(
                        'aspect-square w-full rounded-lg flex items-center justify-center font-display font-bold text-base shadow-md transition-all',
                        isClickable && 'active:scale-90 cursor-pointer',
                        isFree
                          ? 'bg-orange-500 text-white text-sm'
                          : isLast
                          ? 'bg-orange-500 text-white ring-4 ring-rose-500 shadow-lg'
                          : isMarked
                          ? 'bg-emerald-500 text-white'
                          : 'bg-white text-gray-800 border border-gray-200'
                      )}
                    >
                      {isFree ? 'FREE' : num}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Close button */}
        <div className="px-4 pb-4 flex justify-center">
          <button
            onClick={onClose}
            className="px-8 py-2 rounded-lg bg-rose-50 text-rose-500 font-display font-bold border border-rose-200 active:scale-95 transition-transform"
          >
            <X className="w-4 h-4 inline mr-1" />
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
