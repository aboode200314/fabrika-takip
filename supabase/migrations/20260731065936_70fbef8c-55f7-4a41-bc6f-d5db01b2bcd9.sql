ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS unvan text;
ALTER TABLE public.production_sessions ADD COLUMN IF NOT EXISTS toplam_durus_dakika numeric NOT NULL DEFAULT 0;
ALTER TABLE public.production_sessions ADD COLUMN IF NOT EXISTS durus_sayisi integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.session_pauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.production_sessions(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL,
  neden text NOT NULL,
  baslangic timestamptz NOT NULL DEFAULT now(),
  bitis timestamptz,
  sure_dakika numeric,
  notlar text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_pauses TO authenticated;
GRANT ALL ON public.session_pauses TO service_role;

ALTER TABLE public.session_pauses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sp_read_all_auth" ON public.session_pauses FOR SELECT TO authenticated USING (true);
CREATE POLICY "sp_insert_self" ON public.session_pauses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = operator_id OR has_role(auth.uid(),'supervisor'::app_role) OR is_super_admin(auth.uid()));
CREATE POLICY "sp_update_self_or_admin" ON public.session_pauses FOR UPDATE TO authenticated
  USING (auth.uid() = operator_id OR has_role(auth.uid(),'supervisor'::app_role) OR is_super_admin(auth.uid()))
  WITH CHECK (auth.uid() = operator_id OR has_role(auth.uid(),'supervisor'::app_role) OR is_super_admin(auth.uid()));
CREATE POLICY "sp_delete_admin" ON public.session_pauses FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'supervisor'::app_role) OR is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.session_pauses_calc()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.bitis IS NOT NULL THEN
    IF NEW.bitis <= NEW.baslangic THEN RAISE EXCEPTION 'Bitiş zamanı başlangıçtan sonra olmalı'; END IF;
    NEW.sure_dakika := EXTRACT(EPOCH FROM (NEW.bitis - NEW.baslangic)) / 60.0;
  ELSE
    NEW.sure_dakika := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_session_pauses_calc ON public.session_pauses;
CREATE TRIGGER trg_session_pauses_calc BEFORE INSERT OR UPDATE ON public.session_pauses
FOR EACH ROW EXECUTE FUNCTION public.session_pauses_calc();

CREATE INDEX IF NOT EXISTS idx_session_pauses_session ON public.session_pauses(session_id);

CREATE OR REPLACE FUNCTION public.production_sessions_calc()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
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
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_production_sessions_calc ON public.production_sessions;
CREATE TRIGGER trg_production_sessions_calc BEFORE INSERT OR UPDATE ON public.production_sessions
FOR EACH ROW EXECUTE FUNCTION public.production_sessions_calc();

ALTER PUBLICATION supabase_realtime ADD TABLE public.session_pauses;