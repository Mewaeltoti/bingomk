
-- Deposits table for tracking player deposits
CREATE TABLE public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bank text NOT NULL,
  amount numeric NOT NULL,
  reference text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

-- Users can read their own deposits
CREATE POLICY "Users can read own deposits" ON public.deposits
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own deposits
CREATE POLICY "Users can insert own deposits" ON public.deposits
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can read all deposits
CREATE POLICY "Admins can read all deposits" ON public.deposits
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update deposits (approve/decline)
CREATE POLICY "Admins can update deposits" ON public.deposits
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Add balance column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS balance numeric NOT NULL DEFAULT 0;
