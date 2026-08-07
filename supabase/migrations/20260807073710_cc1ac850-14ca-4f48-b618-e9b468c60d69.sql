ALTER TABLE public.product_operations
  ADD COLUMN IF NOT EXISTS machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aciklama text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS aktif boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "ops_select_auth" ON public.product_operations;
CREATE POLICY "ops_select_auth" ON public.product_operations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ops_write_admin" ON public.product_operations;
CREATE POLICY "ops_write_admin" ON public.product_operations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor') OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'supervisor') OR public.is_super_admin(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_operations TO authenticated;
GRANT ALL ON public.product_operations TO service_role;

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor') OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'supervisor') OR public.is_super_admin(auth.uid()));
