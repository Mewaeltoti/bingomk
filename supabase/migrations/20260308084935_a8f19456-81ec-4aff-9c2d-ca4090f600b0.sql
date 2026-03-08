
-- Fix deposits RLS: restrictive policies block admin reads. 
-- Drop the restrictive policies and recreate as permissive.
DROP POLICY IF EXISTS "Admins can read all deposits" ON public.deposits;
DROP POLICY IF EXISTS "Users can read own deposits" ON public.deposits;
DROP POLICY IF EXISTS "Admins can update deposits" ON public.deposits;
DROP POLICY IF EXISTS "Users can insert own deposits" ON public.deposits;

CREATE POLICY "Admins can read all deposits" ON public.deposits
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own deposits" ON public.deposits
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can update deposits" ON public.deposits
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own deposits" ON public.deposits
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Also fix profiles so admin can update any profile (for balance updates)
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
