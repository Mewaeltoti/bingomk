
-- Cartelas table
CREATE TABLE public.cartelas (
  id serial PRIMARY KEY,
  numbers jsonb NOT NULL,
  is_used boolean NOT NULL DEFAULT false,
  owner_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cartelas ENABLE ROW LEVEL SECURITY;

-- Anyone can read available cartelas
CREATE POLICY "Anyone can read cartelas" ON public.cartelas
  FOR SELECT USING (true);

-- Authenticated users can update (buy) cartelas
CREATE POLICY "Authenticated users can buy cartelas" ON public.cartelas
  FOR UPDATE TO authenticated
  USING (is_used = false)
  WITH CHECK (owner_id = auth.uid());

-- Game numbers table for drawn numbers
CREATE TABLE public.game_numbers (
  id serial PRIMARY KEY,
  number int NOT NULL,
  game_id text NOT NULL DEFAULT 'current',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_numbers ENABLE ROW LEVEL SECURITY;

-- Anyone can read drawn numbers
CREATE POLICY "Anyone can read game_numbers" ON public.game_numbers
  FOR SELECT USING (true);

-- Only admins insert (we'll use service role or a function; for now allow authenticated)
CREATE POLICY "Authenticated can insert game_numbers" ON public.game_numbers
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Enable realtime for game_numbers
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_numbers;

-- Games table to track active game state
CREATE TABLE public.games (
  id text PRIMARY KEY DEFAULT 'current',
  pattern text NOT NULL DEFAULT 'Full House',
  status text NOT NULL DEFAULT 'waiting',
  winner_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read games" ON public.games
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can update games" ON public.games
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert games" ON public.games
  FOR INSERT TO authenticated
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
