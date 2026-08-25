-- 1) Profil: dil ve veri kapsamı
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dil text NOT NULL DEFAULT 'tr',
  ADD COLUMN IF NOT EXISTS veri_kapsam text NOT NULL DEFAULT 'own';

-- 2) Yetki kataloğu
CREATE TABLE IF NOT EXISTS public.permission_catalog (
  key text PRIMARY KEY,
  module text NOT NULL,
  action text NOT NULL,
  modul_ad text,
  islem_ad text,
  sira integer NOT NULL DEFAULT 100,
  sistem boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permission_catalog TO authenticated;
GRANT ALL ON public.permission_catalog TO service_role;
ALTER TABLE public.permission_catalog ENABLE ROW LEVEL SECURITY;

-- 3) Eski -> yeni yetki eşleşmesi
CREATE TABLE IF NOT EXISTS public.permission_aliases (
  alias text PRIMARY KEY,
  canonical text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permission_aliases TO authenticated;
GRANT ALL ON public.permission_aliases TO service_role;
ALTER TABLE public.permission_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pcat_read ON public.permission_catalog;
CREATE POLICY pcat_read ON public.permission_catalog FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS pcat_write ON public.permission_catalog;
CREATE POLICY pcat_write ON public.permission_catalog FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'permissions.manage'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'permissions.manage'));

DROP POLICY IF EXISTS palias_read ON public.permission_aliases;
CREATE POLICY palias_read ON public.permission_aliases FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS palias_write ON public.permission_aliases;
CREATE POLICY palias_write ON public.permission_aliases FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 4) Katalog verisi (modül x işlem)
INSERT INTO public.permission_catalog (key, module, action, modul_ad, islem_ad, sira) VALUES
  ('dashboard.view','dashboard','view','Panel','Görüntüle',10),
  ('production.view','production','view','Üretim','Görüntüle',20),
  ('production.create','production','create','Üretim','Ekle',21),
  ('production.edit','production','edit','Üretim','Düzenle',22),
  ('production.delete','production','delete','Üretim','Sil',23),
  ('production.approve','production','approve','Üretim','Onayla',24),
  ('production.cancel','production','cancel','Üretim','İptal',25),
  ('production.export','production','export','Üretim','Dışa Aktar',26),
  ('machines.view','machines','view','Makineler','Görüntüle',30),
  ('machines.create','machines','create','Makineler','Ekle',31),
  ('machines.edit','machines','edit','Makineler','Düzenle',32),
  ('machines.delete','machines','delete','Makineler','Sil',33),
  ('products.view','products','view','Ürünler','Görüntüle',40),
  ('products.create','products','create','Ürünler','Ekle',41),
  ('products.edit','products','edit','Ürünler','Düzenle',42),
  ('products.delete','products','delete','Ürünler','Sil',43),
  ('flow.view','flow','view','Üretim Akışı','Görüntüle',50),
  ('flow.create','flow','create','Üretim Akışı','Ekle',51),
  ('flow.edit','flow','edit','Üretim Akışı','Düzenle',52),
  ('flow.delete','flow','delete','Üretim Akışı','Sil',53),
  ('downtime.view','downtime','view','Duruş','Görüntüle',60),
  ('downtime.create','downtime','create','Duruş','Ekle',61),
  ('downtime.edit','downtime','edit','Duruş','Düzenle',62),
  ('downtime.delete','downtime','delete','Duruş','Sil',63),
  ('quality.view','quality','view','Kalite','Görüntüle',70),
  ('quality.create','quality','create','Kalite','Ekle',71),
  ('quality.edit','quality','edit','Kalite','Düzenle',72),
  ('quality.delete','quality','delete','Kalite','Sil',73),
  ('quality.approve','quality','approve','Kalite','Onayla',74),
  ('oee.view','oee','view','OEE','Görüntüle',80),
  ('oee.export','oee','export','OEE','Dışa Aktar',81),
  ('inventory.view','inventory','view','Stok','Görüntüle',90),
  ('inventory.create','inventory','create','Stok','Giriş',91),
  ('inventory.consume','inventory','consume','Stok','Çıkış',92),
  ('inventory.edit','inventory','edit','Stok','Düzenle',93),
  ('inventory.delete','inventory','delete','Stok','Sil',94),
  ('purchasing.view','purchasing','view','Satın Alma','Görüntüle',100),
  ('purchasing.create','purchasing','create','Satın Alma','Ekle',101),
  ('purchasing.edit','purchasing','edit','Satın Alma','Düzenle',102),
  ('purchasing.delete','purchasing','delete','Satın Alma','Sil',103),
  ('purchasing.approve','purchasing','approve','Satın Alma','Onayla',104),
  ('reports.view','reports','view','Raporlar','Görüntüle',110),
  ('reports.print','reports','print','Raporlar','Yazdır',111),
  ('reports.export','reports','export','Raporlar','Dışa Aktar',112),
  ('users.view','users','view','Kullanıcılar','Görüntüle',120),
  ('users.create','users','create','Kullanıcılar','Ekle',121),
  ('users.edit','users','edit','Kullanıcılar','Düzenle',122),
  ('users.delete','users','delete','Kullanıcılar','Sil',123),
  ('permissions.view','permissions','view','Yetkiler','Görüntüle',130),
  ('permissions.manage','permissions','manage','Yetkiler','Yönet',131),
  ('settings.view','settings','view','Ayarlar','Görüntüle',140),
  ('settings.manage','settings','manage','Ayarlar','Yönet',141),
  ('audit.view','audit','view','Denetim','Görüntüle',150)
