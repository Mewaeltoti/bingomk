
ALTER TABLE public.bingo_claims ADD COLUMN cartela_id integer;
ALTER TABLE public.bingo_claims ADD COLUMN strike_count integer NOT NULL DEFAULT 0;
