-- ============ 1. PRODUCTS: extra fields + soft delete ============
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS aciklama text,
  ADD COLUMN IF NOT EXISTS olcu text,
  ADD COLUMN IF NOT EXISTS birim_agirlik_kg numeric,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS silindi_at timestamptz;

DROP TRIGGER IF EXISTS products_updated_at ON public.products;
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 2. DEPARTMENTS / PRODUCTION LINES ============
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kod text NOT NULL UNIQUE,
  ad text NOT NULL,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.departments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- ============ 3. RBAC: roles / role_permissions / assignments ============
CREATE TABLE IF NOT EXISTS public.roles (
  key text PRIMARY KEY,
  ad text NOT NULL,
  aciklama text,
  sira integer NOT NULL DEFAULT 100,
  sistem boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL REFERENCES public.roles(key) ON DELETE CASCADE,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_key, permission)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_key text NOT NULL REFERENCES public.roles(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_key)
);
GRANT SELECT ON public.user_role_assignments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_role_assignments TO authenticated;
GRANT ALL ON public.user_role_assignments TO service_role;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;

INSERT INTO public.roles (key, ad, aciklama, sira, sistem) VALUES
  ('super_admin','Ana Yönetici','Sınırsız yetki; rol ve sistem ayarlarını yönetir',10,true),
  ('admin','Yönetici','Üretimi ve kullanıcıları yönetir; sistem ayarlarına dokunamaz',20,true),
  ('supervisor','Süpervizör','Bağlı olduğu bölümün üretimini takip eder ve düzeltir',30,true),
  ('worker','Operatör','Yalnızca kendi üretim kayıtlarını girer',40,true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission) VALUES
  ('admin','page.panel'),('admin','page.raporlar'),('admin','page.yonetim'),
  ('admin','page.kullanicilar'),('admin','page.stok'),('admin','page.denetim'),
  ('admin','kayit.ekle'),('admin','kayit.duzenle'),('admin','kayit.onayla'),('admin','kayit.iptal'),
  ('admin','rapor.yazdir'),('admin','rapor.disaaktar'),
  ('admin','urun.duzenle'),('admin','stok.giris'),('admin','stok.cikis'),('admin','stok.duzelt'),
  ('supervisor','page.panel'),('supervisor','page.raporlar'),('supervisor','page.stok'),
  ('supervisor','kayit.ekle'),('supervisor','kayit.duzenle'),('supervisor','kayit.onayla'),
  ('supervisor','rapor.yazdir'),('supervisor','rapor.disaaktar'),
  ('supervisor','stok.giris'),('supervisor','stok.cikis'),
  ('worker','page.panel'),('worker','kayit.ekle')
ON CONFLICT DO NOTHING;

-- migrate existing enum roles into assignments
INSERT INTO public.user_role_assignments (user_id, role_key)
SELECT ur.user_id, CASE WHEN ur.role = 'supervisor' THEN 'supervisor' ELSE 'worker' END
FROM public.user_roles ur
ON CONFLICT DO NOTHING;
INSERT INTO public.user_role_assignments (user_id, role_key)
SELECT sa.user_id, 'super_admin' FROM public.super_admins sa
ON CONFLICT DO NOTHING;

-- permission resolution now includes role permissions
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_super_admin(_user_id)
      OR EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = _user_id AND permission = _perm)
      OR EXISTS (
           SELECT 1 FROM public.user_role_assignments ura
           JOIN public.role_permissions rp ON rp.role_key = ura.role_key
           WHERE ura.user_id = _user_id AND rp.permission = _perm)
$$;

