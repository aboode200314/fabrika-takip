CREATE TABLE public.plasma_cuts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL,
  machine_id uuid NOT NULL REFERENCES public.machines(id),
  vardiya public.shift_type NOT NULL,
  sac_tipi text,
  uzunluk_mm numeric NOT NULL,
  genislik_mm numeric NOT NULL,
  kalinlik_mm numeric NOT NULL,
  yogunluk numeric NOT NULL DEFAULT 7.85,
  levha_adedi integer NOT NULL DEFAULT 1,
  levha_agirlik_kg numeric GENERATED ALWAYS AS (uzunluk_mm * genislik_mm * kalinlik_mm * yogunluk / 1000000) STORED,
  toplam_agirlik_kg numeric GENERATED ALWAYS AS (uzunluk_mm * genislik_mm * kalinlik_mm * yogunluk / 1000000 * levha_adedi) STORED,
  baslangic timestamptz NOT NULL,
  bitis timestamptz NOT NULL,
  sure_dakika numeric GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (bitis - baslangic)) / 60) STORED,
  notlar text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plasma_cuts TO authenticated;
GRANT ALL ON public.plasma_cuts TO service_role;

ALTER TABLE public.plasma_cuts ENABLE ROW LEVEL SECURITY;

CREATE POLICY pc_insert_self ON public.plasma_cuts FOR INSERT TO authenticated WITH CHECK (auth.uid() = operator_id);
CREATE POLICY pc_read_self_or_supervisor ON public.plasma_cuts FOR SELECT TO authenticated USING (auth.uid() = operator_id OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY pc_update_supervisor ON public.plasma_cuts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY pc_delete_supervisor ON public.plasma_cuts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_plasma_cuts_updated_at BEFORE UPDATE ON public.plasma_cuts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.plasma_cuts_validate()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.bitis <= NEW.baslangic THEN RAISE EXCEPTION 'Bitiş zamanı başlangıçtan sonra olmalı'; END IF;
  IF NEW.levha_adedi <= 0 THEN RAISE EXCEPTION 'Levha adedi 0''dan büyük olmalı'; END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER plasma_cuts_validate_trg BEFORE INSERT OR UPDATE ON public.plasma_cuts
FOR EACH ROW EXECUTE FUNCTION public.plasma_cuts_validate();

ALTER TABLE public.downtime_logs ADD COLUMN IF NOT EXISTS baslangic timestamptz;
ALTER TABLE public.downtime_logs ADD COLUMN IF NOT EXISTS bitis timestamptz;

INSERT INTO public.downtime_categories (ad)
SELECT v FROM (VALUES ('Mekanik Arıza'),('Elektrik Arızası'),('Bakım'),('Malzeme Bekleme'),('Ayar / Sac Değişimi'),('Elektrik Kesintisi'),('Diğer')) AS t(v)
WHERE NOT EXISTS (SELECT 1 FROM public.downtime_categories d WHERE d.ad = t.v);