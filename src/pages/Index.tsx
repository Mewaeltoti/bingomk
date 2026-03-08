import { motion } from 'framer-motion';
import { Users, Trophy, Zap, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Index() {
  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex-1 flex flex-col px-5">
        {/* Hero */}
        <div className="text-center pt-16 pb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="font-display text-5xl font-bold tracking-tight">
              <span className="text-secondary">Bingo</span>{' '}
              <span className="text-primary">Ethio</span>
            </h1>
            <p className="text-muted-foreground mt-3 text-base">Play. Win. Celebrate.</p>
          </motion.div>
        </div>

        {/* Status Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="gradient-card rounded-2xl p-5 glow-gold mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" />
            <span className="text-secondary text-sm font-semibold">Live Game</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <Users className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
              <div className="font-display text-2xl font-bold text-foreground">24</div>
              <div className="text-xs text-muted-foreground">Players</div>
            </div>
            <div>
              <Trophy className="w-5 h-5 mx-auto text-primary mb-1" />
              <div className="font-display text-2xl font-bold text-primary">2,400</div>
              <div className="text-xs text-muted-foreground">Prize (ETB)</div>
            </div>
            <div>
              <Zap className="w-5 h-5 mx-auto text-accent mb-1" />
              <div className="font-display text-2xl font-bold text-foreground">R3</div>
              <div className="text-xs text-muted-foreground">Round</div>
            </div>
          </div>
        </motion.div>

        {/* Join Button */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
          <Link
            to="/cartelas"
            className="flex items-center justify-center gap-2 w-full py-4 rounded-xl font-display font-bold text-lg gradient-gold text-primary-foreground transition-transform active:scale-95"
          >
            Join Game <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>

        {/* Quick Info */}
        <div className="mt-8 space-y-2 pb-8">
          <h2 className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">How it works</h2>
          {[
            { step: '1', text: 'Deposit funds to your wallet' },
            { step: '2', text: 'Buy a cartela for the game' },
            { step: '3', text: 'Wait for the game to start' },
            { step: '4', text: 'Match the pattern & win!' },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <div className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center font-display font-bold text-primary-foreground text-sm shrink-0">
                {step}
              </div>
              <span className="text-sm text-foreground">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