CREATE OR REPLACE FUNCTION public.has_app_role(_user_id uuid, _role_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_super_admin(_user_id)
      OR EXISTS (SELECT 1 FROM public.user_role_assignments WHERE user_id = _user_id AND role_key = _role_key)
$$;

CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS TABLE(permission text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT p FROM (
    SELECT permission AS p FROM public.user_permissions WHERE user_id = auth.uid()
    UNION
    SELECT rp.permission FROM public.user_role_assignments ura
      JOIN public.role_permissions rp ON rp.role_key = ura.role_key
      WHERE ura.user_id = auth.uid()
  ) s
$$;

CREATE POLICY roles_read ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY roles_write ON public.roles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY role_perms_read ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY role_perms_write ON public.role_permissions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY ura_read ON public.user_role_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'page.kullanicilar'));
-- only super admin may grant/revoke super_admin; others need user management permission
CREATE POLICY ura_insert ON public.user_role_assignments FOR INSERT TO authenticated
  WITH CHECK (
    CASE WHEN role_key = 'super_admin' THEN public.is_super_admin(auth.uid())
         ELSE public.has_permission(auth.uid(), 'page.kullanicilar') END);
CREATE POLICY ura_delete ON public.user_role_assignments FOR DELETE TO authenticated
  USING (
    CASE WHEN role_key = 'super_admin' THEN public.is_super_admin(auth.uid())
         ELSE public.has_permission(auth.uid(), 'page.kullanicilar') END);

CREATE POLICY departments_read ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY departments_write ON public.departments FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'page.ayarlar')) WITH CHECK (public.has_permission(auth.uid(), 'page.ayarlar'));

-- ============ 4. AUDIT LOG ============
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_ad text,
  tablo text NOT NULL,
  kayit_id text,
  islem text NOT NULL,
  eski_veri jsonb,
  yeni_veri jsonb,
  degisen_alanlar text[],
  aciklama text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_tablo_idx ON public.audit_logs (tablo, kayit_id);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_read ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'page.denetim'));

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_old jsonb; v_new jsonb; v_changed text[]; v_id text; v_ad text;
BEGIN
  IF TG_OP = 'INSERT' THEN v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN v_old := to_jsonb(OLD); v_new := to_jsonb(NEW);
    SELECT array_agg(k) INTO v_changed FROM jsonb_object_keys(v_new) k
      WHERE v_new -> k IS DISTINCT FROM v_old -> k;
    IF v_changed IS NULL OR v_changed = ARRAY['updated_at']::text[] THEN RETURN NEW; END IF;
  ELSE v_old := to_jsonb(OLD);
  END IF;

  v_id := COALESCE(v_new ->> 'id', v_old ->> 'id');
  SELECT ad_soyad INTO v_ad FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.audit_logs (actor_id, actor_ad, tablo, kayit_id, islem, eski_veri, yeni_veri, degisen_alanlar)
  VALUES (auth.uid(), v_ad, TG_TABLE_NAME, v_id, TG_OP, v_old, v_new, v_changed);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS audit_products ON public.products;
