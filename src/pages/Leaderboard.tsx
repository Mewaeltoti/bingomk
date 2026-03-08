import { useEffect, useState } from 'react';
import PageShell from '@/components/PageShell';
import { Trophy, Medal, Award, History, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface LeaderEntry {
  winner_id: string;
  wins: number;
  total_prize: number;
  display_name: string | null;
  phone: string | null;
}

interface GameHistoryEntry {
  id: string;
  game_id: string;
  pattern: string;
  prize: number;
  players_count: number;
  created_at: string;
  winner_name: string | null;
  drawn_count: number;
}

export default function Leaderboard() {
  const [tab, setTab] = useState<'leaders' | 'history'>('leaders');
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [history, setHistory] = useState<GameHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // Fetch game history with winner profiles
      const { data, error } = await supabase
        .from('game_history')
        .select('*, profiles:winner_id(display_name, phone)')
        .order('created_at', { ascending: false });

      if (error || !data) {
        setLoading(false);
        return;
      }

      // Build history list
      const historyList: GameHistoryEntry[] = (data as any[]).map(row => ({
        id: row.id,
        game_id: row.game_id,
        pattern: row.pattern,
        prize: Number(row.prize) || 0,
        players_count: row.players_count || 0,
        created_at: row.created_at,
        winner_name: row.profiles?.display_name || row.profiles?.phone || null,
        drawn_count: Array.isArray(row.drawn_numbers) ? row.drawn_numbers.length : 0,
      }));
      setHistory(historyList);

      // Aggregate wins by player
      const map = new Map<string, LeaderEntry>();
      for (const row of data as any[]) {
        const id = row.winner_id;
        if (!id) continue;
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
    fetchData();
  }, []);

  const rankIcon = (i: number) => {
    if (i === 0) return <Trophy className="w-5 h-5 text-primary" />;
    if (i === 1) return <Medal className="w-5 h-5 text-muted-foreground" />;
    if (i === 2) return <Award className="w-5 h-5 text-accent" />;
    return <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-muted-foreground">{i + 1}</span>;
  };

  const tabs = [
    { key: 'leaders' as const, label: 'Top Players', icon: Trophy },
    { key: 'history' as const, label: 'Game History', icon: History },
  ];

  return (
    <PageShell title="Leaderboard">
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-colors',
              tab === t.key
                ? 'gradient-gold text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading...</div>
      ) : tab === 'leaders' ? (
        leaders.length === 0 ? (
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
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl',
                  i === 0 ? 'gradient-card border border-primary/30 glow-gold' : 'bg-muted/50'
                )}
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
        )
      ) : (
        /* Game History Tab */
        history.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">No games played yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((game, i) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className="p-3 rounded-xl bg-muted/50 border border-border"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-display font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10">
                    {game.pattern}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(game.created_at), 'MMM d, h:mm a')}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-foreground">
                    <span className="font-medium">
                      {game.winner_name ? `🏆 ${game.winner_name}` : 'No winner'}
                    </span>
                  </div>
                  {game.prize > 0 && (
                    <span className="text-sm font-display font-bold text-primary">
                      {game.prize} ETB
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {game.drawn_count} numbers drawn
                  {game.players_count > 0 && ` · ${game.players_count} players`}
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}
    </PageShell>
  );
}
