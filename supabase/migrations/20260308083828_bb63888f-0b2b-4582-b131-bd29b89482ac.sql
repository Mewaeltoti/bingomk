
-- Track game history for leaderboard
CREATE TABLE public.game_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL,
  winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pattern text NOT NULL DEFAULT 'Full House',
  prize numeric NOT NULL DEFAULT 0,
  players_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.game_history ENABLE ROW LEVEL SECURITY;

-- Anyone can read game history
CREATE POLICY "Anyone can read game_history" ON public.game_history
  FOR SELECT TO authenticated
  USING (true);

-- Only admins can insert game history
CREATE POLICY "Admins can insert game_history" ON public.game_history
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read all profiles for leaderboard display
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
