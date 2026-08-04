ALTER TABLE public.production_sessions
  ADD COLUMN IF NOT EXISTS sac_tipi text,
  ADD COLUMN IF NOT EXISTS uzunluk_mm numeric,
  ADD COLUMN IF NOT EXISTS genislik_mm numeric,
  ADD COLUMN IF NOT EXISTS kalinlik_mm numeric,
  ADD COLUMN IF NOT EXISTS levha_adedi integer,
  ADD COLUMN IF NOT EXISTS yogunluk numeric,
  ADD COLUMN IF NOT EXISTS toplam_agirlik_kg numeric;

CREATE OR REPLACE FUNCTION public.production_sessions_calc()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.bitis IS NOT NULL THEN
    IF NEW.bitis <= NEW.baslangic THEN RAISE EXCEPTION 'Bitiş zamanı başlangıçtan sonra olmalı'; END IF;
    NEW.sure_dakika := EXTRACT(EPOCH FROM (NEW.bitis - NEW.baslangic)) / 60.0;
    NEW.durum := 'done';
    SELECT COALESCE(SUM(sure_dakika),0), COUNT(*) INTO NEW.toplam_durus_dakika, NEW.durus_sayisi
      FROM public.session_pauses WHERE session_id = NEW.id;
  ELSE
    NEW.sure_dakika := NULL;
    IF NEW.durum IS NULL OR NEW.durum NOT IN ('running','paused') THEN NEW.durum := 'running'; END IF;
  END IF;

  IF NEW.uzunluk_mm IS NOT NULL AND NEW.genislik_mm IS NOT NULL
     AND NEW.kalinlik_mm IS NOT NULL AND NEW.levha_adedi IS NOT NULL THEN
    NEW.toplam_agirlik_kg :=
      (NEW.uzunluk_mm * NEW.genislik_mm * NEW.kalinlik_mm * COALESCE(NEW.yogunluk, 7.85) / 1000000.0)
      * NEW.levha_adedi;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END; $function$;