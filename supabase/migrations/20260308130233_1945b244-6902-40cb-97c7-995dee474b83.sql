
CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  bank text NOT NULL,
  account_number text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- Users can insert own withdrawals
CREATE POLICY "Users can insert own withdrawals" ON public.withdrawals
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can read own withdrawals
CREATE POLICY "Users can read own withdrawals" ON public.withdrawals
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all withdrawals
CREATE POLICY "Admins can read all withdrawals" ON public.withdrawals
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Admins can update withdrawals
CREATE POLICY "Admins can update withdrawals" ON public.withdrawals
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
