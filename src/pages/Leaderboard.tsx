import { useEffect, useState } from 'react';
import PageShell from '@/components/PageShell';
import { Trophy, Medal, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';

interface LeaderEntry {
  winner_id: string;
  wins: number;
  total_prize: number;
  display_name: string | null;
  phone: string | null;
}

export default function Leaderboard() {
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      // Get all game history with winner profiles
      const { data, error } = await supabase
        .from('game_history')
        .select('winner_id, prize, profiles:winner_id(display_name, phone)')
        .not('winner_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error || !data) {
        setLoading(false);
        return;
      }

      // Aggregate wins by player
      const map = new Map<string, LeaderEntry>();
      for (const row of data as any[]) {
        const id = row.winner_id;
        if (!map.has(id)) {
          map.set(id, {
            winner_id: id,
            wins: 0,
            total_prize: 0,
            display_name: row.profiles?.display_name || null,
            phone: row.profiles?.phone || null,
          });
        }
        const entry = map.get(id)!;
        entry.wins += 1;
        entry.total_prize += Number(row.prize) || 0;
      }

      const sorted = Array.from(map.values()).sort((a, b) => b.wins - a.wins);
      setLeaders(sorted);
      setLoading(false);
    }
    fetchLeaderboard();
  }, []);

  const rankIcon = (i: number) => {
    if (i === 0) return <Trophy className="w-5 h-5 text-primary" />;
    if (i === 1) return <Medal className="w-5 h-5 text-muted-foreground" />;
    if (i === 2) return <Award className="w-5 h-5 text-accent" />;
    return <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-muted-foreground">{i + 1}</span>;
  };

  return (
    <PageShell title="Leaderboard">
      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading...</div>
      ) : leaders.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No winners yet. Be the first!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaders.map((entry, i) => (
            <motion.div
              key={entry.winner_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-3 p-3 rounded-xl ${
                i === 0 ? 'gradient-card border border-primary/30 glow-gold' : 'bg-muted/50'
              }`}
            >
              <div className="flex-shrink-0">{rankIcon(i)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {entry.display_name || entry.phone || 'Anonymous'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {entry.wins} win{entry.wins !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-display font-bold text-primary">
                  {entry.total_prize} ETB
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
