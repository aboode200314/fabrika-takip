-- 1) Üretim emirleri
CREATE TABLE IF NOT EXISTS public.production_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kod text NOT NULL UNIQUE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  hedef_adet numeric NOT NULL DEFAULT 0,
  teslim_tarihi date,
  durum text NOT NULL DEFAULT 'open',
  oncelik integer NOT NULL DEFAULT 100,
  notlar text,
  created_by uuid,
  urun_kod_snapshot text,
  urun_ad_snapshot text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_orders TO authenticated;
GRANT ALL ON public.production_orders TO service_role;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY po_read ON public.production_orders FOR SELECT TO authenticated USING (true);

CREATE POLICY po_insert ON public.production_orders FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'supervisor')
              OR public.has_permission(auth.uid(), 'production.create'));

CREATE POLICY po_update ON public.production_orders FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'supervisor')
         OR public.has_permission(auth.uid(), 'production.edit'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'supervisor')
         OR public.has_permission(auth.uid(), 'production.edit'));

CREATE POLICY po_delete ON public.production_orders FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'supervisor')
         OR public.has_permission(auth.uid(), 'production.delete'));

CREATE TRIGGER production_orders_updated_at BEFORE UPDATE ON public.production_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_production_orders AFTER INSERT OR UPDATE OR DELETE ON public.production_orders
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE OR REPLACE FUNCTION public.production_orders_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.urun_kod_snapshot IS NULL AND NEW.product_id IS NOT NULL THEN
    SELECT p.kod, p.ad INTO NEW.urun_kod_snapshot, NEW.urun_ad_snapshot
      FROM public.products p WHERE p.id = NEW.product_id;
  END IF;
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.production_orders_snapshot() FROM anon, authenticated, PUBLIC;

CREATE TRIGGER aa_production_orders_snapshot BEFORE INSERT ON public.production_orders
FOR EACH ROW EXECUTE FUNCTION public.production_orders_snapshot();

-- 2) Oturum / duruş / kalite kayıtlarını emre bağla
ALTER TABLE public.production_sessions
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.production_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS emir_kod_snapshot text;

ALTER TABLE public.downtime_logs
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.production_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operation_id uuid REFERENCES public.product_operations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.production_sessions(id) ON DELETE SET NULL;

ALTER TABLE public.quality_logs
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.production_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operation_id uuid REFERENCES public.product_operations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.production_sessions(id) ON DELETE SET NULL;

-- 3) Emir kodu anlık görüntüsü
CREATE OR REPLACE FUNCTION public.production_sessions_order_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.emir_kod_snapshot IS NULL AND NEW.order_id IS NOT NULL THEN
    SELECT o.kod INTO NEW.emir_kod_snapshot FROM public.production_orders o WHERE o.id = NEW.order_id;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.production_sessions_order_snapshot() FROM anon, authenticated, PUBLIC;

CREATE TRIGGER ab_production_sessions_order_snapshot BEFORE INSERT ON public.production_sessions
FOR EACH ROW EXECUTE FUNCTION public.production_sessions_order_snapshot();

-- 4) İlerleme görünümleri (RLS çağıranın yetkisine göre uygulanır)
CREATE OR REPLACE VIEW public.v_order_operation_progress
WITH (security_invoker = true) AS
SELECT
  o.id                                        AS order_id,
  o.kod                                       AS order_kod,
  o.product_id,
  o.hedef_adet,
  op.id                                       AS operation_id,
  op.sira,
  op.ad                                       AS operation_ad,
  COALESCE(SUM(s.miktar), 0)::numeric         AS uretilen,
  COALESCE(SUM(s.hurda), 0)::numeric          AS fire,
  CASE WHEN COALESCE(o.hedef_adet, 0) > 0
       THEN LEAST(100, ROUND(COALESCE(SUM(s.miktar), 0) * 100.0 / o.hedef_adet, 1))
       ELSE 0 END                             AS yuzde
FROM public.production_orders o
JOIN public.product_operations op ON op.product_id = o.product_id
LEFT JOIN public.production_sessions s
       ON s.order_id = o.id AND s.operation_id = op.id
GROUP BY o.id, o.kod, o.product_id, o.hedef_adet, op.id, op.sira, op.ad;

GRANT SELECT ON public.v_order_operation_progress TO authenticated;

CREATE OR REPLACE VIEW public.v_order_progress
WITH (security_invoker = true) AS
SELECT
  order_id,
  order_kod,
  product_id,
  MAX(hedef_adet)                 AS hedef_adet,
  COUNT(*)                        AS adim_sayisi,
  SUM(uretilen)                   AS toplam_uretilen,
  SUM(fire)                       AS toplam_fire,
  ROUND(AVG(yuzde), 1)            AS yuzde
FROM public.v_order_operation_progress
GROUP BY order_id, order_kod, product_id;

GRANT SELECT ON public.v_order_progress TO authenticated;