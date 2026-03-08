
-- Track bingo claims per game for multi-winner logic
CREATE TABLE public.bingo_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL DEFAULT 'current',
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  claimed_at timestamp with time zone NOT NULL DEFAULT now(),
  is_valid boolean DEFAULT NULL,
  UNIQUE(game_id, user_id)
);

ALTER TABLE public.bingo_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read claims" ON public.bingo_claims
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own claim" ON public.bingo_claims
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update claims" ON public.bingo_claims
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete claims" ON public.bingo_claims
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.bingo_claims;
