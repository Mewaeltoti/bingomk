import { motion } from 'framer-motion';
import { ArrowRight, Shield, Smartphone, TimerReset } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Index() {
  return (
    <div className="min-h-screen bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <section className="bg-hero-bingo min-h-screen px-5 py-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center gap-8">
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.45 }}
            className="max-w-2xl"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-primary">Mobile-first Bingo</p>
            <h1 className="font-display text-4xl font-black tracking-tight md:text-6xl">
              <span className="text-primary">BINGO</span>{' '}
              <span className="text-secondary">ETHIO</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
              Fast rounds, automatic checking, locked cartelas, and a clean experience built for phones first.
            </p>
          </motion.div>

          <motion.div initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-end">
            <div className="space-y-3">
              <Link
                to="/game"
                className="flex w-full items-center justify-center gap-2 rounded-2xl gradient-neon px-6 py-4 font-display text-lg font-bold text-primary-foreground transition-transform active:scale-95 glow-neon sm:w-fit"
              >
                Play Now <ArrowRight className="w-5 h-5" />
              </Link>
              <div className="flex gap-2">
                <Link to="/login" className="flex-1 rounded-xl bg-card/80 px-4 py-3 text-center text-sm font-medium text-foreground backdrop-blur-sm">
                  Login
                </Link>
                <Link to="/signup" className="flex-1 rounded-xl bg-secondary/20 px-4 py-3 text-center text-sm font-medium text-secondary backdrop-blur-sm">
                  Sign Up
                </Link>
              </div>
            </div>

            <div className="grid gap-3 rounded-3xl border border-border bg-card/70 p-4 backdrop-blur-sm sm:grid-cols-3 md:grid-cols-1">
              {[
                { icon: TimerReset, title: 'Auto sessions', text: 'Finished rounds archive and restart fresh.' },
                { icon: Shield, title: 'Safe purchases', text: 'One cartela can never be sold twice.' },
                { icon: Smartphone, title: 'Mobile ready', text: 'Large tap targets and simple gameplay.' },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-border bg-background/50 p-4">
                  <Icon className="mb-3 w-5 h-5 text-primary" />
                  <h2 className="font-display text-sm font-bold text-foreground">{title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
