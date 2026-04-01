
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own session" ON public.user_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own session" ON public.user_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own session" ON public.user_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own session" ON public.user_sessions FOR DELETE TO authenticated USING (user_id = auth.uid());
