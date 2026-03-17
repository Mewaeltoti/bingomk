ALTER TABLE public.game_history
ADD COLUMN IF NOT EXISTS session_number integer,
ADD COLUMN IF NOT EXISTS winner_cartela jsonb,
ADD COLUMN IF NOT EXISTS winning_number integer,
ADD COLUMN IF NOT EXISTS ended_status text NOT NULL DEFAULT 'won';

UPDATE public.game_history
SET session_number = COALESCE(session_number, 1),
    ended_status = COALESCE(ended_status, 'won')
WHERE session_number IS NULL OR ended_status IS NULL;

ALTER TABLE public.game_history
ALTER COLUMN session_number SET DEFAULT 1,
ALTER COLUMN session_number SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_game_history_session_number ON public.game_history(session_number DESC);

CREATE OR REPLACE FUNCTION public.purchase_cartelas_atomic(
  p_user_id uuid,
  p_cartela_ids integer[]
)
RETURNS TABLE (
  ok boolean,
  purchased_count integer,
  total_cost numeric,
  new_balance numeric,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price numeric;
  v_balance numeric;
  v_updated_count integer;
  v_cost numeric;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN QUERY SELECT false, 0, 0::numeric, 0::numeric, 'Unauthorized';
    RETURN;
  END IF;

  IF p_cartela_ids IS NULL OR array_length(p_cartela_ids, 1) IS NULL THEN
    RETURN QUERY SELECT false, 0, 0::numeric, 0::numeric, 'No cartelas selected';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = p_user_id
      AND role = 'admin'
  ) THEN
    RETURN QUERY SELECT false, 0, 0::numeric, 0::numeric, 'Admins cannot purchase cartelas';
    RETURN;
  END IF;

  SELECT cartela_price
  INTO v_price
  FROM public.games
  WHERE id = 'current'
    AND status IN ('buying', 'waiting')
  FOR UPDATE;

  IF v_price IS NULL THEN
    RETURN QUERY SELECT false, 0, 0::numeric, 0::numeric, 'Cannot buy during active game';
    RETURN;
  END IF;

  SELECT balance
  INTO v_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN QUERY SELECT false, 0, 0::numeric, 0::numeric, 'Profile not found';
    RETURN;
  END IF;

  v_cost := v_price * array_length(p_cartela_ids, 1);

  IF v_balance < v_cost THEN
    RETURN QUERY SELECT false, 0, v_cost, v_balance, 'Insufficient balance';
    RETURN;
  END IF;

  UPDATE public.cartelas
  SET is_used = true,
      owner_id = p_user_id
  WHERE id = ANY(p_cartela_ids)
    AND is_used = false
    AND owner_id IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count <> array_length(p_cartela_ids, 1) THEN
    UPDATE public.cartelas
    SET is_used = false,
        owner_id = NULL
    WHERE owner_id = p_user_id
      AND id = ANY(p_cartela_ids);

    RETURN QUERY SELECT false, 0, v_cost, v_balance, 'Some cartelas are no longer available';
    RETURN;
  END IF;

  UPDATE public.profiles
  SET balance = balance - v_cost
  WHERE id = p_user_id
  RETURNING balance INTO v_balance;

  RETURN QUERY SELECT true, v_updated_count, v_cost, v_balance, NULL::text;
END;
$$;