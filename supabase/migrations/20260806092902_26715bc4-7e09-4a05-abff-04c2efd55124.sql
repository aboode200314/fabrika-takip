-- ============ 1) Fractional sheet quantities ============
ALTER TABLE public.plasma_cuts DROP COLUMN toplam_agirlik_kg;
ALTER TABLE public.plasma_cuts ALTER COLUMN levha_adedi TYPE numeric;
ALTER TABLE public.plasma_cuts ADD COLUMN toplam_agirlik_kg numeric
  GENERATED ALWAYS AS (uzunluk_mm * genislik_mm * kalinlik_mm * yogunluk / 1000000::numeric * levha_adedi) STORED;

ALTER TABLE public.production_sessions ALTER COLUMN levha_adedi TYPE numeric;
ALTER TABLE public.sheet_stock ALTER COLUMN adet TYPE numeric;
ALTER TABLE public.sheet_stock ALTER COLUMN kritik_adet TYPE numeric;
ALTER TABLE public.sheet_stock_moves ALTER COLUMN degisim TYPE numeric;

CREATE OR REPLACE FUNCTION public.sheet_stock_apply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.bitis IS NOT NULL
     AND OLD.bitis IS NULL
     AND NEW.stok_id IS NOT NULL
     AND NEW.stok_dusuldu = false
     AND COALESCE(NEW.levha_adedi, 0) > 0 THEN
    UPDATE public.sheet_stock
      SET adet = GREATEST(0, adet - NEW.levha_adedi)
      WHERE id = NEW.stok_id;
    INSERT INTO public.sheet_stock_moves (stock_id, session_id, degisim, tip, notlar)
      VALUES (NEW.stok_id, NEW.id, -NEW.levha_adedi, 'uretim', 'İş bitirildi');
    NEW.stok_dusuldu := true;
  END IF;
  RETURN NEW;
END;
$$;

-- ============ 2) Tighten RLS ============
DROP POLICY IF EXISTS ps_read_all_auth ON public.production_sessions;
CREATE POLICY ps_read_self_or_admin ON public.production_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = operator_id OR public.has_role(auth.uid(), 'supervisor') OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS sp_read_all_auth ON public.session_pauses;
CREATE POLICY sp_read_self_or_admin ON public.session_pauses
  FOR SELECT TO authenticated
  USING (auth.uid() = operator_id OR public.has_role(auth.uid(), 'supervisor') OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS profiles_read_all_auth ON public.profiles;
CREATE POLICY profiles_read_self_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'supervisor') OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS sa_read ON public.super_admins;
CREATE POLICY sa_read_self_or_admin ON public.super_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS sheet_stock_moves_select ON public.sheet_stock_moves;
CREATE POLICY sheet_stock_moves_read_admin ON public.sheet_stock_moves
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor') OR public.is_super_admin(auth.uid()));
REVOKE INSERT, UPDATE, DELETE ON public.sheet_stock_moves FROM authenticated, anon;

DROP POLICY IF EXISTS ws_read ON public.webhook_settings;
DROP POLICY IF EXISTS ws_all_superadmin ON public.webhook_settings;
DROP POLICY IF EXISTS ws_write_supervisor ON public.webhook_settings;
REVOKE ALL ON public.webhook_settings FROM authenticated, anon;
GRANT ALL ON public.webhook_settings TO service_role;

-- ============ 3) Safe live-status functions ============
CREATE OR REPLACE FUNCTION public.live_sessions()
RETURNS TABLE (
  id uuid, operator_id uuid, operator_ad text, machine_id uuid, product_id uuid,
  vardiya shift_type, baslangic timestamptz, durum text, sac_tipi text,
  uzunluk_mm numeric, genislik_mm numeric, kalinlik_mm numeric,
  levha_adedi numeric, yogunluk numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.operator_id, COALESCE(p.ad_soyad, '—'), s.machine_id, s.product_id,
         s.vardiya, s.baslangic, s.durum, s.sac_tipi,
         s.uzunluk_mm, s.genislik_mm, s.kalinlik_mm, s.levha_adedi, s.yogunluk
  FROM public.production_sessions s
  LEFT JOIN public.profiles p ON p.id = s.operator_id
  WHERE s.bitis IS NULL
  ORDER BY s.baslangic
$$;

CREATE OR REPLACE FUNCTION public.live_pauses()
RETURNS TABLE (
  id uuid, session_id uuid, neden text, baslangic timestamptz,
  bitis timestamptz, sure_dakika numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sp.id, sp.session_id, sp.neden, sp.baslangic, sp.bitis, sp.sure_dakika
  FROM public.session_pauses sp
  JOIN public.production_sessions s ON s.id = sp.session_id
  WHERE s.bitis IS NULL
$$;

-- ============ 4) SECURITY DEFINER hardening ============
REVOKE ALL ON FUNCTION public.live_sessions() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.live_pauses() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.live_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.live_pauses() TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sheet_stock_apply() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sheet_stock_restore() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.production_sessions_calc() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.session_pauses_calc() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.plasma_cuts_validate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;