ON CONFLICT (key) DO NOTHING;

-- 5) Eski anahtar eşleşmeleri
INSERT INTO public.permission_aliases (alias, canonical) VALUES
  ('page.panel','dashboard.view'),
  ('page.raporlar','reports.view'),
  ('page.yonetim','settings.view'),
  ('page.kullanicilar','users.view'),
  ('page.ayarlar','settings.manage'),
  ('page.stok','inventory.view'),
  ('page.denetim','audit.view'),
  ('page.uretim','production.view'),
  ('page.canli','dashboard.view'),
  ('page.durus','downtime.view'),
  ('page.kalite','quality.view'),
  ('kayit.ekle','production.create'),
  ('kayit.duzenle','production.edit'),
  ('kayit.sil','production.delete'),
  ('kayit.onayla','production.approve'),
  ('kayit.iptal','production.cancel'),
  ('rapor.yazdir','reports.print'),
  ('rapor.disaaktar','reports.export'),
  ('urun.duzenle','products.edit'),
  ('stok.giris','inventory.create'),
  ('stok.cikis','inventory.consume'),
  ('stok.duzelt','inventory.edit')
ON CONFLICT (alias) DO NOTHING;

-- 6) has_permission: eşleşmeleri de dikkate al
CREATE OR REPLACE FUNCTION public.permission_equivalents(_perm text)
RETURNS TABLE(permission text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _perm
  UNION SELECT canonical FROM public.permission_aliases WHERE alias = _perm
  UNION SELECT alias FROM public.permission_aliases WHERE canonical = _perm
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_super_admin(_user_id)
      OR EXISTS (
           SELECT 1 FROM public.user_permissions up
           WHERE up.user_id = _user_id
             AND up.permission IN (SELECT permission FROM public.permission_equivalents(_perm)))
      OR EXISTS (
           SELECT 1 FROM public.user_role_assignments ura
           JOIN public.role_permissions rp ON rp.role_key = ura.role_key
           WHERE ura.user_id = _user_id
             AND rp.permission IN (SELECT permission FROM public.permission_equivalents(_perm)))
$$;

-- 7) Hazır roller
INSERT INTO public.roles (key, ad, aciklama, sira, sistem) VALUES
  ('production_manager','Üretim Müdürü','Tüm üretim, makine ve raporlara erişim',20,false),
  ('quality','Kalite','Kalite kontrol ve red kayıtları',40,false),
  ('maintenance','Bakım','Duruş ve makine bakım kayıtları',50,false),
  ('warehouse','Depo','Sac stok giriş/çıkış işlemleri',60,false),
  ('purchasing','Satın Alma','Satın alma talep ve onayları',70,false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission)
