
-- Add delete policy for game_numbers (admin needs to clear between games)
CREATE POLICY "Authenticated can delete game_numbers" ON public.game_numbers
  FOR DELETE TO authenticated
  USING (true);
