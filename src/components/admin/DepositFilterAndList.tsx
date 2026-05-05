import { useState, useMemo } from 'react';
import { Check, X, Sparkles, AlertTriangle } from 'lucide-react';
import { referencesMatch, type ParsedSms } from '@/lib/smsParser';
import { cn } from '@/lib/utils';

type DepositStatus = 'pending' | 'auto_verified' | 'needs_review' | 'approved' | 'rejected';

const FILTERS: { key: 'all' | DepositStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'auto_verified', label: 'Auto-verified' },
  { key: 'needs_review', label: 'Needs review' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-primary/20 text-primary',
  auto_verified: 'bg-emerald-500/20 text-emerald-400',
  needs_review: 'bg-amber-500/20 text-amber-400',
  approved: 'bg-secondary/20 text-secondary',
  rejected: 'bg-destructive/20 text-destructive',
};

export default function DepositFilterAndList({
  deposits,
  parsedSms,
  actionLoading,
  onAction,
}: {
  deposits: any[];
  parsedSms: ParsedSms | null;
  actionLoading: string | null;
  onAction: (id: string, action: 'approved' | 'rejected', userId: string, amount: number) => void;
}) {
  const [filter, setFilter] = useState<'all' | DepositStatus>('all');

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const d of deposits) c[d.status] = (c[d.status] || 0) + 1;
    return c;
  }, [deposits]);

  const filtered = useMemo(
    () => (filter === 'all' ? deposits : deposits.filter((d) => d.status === filter)),
    [deposits, filter]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-semibold transition-colors',
              filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {f.label}
            {f.key !== 'all' && counts[f.key] ? ` (${counts[f.key]})` : ''}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No deposits</p>
      )}

      {filtered.map((d) => {
        const refMatch = parsedSms ? referencesMatch(parsedSms.reference, d.reference) : false;
        const amountMatch = parsedSms?.amount != null && Number(parsedSms.amount) === Number(d.amount);
        const isStrongMatch = d.status === 'pending' && refMatch && amountMatch;
        const canActOn = d.status === 'pending' || d.status === 'auto_verified' || d.status === 'needs_review';
        const isAuto = d.status === 'auto_verified';
        const isReview = d.status === 'needs_review';
        return (
          <div
            key={d.id}
            className={cn(
              'p-3 rounded-xl space-y-2 transition-all',
              isStrongMatch ? 'bg-primary/15 border-2 border-primary shadow-lg shadow-primary/20' :
              isAuto ? 'bg-emerald-500/5 border border-emerald-500/40' :
              isReview ? 'bg-amber-500/5 border border-amber-500/40' :
              'bg-muted/50'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                  {d.bank} — {d.amount} ETB
                  {isStrongMatch && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                      <Sparkles className="w-3 h-3" /> SMS MATCH
                    </span>
                  )}
                  {isAuto && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                      <Sparkles className="w-3 h-3" /> AUTO-VERIFIED
                    </span>
                  )}
                  {isReview && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                      <AlertTriangle className="w-3 h-3" /> REVIEW
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  Ref: <span className={refMatch ? 'text-primary font-semibold' : ''}>{d.reference}</span> · {d.profile?.display_name || d.profile?.phone || 'Unknown'}
                </div>
              </div>
              <span className={cn('text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap', STATUS_STYLES[d.status] || 'bg-muted')}>
                {d.status}
              </span>
            </div>
            {canActOn && (
              <div className="flex gap-2">
                <button
                  onClick={() => onAction(d.id, 'approved', d.user_id, Number(d.amount))}
                  disabled={actionLoading === `dep-${d.id}`}
                  className="flex-1 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {actionLoading === `dep-${d.id}` ? '⏳...' : <><Check className="w-4 h-4" /> Approve</>}
                </button>
                <button
                  onClick={() => onAction(d.id, 'rejected', d.user_id, Number(d.amount))}
                  disabled={actionLoading === `dep-${d.id}`}
                  className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {actionLoading === `dep-${d.id}` ? '⏳...' : <><X className="w-4 h-4" /> Reject</>}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