SELECT r.k, p.p FROM (VALUES
  ('admin','users.view'),('admin','users.create'),('admin','users.edit'),('admin','users.delete'),
  ('admin','permissions.view'),('admin','permissions.manage'),('admin','settings.view'),('admin','settings.manage'),
  ('admin','audit.view'),('admin','machines.view'),('admin','machines.create'),('admin','machines.edit'),('admin','machines.delete'),
  ('admin','products.view'),('admin','products.create'),('admin','products.edit'),('admin','products.delete'),
  ('admin','flow.view'),('admin','flow.create'),('admin','flow.edit'),('admin','flow.delete'),
  ('admin','oee.view'),('admin','oee.export'),('admin','production.view'),('admin','production.delete'),
  ('admin','downtime.view'),('admin','downtime.create'),('admin','downtime.edit'),('admin','downtime.delete'),
  ('admin','quality.view'),('admin','quality.create'),('admin','quality.edit'),('admin','quality.approve'),
  ('admin','inventory.view'),('admin','inventory.delete'),('admin','purchasing.view'),('admin','purchasing.create'),
  ('admin','purchasing.edit'),('admin','purchasing.approve'),
  ('production_manager','dashboard.view'),('production_manager','production.view'),('production_manager','production.create'),
  ('production_manager','production.edit'),('production_manager','production.approve'),('production_manager','production.export'),
  ('production_manager','machines.view'),('production_manager','products.view'),('production_manager','flow.view'),
  ('production_manager','flow.create'),('production_manager','flow.edit'),('production_manager','oee.view'),
  ('production_manager','reports.view'),('production_manager','reports.export'),('production_manager','reports.print'),
  ('production_manager','downtime.view'),('production_manager','quality.view'),('production_manager','inventory.view'),
  ('supervisor','oee.view'),('supervisor','production.view'),('supervisor','production.approve'),
  ('supervisor','machines.view'),('supervisor','products.view'),('supervisor','flow.view'),('supervisor','downtime.view'),
  ('supervisor','downtime.create'),('supervisor','quality.view'),('supervisor','quality.create'),
  ('worker','production.view'),('worker','downtime.create'),('worker','quality.create'),
  ('quality','dashboard.view'),('quality','quality.view'),('quality','quality.create'),('quality','quality.edit'),
  ('quality','quality.approve'),('quality','reports.view'),('quality','oee.view'),('quality','production.view'),
  ('maintenance','dashboard.view'),('maintenance','downtime.view'),('maintenance','downtime.create'),
  ('maintenance','downtime.edit'),('maintenance','machines.view'),('maintenance','oee.view'),('maintenance','reports.view'),
  ('warehouse','dashboard.view'),('warehouse','inventory.view'),('warehouse','inventory.create'),
  ('warehouse','inventory.consume'),('warehouse','inventory.edit'),('warehouse','reports.view'),
  ('purchasing','dashboard.view'),('purchasing','purchasing.view'),('purchasing','purchasing.create'),
  ('purchasing','purchasing.edit'),('purchasing','inventory.view'),('purchasing','reports.view')
) AS p(k, p)
JOIN (SELECT key AS k FROM public.roles) r ON r.k = p.k
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp WHERE rp.role_key = p.k AND rp.permission = p.p
);

-- 8) Yetki yönetimi: permissions.manage sahipleri de yönetebilir
DROP POLICY IF EXISTS roles_write ON public.roles;
CREATE POLICY roles_write ON public.roles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'permissions.manage'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'permissions.manage'));

DROP POLICY IF EXISTS role_permissions_write ON public.role_permissions;
CREATE POLICY role_permissions_write ON public.role_permissions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'permissions.manage'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'permissions.manage'));

DROP POLICY IF EXISTS ura_write ON public.user_role_assignments;
CREATE POLICY ura_write ON public.user_role_assignments FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'permissions.manage'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'permissions.manage'));

DROP POLICY IF EXISTS user_permissions_write ON public.user_permissions;
CREATE POLICY user_permissions_write ON public.user_permissions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'permissions.manage'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'permissions.manage'));

DROP POLICY IF EXISTS user_machines_write ON public.user_machines;
CREATE POLICY user_machines_write ON public.user_machines FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'permissions.manage'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'permissions.manage'));