CREATE TRIGGER audit_products AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_sheet_stock ON public.sheet_stock;
CREATE TRIGGER audit_sheet_stock AFTER INSERT OR UPDATE OR DELETE ON public.sheet_stock
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_sheet_stock_moves ON public.sheet_stock_moves;
CREATE TRIGGER audit_sheet_stock_moves AFTER INSERT OR UPDATE OR DELETE ON public.sheet_stock_moves
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_production_sessions ON public.production_sessions;
CREATE TRIGGER audit_production_sessions AFTER UPDATE OR DELETE ON public.production_sessions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_plasma_cuts ON public.plasma_cuts;
CREATE TRIGGER audit_plasma_cuts AFTER UPDATE OR DELETE ON public.plasma_cuts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
CREATE TRIGGER audit_profiles AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ============ 5. STOCK MOVEMENTS: in / out with running balance ============
ALTER TABLE public.sheet_stock_moves
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS user_ad text,
  ADD COLUMN IF NOT EXISTS yon text,
  ADD COLUMN IF NOT EXISTS sebep text,
  ADD COLUMN IF NOT EXISTS bakiye_sonrasi numeric,
  ADD COLUMN IF NOT EXISTS ters_kayit_id uuid REFERENCES public.sheet_stock_moves(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stok_uygulandi boolean NOT NULL DEFAULT false;

UPDATE public.sheet_stock_moves
  SET stok_uygulandi = true,
      yon = CASE WHEN degisim >= 0 THEN 'giris' ELSE 'cikis' END
  WHERE yon IS NULL;

-- movements: applied to stock on insert unless already applied by production trigger
CREATE OR REPLACE FUNCTION public.sheet_stock_moves_apply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_bakiye numeric;
BEGIN
  IF NEW.degisim = 0 THEN RAISE EXCEPTION 'Hareket miktarı 0 olamaz'; END IF;
  IF NEW.stock_id IS NULL THEN RAISE EXCEPTION 'Stok kalemi zorunludur'; END IF;

  NEW.yon := CASE WHEN NEW.degisim >= 0 THEN 'giris' ELSE 'cikis' END;
  IF NEW.user_id IS NULL THEN NEW.user_id := auth.uid(); END IF;
  IF NEW.user_ad IS NULL THEN
    SELECT ad_soyad INTO NEW.user_ad FROM public.profiles WHERE id = NEW.user_id;
  END IF;

  IF NEW.stok_uygulandi = false THEN
    UPDATE public.sheet_stock SET adet = GREATEST(0, adet + NEW.degisim)
      WHERE id = NEW.stock_id RETURNING adet INTO v_bakiye;
    NEW.stok_uygulandi := true;
  ELSE
    SELECT adet INTO v_bakiye FROM public.sheet_stock WHERE id = NEW.stock_id;
  END IF;

  NEW.bakiye_sonrasi := v_bakiye;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS sheet_stock_moves_apply_trg ON public.sheet_stock_moves;
CREATE TRIGGER sheet_stock_moves_apply_trg BEFORE INSERT ON public.sheet_stock_moves
  FOR EACH ROW EXECUTE FUNCTION public.sheet_stock_moves_apply();

-- production triggers must mark their moves as already applied
CREATE OR REPLACE FUNCTION public.sheet_stock_apply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.bitis IS NOT NULL AND OLD.bitis IS NULL AND NEW.stok_id IS NOT NULL
     AND NEW.stok_dusuldu = false AND COALESCE(NEW.levha_adedi, 0) > 0 THEN
    UPDATE public.sheet_stock SET adet = GREATEST(0, adet - NEW.levha_adedi) WHERE id = NEW.stok_id;
    INSERT INTO public.sheet_stock_moves (stock_id, session_id, degisim, tip, sebep, notlar, user_id, stok_uygulandi)
      VALUES (NEW.stok_id, NEW.id, -NEW.levha_adedi, 'uretim', 'Üretim emri', 'İş bitirildi', NEW.operator_id, true);
    NEW.stok_dusuldu := true;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.sheet_stock_restore()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.stok_dusuldu = true AND OLD.stok_id IS NOT NULL AND COALESCE(OLD.levha_adedi,0) > 0 THEN
    UPDATE public.sheet_stock SET adet = adet + OLD.levha_adedi WHERE id = OLD.stok_id;
    INSERT INTO public.sheet_stock_moves (stock_id, session_id, degisim, tip, sebep, notlar, stok_uygulandi)
      VALUES (OLD.stok_id, NULL, OLD.levha_adedi, 'iade', 'Üretim kaydı silindi', 'Oturum kaydı silindi', true);
  END IF;
  RETURN OLD;
END; $$;

-- movements are append-only: insert with permission, never update/delete
GRANT INSERT ON public.sheet_stock_moves TO authenticated;
DROP POLICY IF EXISTS sheet_stock_moves_read_admin ON public.sheet_stock_moves;
CREATE POLICY sheet_stock_moves_read ON public.sheet_stock_moves FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'page.stok'));
CREATE POLICY sheet_stock_moves_insert ON public.sheet_stock_moves FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'stok.giris') OR public.has_permission(auth.uid(), 'stok.cikis'));

