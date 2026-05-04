import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { CreditCard, X } from 'lucide-react';
import { BINGO_LETTERS } from '@/lib/bingo';

const HEADER_COLORS = ['bg-emerald-500','bg-rose-500','bg-teal-500','bg-blue-500','bg-orange-500'];

interface PublicCartelaModalProps {
  cartelaId: number;
  onClose: () => void;
  drawnNumbers: Set<number>;
  /** 'banned' | 'claimed' | 'winner' */
  status?: 'banned' | 'claimed' | 'winner';
}

export default function PublicCartelaModal({ cartelaId, onClose, drawnNumbers, status }: PublicCartelaModalProps) {
  const [numbers, setNumbers] = useState<number[][] | null>(null);
  const [phone, setPhone] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('cartelas').select('numbers, owner_id').eq('id', cartelaId).maybeSingle();
      if (cancelled || !data) return;
      setNumbers(data.numbers as number[][]);
      if ((data as any).owner_id) {
        const { data: p } = await supabase.from('profiles').select('phone, display_name').eq('id', (data as any).owner_id).maybeSingle();
        setPhone((p as any)?.display_name || (p as any)?.phone || '');
      }
    })();
    return () => { cancelled = true; };
  }, [cartelaId]);

  const headerColor =
    status === 'winner' ? 'bg-emerald-600' :
    status === 'banned' ? 'bg-destructive' :
    'bg-amber-500';
  const headerLabel =
    status === 'winner' ? '🏆 Winner Card' :
    status === 'banned' ? '🚫 Banned Card' :
    '🎯 BINGO Claim';

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 22, stiffness: 260 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-sm w-full"
      >
        <div className={cn('text-white px-4 py-3', headerColor)}>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            <span className="font-display font-bold text-lg">{headerLabel} — #{cartelaId}</span>
          </div>
          {phone && <div className="text-sm mt-0.5 opacity-95">Player: {phone}</div>}
        </div>

        {numbers ? (
          <div className="px-4 py-4">
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {BINGO_LETTERS.map((l, i) => (
                <div key={l} className={cn('h-8 flex items-center justify-center rounded-md text-white font-display font-bold shadow', HEADER_COLORS[i])}>{l}</div>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: 5 }, (_, row) => (
                Array.from({ length: 5 }, (_, col) => {
                  const num = numbers[row]?.[col] ?? 0;
                  const isFree = row === 2 && col === 2;
                  const isMarked = isFree || drawnNumbers.has(num);
                  return (
                    <div key={`${row}-${col}`} className={cn(
                      'aspect-square w-full rounded-md flex items-center justify-center font-display font-bold text-sm shadow',
                      isFree ? 'bg-orange-500 text-white' : isMarked ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-800 border border-gray-200'
                    )}>{isFree ? 'FREE' : num}</div>
                  );
                })
              ))}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        )}

        <div className="px-4 pb-4 flex justify-center">
          <button onClick={onClose} className="px-6 py-2 rounded-lg bg-rose-50 text-rose-500 font-display font-bold border border-rose-200 active:scale-95">
            <X className="w-4 h-4 inline mr-1" /> Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
