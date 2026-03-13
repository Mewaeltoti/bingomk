import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Index() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="flex-1 flex flex-col items-center justify-center px-5 max-w-sm w-full">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="font-display text-4xl font-black tracking-tight mb-2">
            <span className="text-primary">BINGO</span>{' '}
            <span className="text-secondary">ETHIO</span>
          </h1>
          <p className="text-muted-foreground text-sm">Play. Win. Celebrate.</p>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="w-full space-y-3">
          <Link
            to="/game"
            className="flex items-center justify-center gap-2 w-full py-4 rounded-lg font-display font-bold text-lg gradient-neon text-primary-foreground transition-transform active:scale-95 glow-neon"
          >
            Play Now <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="flex gap-2">
            <Link to="/login" className="flex-1 py-3 rounded-lg bg-muted text-muted-foreground text-center text-sm font-medium">
              Login
            </Link>
            <Link to="/signup" className="flex-1 py-3 rounded-lg bg-secondary/20 text-secondary text-center text-sm font-medium">
              Sign Up
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