DROP POLICY IF EXISTS user_products_write ON public.user_products;
CREATE POLICY user_products_write ON public.user_products FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'permissions.manage'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'permissions.manage'));

DROP POLICY IF EXISTS user_departments_write ON public.user_departments;
CREATE POLICY user_departments_write ON public.user_departments FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'permissions.manage'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(), 'permissions.manage'));

-- 9) Veri kapsamı yardımcıları
CREATE OR REPLACE FUNCTION public.my_scope()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN public.is_super_admin(auth.uid()) THEN 'all'
    WHEN public.has_permission(auth.uid(), 'production.view')
         AND COALESCE((SELECT veri_kapsam FROM public.profiles WHERE id = auth.uid()), 'own') = 'own'
      THEN 'own'
    ELSE COALESCE((SELECT veri_kapsam FROM public.profiles WHERE id = auth.uid()), 'own')
  END
$$;

CREATE OR REPLACE FUNCTION public.machine_in_my_scope(_machine_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_super_admin(auth.uid())
    OR public.my_scope() = 'all'
    OR EXISTS (
         SELECT 1 FROM public.machines m
         WHERE m.id = _machine_id
           AND (m.department_id IS NULL OR m.department_id IN (SELECT department_id FROM public.my_department_ids())))
$$;

-- 10) Üretim oturumları: kapsam + yetki bazlı erişim
DROP POLICY IF EXISTS ps_read_self_or_admin ON public.production_sessions;
CREATE POLICY ps_read_scope ON public.production_sessions FOR SELECT TO authenticated
  USING (
    auth.uid() = operator_id
    OR public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'supervisor')
    OR (public.my_scope() = 'all' AND public.has_permission(auth.uid(), 'production.view'))
    OR (public.my_scope() = 'department' AND public.has_permission(auth.uid(), 'production.view')
        AND public.machine_in_my_scope(machine_id))
  );

DROP POLICY IF EXISTS ps_update_self_or_admin ON public.production_sessions;
CREATE POLICY ps_update_scope ON public.production_sessions FOR UPDATE TO authenticated
  USING (
    auth.uid() = operator_id
    OR public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'supervisor')
    OR (public.has_permission(auth.uid(), 'production.edit') AND public.machine_in_my_scope(machine_id))
  )
  WITH CHECK (
    auth.uid() = operator_id
    OR public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'supervisor')
    OR (public.has_permission(auth.uid(), 'production.edit') AND public.machine_in_my_scope(machine_id))
  );

DROP POLICY IF EXISTS ps_delete_admin ON public.production_sessions;
CREATE POLICY ps_delete_perm ON public.production_sessions FOR DELETE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'supervisor')
    OR (public.has_permission(auth.uid(), 'production.delete') AND public.machine_in_my_scope(machine_id))
  );

-- 11) Plazma kesim kayıtları
DROP POLICY IF EXISTS pc_read_self_or_supervisor ON public.plasma_cuts;
CREATE POLICY pc_read_scope ON public.plasma_cuts FOR SELECT TO authenticated
  USING (
    auth.uid() = operator_id
    OR public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'supervisor')
    OR (public.my_scope() = 'all' AND public.has_permission(auth.uid(), 'production.view'))
    OR (public.my_scope() = 'department' AND public.has_permission(auth.uid(), 'production.view')
        AND public.machine_in_my_scope(machine_id))
  );

DROP POLICY IF EXISTS pc_update_supervisor ON public.plasma_cuts;
CREATE POLICY pc_update_perm ON public.plasma_cuts FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'supervisor')
         OR public.has_permission(auth.uid(), 'production.edit'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'supervisor')
         OR public.has_permission(auth.uid(), 'production.edit'));

DROP POLICY IF EXISTS pc_delete_supervisor ON public.plasma_cuts;
CREATE POLICY pc_delete_perm ON public.plasma_cuts FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'supervisor')
         OR public.has_permission(auth.uid(), 'production.delete'));

-- 12) Profil: kullanıcı kendi dilini kaydedebilir (mevcut update_self politikası korunur)
REVOKE EXECUTE ON FUNCTION public.permission_equivalents(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.my_scope() FROM anon;
REVOKE EXECUTE ON FUNCTION public.machine_in_my_scope(uuid) FROM anon;