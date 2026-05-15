import { Eye, Wallet, Settings, CircleHelp as HelpCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { t } from '@/lib/i18n';

interface GameHeaderProps {
  sessionNumber: number;
  isSpectator: boolean;
  hasPendingClaim: boolean;
  balance: number;
  onSettingsClick: () => void;
  onHelpClick: () => void;
}

export function GameHeader({
  sessionNumber,
  isSpectator,
  hasPendingClaim,
  balance,
  onSettingsClick,
  onHelpClick,
}: GameHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-3 py-2 flex items-center justify-between gap-2">
      <div className="min-w-0 flex items-center gap-1.5">
        <h1 className="font-display text-sm font-bold text-primary leading-none">{t('bingo')}</h1>
        <span className="shrink-0 text-[10px] font-display font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded leading-none">
          #{sessionNumber}
        </span>
        <button
          onClick={onHelpClick}
          className="shrink-0 p-1 rounded-full bg-primary/10 text-primary active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="How to play"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        {isSpectator && (
          <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">
            <Eye className="w-3 h-3 inline" />
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {hasPendingClaim && (
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="px-2 py-1 rounded-lg bg-accent/15 border border-accent/30 text-[10px] font-bold text-accent flex items-center gap-1"
          >
            <motion.span
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-1.5 h-1.5 rounded-full bg-accent inline-block"
            />
            Verifying
          </motion.div>
        )}
        <button 
          onClick={() => navigate('/payment')} 
          className="rounded-lg bg-primary/10 px-2 py-1.5 text-[11px] font-display font-bold text-primary flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Wallet className="w-3.5 h-3.5" /> {balance}
        </button>
        <button 
          onClick={onSettingsClick} 
          className="relative rounded-lg bg-muted p-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

export default GameHeader;
