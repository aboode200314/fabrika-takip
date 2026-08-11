-- 1) Master data: routing detayları
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id);
ALTER TABLE public.product_operations ADD COLUMN IF NOT EXISTS tahmini_sure_saniye numeric;

-- 2) Transaction data: tarihsel snapshot alanları
ALTER TABLE public.production_sessions
  ADD COLUMN IF NOT EXISTS makine_kod_snapshot text,
  ADD COLUMN IF NOT EXISTS makine_ad_snapshot text,
  ADD COLUMN IF NOT EXISTS asama_ad_snapshot text,
  ADD COLUMN IF NOT EXISTS asama_sira_snapshot integer,
  ADD COLUMN IF NOT EXISTS urun_kod_snapshot text,
  ADD COLUMN IF NOT EXISTS urun_ad_snapshot text;

CREATE OR REPLACE FUNCTION public.production_sessions_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.makine_kod_snapshot IS NULL AND NEW.machine_id IS NOT NULL THEN
    SELECT m.kod, m.ad INTO NEW.makine_kod_snapshot, NEW.makine_ad_snapshot
      FROM public.machines m WHERE m.id = NEW.machine_id;
  END IF;
  IF NEW.urun_kod_snapshot IS NULL AND NEW.product_id IS NOT NULL THEN
    SELECT p.kod, p.ad INTO NEW.urun_kod_snapshot, NEW.urun_ad_snapshot
      FROM public.products p WHERE p.id = NEW.product_id;
  END IF;
  IF NEW.asama_ad_snapshot IS NULL AND NEW.operation_id IS NOT NULL THEN
    SELECT o.ad, o.sira INTO NEW.asama_ad_snapshot, NEW.asama_sira_snapshot
      FROM public.product_operations o WHERE o.id = NEW.operation_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS aa_production_sessions_snapshot ON public.production_sessions;
CREATE TRIGGER aa_production_sessions_snapshot
  BEFORE INSERT ON public.production_sessions
  FOR EACH ROW EXECUTE FUNCTION public.production_sessions_snapshot();

-- geçmiş kayıtları geriye dönük doldur (boş olanlar için)
UPDATE public.production_sessions s SET
  makine_kod_snapshot = COALESCE(s.makine_kod_snapshot, m.kod),
  makine_ad_snapshot  = COALESCE(s.makine_ad_snapshot, m.ad)
FROM public.machines m WHERE m.id = s.machine_id AND s.makine_kod_snapshot IS NULL;

UPDATE public.production_sessions s SET
  urun_kod_snapshot = COALESCE(s.urun_kod_snapshot, p.kod),
  urun_ad_snapshot  = COALESCE(s.urun_ad_snapshot, p.ad)
FROM public.products p WHERE p.id = s.product_id AND s.urun_kod_snapshot IS NULL;

UPDATE public.production_sessions s SET
  asama_ad_snapshot   = COALESCE(s.asama_ad_snapshot, o.ad),
  asama_sira_snapshot = COALESCE(s.asama_sira_snapshot, o.sira)
FROM public.product_operations o WHERE o.id = s.operation_id AND s.asama_ad_snapshot IS NULL;

-- Routing adımı silinse bile eski üretim kaydı korunsun
ALTER TABLE public.production_sessions DROP CONSTRAINT IF EXISTS production_sessions_operation_id_fkey;
ALTER TABLE public.production_sessions
  ADD CONSTRAINT production_sessions_operation_id_fkey
  FOREIGN KEY (operation_id) REFERENCES public.product_operations(id) ON DELETE SET NULL;

-- 3) Stok hareketlerinde malzeme snapshot'ı
ALTER TABLE public.sheet_stock_moves
  ADD COLUMN IF NOT EXISTS sac_tipi_snapshot text,
  ADD COLUMN IF NOT EXISTS kalinlik_mm_snapshot numeric,
  ADD COLUMN IF NOT EXISTS uzunluk_mm_snapshot numeric,
  ADD COLUMN IF NOT EXISTS genislik_mm_snapshot numeric,
  ADD COLUMN IF NOT EXISTS birim text NOT NULL DEFAULT 'levha';

CREATE OR REPLACE FUNCTION public.sheet_stock_moves_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sac_tipi_snapshot IS NULL AND NEW.stock_id IS NOT NULL THEN
    SELECT s.sac_tipi, s.kalinlik_mm, s.uzunluk_mm, s.genislik_mm
      INTO NEW.sac_tipi_snapshot, NEW.kalinlik_mm_snapshot, NEW.uzunluk_mm_snapshot, NEW.genislik_mm_snapshot
      FROM public.sheet_stock s WHERE s.id = NEW.stock_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS aa_sheet_stock_moves_snapshot ON public.sheet_stock_moves;
CREATE TRIGGER aa_sheet_stock_moves_snapshot
  BEFORE INSERT ON public.sheet_stock_moves
  FOR EACH ROW EXECUTE FUNCTION public.sheet_stock_moves_snapshot();

UPDATE public.sheet_stock_moves mv SET
  sac_tipi_snapshot = COALESCE(mv.sac_tipi_snapshot, s.sac_tipi),
  kalinlik_mm_snapshot = COALESCE(mv.kalinlik_mm_snapshot, s.kalinlik_mm),
  uzunluk_mm_snapshot = COALESCE(mv.uzunluk_mm_snapshot, s.uzunluk_mm),
  genislik_mm_snapshot = COALESCE(mv.genislik_mm_snapshot, s.genislik_mm)
FROM public.sheet_stock s WHERE s.id = mv.stock_id AND mv.sac_tipi_snapshot IS NULL;

-- 4) Kullanıcı → departman kapsamı
CREATE TABLE IF NOT EXISTS public.user_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, department_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_departments TO authenticated;
GRANT ALL ON public.user_departments TO service_role;

ALTER TABLE public.user_departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kendi kapsamini gorur" ON public.user_departments;
CREATE POLICY "kendi kapsamini gorur" ON public.user_departments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'page.kullanicilar'));

DROP POLICY IF EXISTS "yetkili kapsam yonetir" ON public.user_departments;
CREATE POLICY "yetkili kapsam yonetir" ON public.user_departments
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'page.kullanicilar'))
  WITH CHECK (public.has_permission(auth.uid(), 'page.kullanicilar'));

CREATE OR REPLACE FUNCTION public.my_department_ids()
RETURNS TABLE(department_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ud.department_id FROM public.user_departments ud WHERE ud.user_id = auth.uid()
  UNION
  SELECT p.department_id FROM public.profiles p WHERE p.id = auth.uid() AND p.department_id IS NOT NULL
$$;

CREATE TRIGGER audit_user_departments AFTER INSERT OR UPDATE OR DELETE ON public.user_departments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER audit_product_operations AFTER INSERT OR UPDATE OR DELETE ON public.product_operations
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();