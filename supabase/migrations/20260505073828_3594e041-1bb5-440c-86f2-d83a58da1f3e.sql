
CREATE TABLE IF NOT EXISTS public.processed_tx (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_id text NOT NULL UNIQUE,
  amount numeric,
  bank text,
  deposit_id uuid,
  raw_message text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.processed_tx ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read processed_tx"
ON public.processed_tx FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_deposits_reference ON public.deposits (reference);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON public.deposits (status);
