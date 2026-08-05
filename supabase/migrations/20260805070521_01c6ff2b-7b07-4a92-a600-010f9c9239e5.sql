-- 1) Sac stok tablosu
CREATE TABLE public.sheet_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sac_tipi text NOT NULL,
  kalinlik_mm numeric NOT NULL,
  uzunluk_mm numeric NOT NULL,
  genislik_mm numeric NOT NULL,
  adet integer NOT NULL DEFAULT 0,
  kritik_adet integer NOT NULL DEFAULT 0,
  yogunluk numeric NOT NULL DEFAULT 7.85,
  notlar text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sac_tipi, kalinlik_mm, uzunluk_mm, genislik_mm)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sheet_stock TO authenticated;
GRANT ALL ON public.sheet_stock TO service_role;
ALTER TABLE public.sheet_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sheet_stock_select" ON public.sheet_stock
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sheet_stock_insert" ON public.sheet_stock
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'supervisor') OR public.is_super_admin(auth.uid()));
CREATE POLICY "sheet_stock_update" ON public.sheet_stock
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor') OR public.is_super_admin(auth.uid()));
CREATE POLICY "sheet_stock_delete" ON public.sheet_stock
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor') OR public.is_super_admin(auth.uid()));

CREATE TRIGGER sheet_stock_updated_at BEFORE UPDATE ON public.sheet_stock
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Stok hareketleri
CREATE TABLE public.sheet_stock_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid REFERENCES public.sheet_stock(id) ON DELETE SET NULL,
  session_id uuid,
  degisim integer NOT NULL,
  tip text NOT NULL,
  notlar text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sheet_stock_moves TO authenticated;
GRANT ALL ON public.sheet_stock_moves TO service_role;
ALTER TABLE public.sheet_stock_moves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sheet_stock_moves_select" ON public.sheet_stock_moves
  FOR SELECT TO authenticated USING (true);

-- 3) Oturumlara stok bağlantısı
ALTER TABLE public.production_sessions
  ADD COLUMN IF NOT EXISTS stok_id uuid REFERENCES public.sheet_stock(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stok_dusuldu boolean NOT NULL DEFAULT false;

-- 4) Otomatik stok düşümü (tek seferlik)
CREATE OR REPLACE FUNCTION public.sheet_stock_apply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

CREATE TRIGGER zz_sheet_stock_apply BEFORE UPDATE ON public.production_sessions
  FOR EACH ROW EXECUTE FUNCTION public.sheet_stock_apply();

-- 5) Kayıt silinirse stok iadesi
CREATE OR REPLACE FUNCTION public.sheet_stock_restore()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.stok_dusuldu = true AND OLD.stok_id IS NOT NULL AND COALESCE(OLD.levha_adedi,0) > 0 THEN
    UPDATE public.sheet_stock SET adet = adet + OLD.levha_adedi WHERE id = OLD.stok_id;
    INSERT INTO public.sheet_stock_moves (stock_id, session_id, degisim, tip, notlar)
      VALUES (OLD.stok_id, NULL, OLD.levha_adedi, 'iade', 'Oturum kaydı silindi');
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER zz_sheet_stock_restore BEFORE DELETE ON public.production_sessions
  FOR EACH ROW EXECUTE FUNCTION public.sheet_stock_restore();