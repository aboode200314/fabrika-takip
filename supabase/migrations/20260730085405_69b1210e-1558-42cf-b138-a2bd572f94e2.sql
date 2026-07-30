
-- ============ SUPER ADMIN ============
CREATE TABLE public.super_admins (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.super_admins TO authenticated;
GRANT ALL ON public.super_admins TO service_role;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY sa_read ON public.super_admins FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = _user_id)
$$;

INSERT INTO public.super_admins (user_id) VALUES ('1367ae55-72e9-4780-b515-e072d73e32ad')
ON CONFLICT DO NOTHING;

-- ============ PERMISSIONS ============
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);
GRANT SELECT ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY up_read_self_or_admin ON public.user_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'supervisor') OR public.is_super_admin(auth.uid()));
CREATE POLICY up_write_admin ON public.user_permissions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'supervisor'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'supervisor'));

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(_user_id)
      OR EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = _user_id AND permission = _perm)
$$;

-- ============ MACHINE / PRODUCT ASSIGNMENTS ============
CREATE TABLE public.user_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, machine_id)
);
GRANT SELECT ON public.user_machines TO authenticated;
GRANT ALL ON public.user_machines TO service_role;
ALTER TABLE public.user_machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY um_read ON public.user_machines FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'supervisor') OR public.is_super_admin(auth.uid()));
CREATE POLICY um_write_admin ON public.user_machines FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'supervisor'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'supervisor'));

CREATE TABLE public.user_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
GRANT SELECT ON public.user_products TO authenticated;
GRANT ALL ON public.user_products TO service_role;
ALTER TABLE public.user_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY upr_read ON public.user_products FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'supervisor') OR public.is_super_admin(auth.uid()));
CREATE POLICY upr_write_admin ON public.user_products FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'supervisor'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'supervisor'));

-- ============ LIVE PRODUCTION SESSIONS ============
CREATE TABLE public.production_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  operation_id uuid REFERENCES public.product_operations(id) ON DELETE SET NULL,
  vardiya shift_type NOT NULL,
  baslangic timestamptz NOT NULL DEFAULT now(),
  bitis timestamptz,
  sure_dakika numeric,
  miktar integer,
  hurda integer NOT NULL DEFAULT 0,
  notlar text,
  durum text NOT NULL DEFAULT 'running',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_sessions TO authenticated;
GRANT ALL ON public.production_sessions TO service_role;
ALTER TABLE public.production_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ps_read_all_auth ON public.production_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY ps_insert_self ON public.production_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = operator_id);
CREATE POLICY ps_update_self_or_admin ON public.production_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = operator_id OR public.has_role(auth.uid(),'supervisor') OR public.is_super_admin(auth.uid()))
  WITH CHECK (auth.uid() = operator_id OR public.has_role(auth.uid(),'supervisor') OR public.is_super_admin(auth.uid()));
CREATE POLICY ps_delete_admin ON public.production_sessions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'supervisor') OR public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.production_sessions_calc()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.bitis IS NOT NULL THEN
    IF NEW.bitis <= NEW.baslangic THEN RAISE EXCEPTION 'Bitiş zamanı başlangıçtan sonra olmalı'; END IF;
    NEW.sure_dakika := EXTRACT(EPOCH FROM (NEW.bitis - NEW.baslangic)) / 60.0;
    NEW.durum := 'done';
  ELSE
    NEW.sure_dakika := NULL;
    NEW.durum := 'running';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

CREATE TRIGGER production_sessions_calc_trg
BEFORE INSERT OR UPDATE ON public.production_sessions
FOR EACH ROW EXECUTE FUNCTION public.production_sessions_calc();

CREATE INDEX ps_running_idx ON public.production_sessions (machine_id) WHERE bitis IS NULL;
CREATE INDEX ps_baslangic_idx ON public.production_sessions (baslangic DESC);

ALTER TABLE public.production_sessions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_sessions;

-- ============ SUPER ADMIN FULL CONTROL ON EXISTING LOGS ============
CREATE POLICY pl_all_superadmin ON public.production_logs FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY dl_all_superadmin ON public.downtime_logs FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY ql_all_superadmin ON public.quality_logs FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY pc_all_superadmin ON public.plasma_cuts FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY machines_all_superadmin ON public.machines FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY products_all_superadmin ON public.products FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY po_all_superadmin ON public.product_operations FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY dc_all_superadmin ON public.downtime_categories FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY ws_all_superadmin ON public.webhook_settings FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY profiles_all_superadmin ON public.profiles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
