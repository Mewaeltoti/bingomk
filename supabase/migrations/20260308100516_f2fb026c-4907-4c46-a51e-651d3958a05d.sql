
CREATE POLICY "Admins can update all cartelas"
ON public.cartelas
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
