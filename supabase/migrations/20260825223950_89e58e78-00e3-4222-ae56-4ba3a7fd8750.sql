-- 1) Adım alanları
ALTER TABLE public.product_operations
  ADD COLUMN IF NOT EXISTS kod text,
  ADD COLUMN IF NOT EXISTS hazirlik_dakika numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hedef_adet numeric,
  ADD COLUMN IF NOT EXISTS gereken_yetkinlik text,
  ADD COLUMN IF NOT EXISTS kalite_kontrol boolean NOT NULL DEFAULT false;

-- 2) Makine alanları
ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS tip text,
  ADD COLUMN IF NOT EXISTS notlar text;

-- 3) Adım -> izinli makineler
CREATE TABLE IF NOT EXISTS public.operation_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.product_operations(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  varsayilan boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operation_id, machine_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operation_machines TO authenticated;
GRANT ALL ON public.operation_machines TO service_role;
ALTER TABLE public.operation_machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY om_read ON public.operation_machines FOR SELECT TO authenticated USING (true);
CREATE POLICY om_write ON public.operation_machines FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_permission(auth.uid(), 'flow.edit')
    OR public.has_permission(auth.uid(), 'flow.create')
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_permission(auth.uid(), 'flow.edit')
    OR public.has_permission(auth.uid(), 'flow.create')
  );

-- 4) Mevcut tek makine bağlantılarını taşı
INSERT INTO public.operation_machines (operation_id, machine_id, varsayilan)
SELECT o.id, o.machine_id, true
FROM public.product_operations o
WHERE o.machine_id IS NOT NULL
ON CONFLICT (operation_id, machine_id) DO NOTHING;

-- 5) Adım yazma kuralları: flow.* yetkileri
DROP POLICY IF EXISTS product_operations_write_supervisor ON public.product_operations;
DROP POLICY IF EXISTS ops_write_admin ON public.product_operations;
CREATE POLICY ops_write_flow ON public.product_operations FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_permission(auth.uid(), 'flow.edit')
    OR public.has_permission(auth.uid(), 'flow.create')
    OR public.has_permission(auth.uid(), 'flow.delete')
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_permission(auth.uid(), 'flow.edit')
    OR public.has_permission(auth.uid(), 'flow.create')
  );

-- 6) Denetim kaydı
DROP TRIGGER IF EXISTS audit_operation_machines ON public.operation_machines;
CREATE TRIGGER audit_operation_machines
AFTER INSERT OR UPDATE OR DELETE ON public.operation_machines
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();