-- ============ 6. WORK SCHEDULES + BREAKS ============
CREATE TABLE IF NOT EXISTS public.work_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gun smallint NOT NULL UNIQUE CHECK (gun BETWEEN 0 AND 6),
  tatil boolean NOT NULL DEFAULT false,
  baslangic time,
  bitis time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.work_schedules TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.work_schedules TO authenticated;
GRANT ALL ON public.work_schedules TO service_role;
ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY work_schedules_read ON public.work_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY work_schedules_write ON public.work_schedules FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'page.ayarlar')) WITH CHECK (public.has_permission(auth.uid(),'page.ayarlar'));
CREATE TRIGGER work_schedules_updated_at BEFORE UPDATE ON public.work_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.work_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid REFERENCES public.work_schedules(id) ON DELETE CASCADE,
  ad text NOT NULL,
  baslangic time NOT NULL,
  bitis time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_breaks_schedule_idx ON public.work_breaks (schedule_id);
GRANT SELECT ON public.work_breaks TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.work_breaks TO authenticated;
GRANT ALL ON public.work_breaks TO service_role;
ALTER TABLE public.work_breaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY work_breaks_read ON public.work_breaks FOR SELECT TO authenticated USING (true);
CREATE POLICY work_breaks_write ON public.work_breaks FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'page.ayarlar')) WITH CHECK (public.has_permission(auth.uid(),'page.ayarlar'));
CREATE TRIGGER work_breaks_updated_at BEFORE UPDATE ON public.work_breaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.work_breaks_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.bitis <= NEW.baslangic THEN RAISE EXCEPTION 'Mola bitişi başlangıçtan sonra olmalı'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER work_breaks_validate_trg BEFORE INSERT OR UPDATE ON public.work_breaks
  FOR EACH ROW EXECUTE FUNCTION public.work_breaks_validate();

INSERT INTO public.work_schedules (gun, tatil, baslangic, bitis) VALUES
  (1,false,'08:00','17:00'),(2,false,'08:00','17:00'),(3,false,'08:00','17:00'),
  (4,false,'08:00','17:00'),(5,false,'08:00','17:00'),
  (6,false,'08:00','14:00'),(0,true,NULL,NULL)
ON CONFLICT (gun) DO NOTHING;

INSERT INTO public.work_breaks (schedule_id, ad, baslangic, bitis)
SELECT ws.id, b.ad, b.bas, b.bit
FROM public.work_schedules ws
CROSS JOIN (VALUES ('Sabah Molası','10:00'::time,'10:15'::time),
                   ('Öğle Yemeği','13:00'::time,'14:00'::time),
                   ('İkindi Molası','16:00'::time,'16:15'::time)) AS b(ad,bas,bit)
WHERE ws.tatil = false AND ws.gun BETWEEN 1 AND 5
  AND NOT EXISTS (SELECT 1 FROM public.work_breaks wb WHERE wb.schedule_id = ws.id);

-- net working minutes for a day, breaks excluded
CREATE OR REPLACE FUNCTION public.net_work_minutes(_gun smallint)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT GREATEST(0,
    COALESCE(EXTRACT(EPOCH FROM (ws.bitis - ws.baslangic))/60.0, 0)
    - COALESCE((SELECT SUM(EXTRACT(EPOCH FROM (wb.bitis - wb.baslangic))/60.0)
                FROM public.work_breaks wb WHERE wb.schedule_id = ws.id), 0))
  FROM public.work_schedules ws
  WHERE ws.gun = _gun AND ws.tatil = false
$$;

-- ============ 7. PRODUCTS: permission-based write policies ============
DROP POLICY IF EXISTS products_write_supervisor ON public.products;
CREATE POLICY products_insert ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'urun.duzenle') OR public.has_role(auth.uid(),'supervisor'));
CREATE POLICY products_update ON public.products FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'urun.duzenle') OR public.has_role(auth.uid(),'supervisor'))
  WITH CHECK (public.has_permission(auth.uid(),'urun.duzenle') OR public.has_role(auth.uid(),'supervisor'));
CREATE POLICY products_delete ON public.products FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));