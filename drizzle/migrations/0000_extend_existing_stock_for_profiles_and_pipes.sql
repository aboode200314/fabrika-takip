ALTER TABLE public.sheet_stock ADD COLUMN malzeme_turu text NOT NULL DEFAULT 'sac', ADD COLUMN yukseklik_mm numeric, ADD COLUMN dis_cap_mm numeric, ADD COLUMN ic_cap_mm numeric;
ALTER TABLE public.sheet_stock ADD CONSTRAINT stock_material_type CHECK (malzeme_turu IN ('sac','profil','boru'));
ALTER TABLE public.sheet_stock ADD CONSTRAINT stock_profile_dimensions CHECK (malzeme_turu <> 'profil' OR (genislik_mm > 0 AND yukseklik_mm > 0 AND kalinlik_mm > 0 AND uzunluk_mm > 0 AND kalinlik_mm * 2 < LEAST(genislik_mm,yukseklik_mm)));
ALTER TABLE public.sheet_stock ADD CONSTRAINT stock_pipe_dimensions CHECK (malzeme_turu <> 'boru' OR (dis_cap_mm > 0 AND ic_cap_mm >= 0 AND dis_cap_mm > ic_cap_mm AND uzunluk_mm > 0));
ALTER TABLE public.sheet_stock DROP CONSTRAINT sheet_stock_sac_tipi_kalinlik_mm_uzunluk_mm_genislik_mm_key;
CREATE UNIQUE INDEX sheet_stock_sheet_dimensions ON public.sheet_stock(sac_tipi,kalinlik_mm,uzunluk_mm,genislik_mm) WHERE malzeme_turu='sac';
CREATE UNIQUE INDEX sheet_stock_profile_dimensions ON public.sheet_stock(sac_tipi,genislik_mm,yukseklik_mm,uzunluk_mm,kalinlik_mm) WHERE malzeme_turu='profil';
CREATE UNIQUE INDEX sheet_stock_pipe_dimensions ON public.sheet_stock(sac_tipi,dis_cap_mm,ic_cap_mm,uzunluk_mm) WHERE malzeme_turu='boru';
ALTER TABLE public.production_sessions ADD COLUMN malzeme_snapshot jsonb;
ALTER TABLE public.sheet_stock_moves ADD COLUMN malzeme_snapshot jsonb;
CREATE FUNCTION public.stock_material_session_validate() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE s public.sheet_stock; machine_name text;
BEGIN
 IF NEW.stok_id IS NOT NULL THEN
  SELECT * INTO s FROM public.sheet_stock WHERE id=NEW.stok_id;
  IF s.malzeme_turu IN ('profil','boru') THEN
   SELECT kod || ' ' || ad INTO machine_name FROM public.machines WHERE id=NEW.machine_id;
   IF machine_name !~* '(testere|trstere|trştere|saw)' THEN RAISE EXCEPTION 'Profil/Boru yalnızca Testere makinesinde kullanılabilir'; END IF;
   IF NEW.levha_adedi IS NULL OR NEW.levha_adedi <= 0 THEN RAISE EXCEPTION 'Geçerli tüketim adedi gerekli'; END IF;
   IF TG_OP='UPDATE' AND OLD.stok_dusuldu AND (NEW.stok_id IS DISTINCT FROM OLD.stok_id OR NEW.levha_adedi IS DISTINCT FROM OLD.levha_adedi) THEN RAISE EXCEPTION 'Tamamlanan tüketim değiştirilemez; ters kayıt kullanın'; END IF;
   IF NEW.bitis IS NOT NULL AND NOT NEW.stok_dusuldu THEN
    PERFORM 1 FROM public.sheet_stock WHERE id=NEW.stok_id FOR UPDATE;
    SELECT adet INTO s.adet FROM public.sheet_stock WHERE id=NEW.stok_id;
    IF NEW.levha_adedi > s.adet THEN RAISE EXCEPTION 'Yetersiz stok'; END IF;
   END IF;
   IF TG_OP='INSERT' THEN NEW.stok_dusuldu := false; END IF;
   NEW.malzeme_snapshot := to_jsonb(s) - 'adet' - 'notlar' - 'created_at' - 'updated_at';
  END IF;
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.stock_material_session_validate() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zy_stock_material_validate BEFORE INSERT OR UPDATE ON public.production_sessions FOR EACH ROW EXECUTE FUNCTION public.stock_material_session_validate();
CREATE FUNCTION public.stock_material_move_validate() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE s public.sheet_stock; original public.sheet_stock_moves;
BEGIN
 SELECT * INTO s FROM public.sheet_stock WHERE id=NEW.stock_id;
 IF s.malzeme_turu IN ('profil','boru') THEN
  IF auth.uid() IS NOT NULL AND pg_trigger_depth()=1 THEN
   IF NOT public.has_permission(auth.uid(), CASE WHEN NEW.ters_kayit_id IS NOT NULL THEN 'stok.duzelt' WHEN NEW.degisim>0 THEN 'stok.giris' ELSE 'stok.cikis' END) THEN RAISE EXCEPTION 'Yetki yok'; END IF;
   NEW.stok_uygulandi := false; NEW.user_id := auth.uid(); NEW.user_ad := NULL;
  END IF;
  PERFORM 1 FROM public.sheet_stock WHERE id=NEW.stock_id FOR UPDATE;
  SELECT adet INTO s.adet FROM public.sheet_stock WHERE id=NEW.stock_id;
  IF NOT NEW.stok_uygulandi AND s.adet + NEW.degisim < 0 THEN RAISE EXCEPTION 'Yetersiz stok'; END IF;
  IF NEW.ters_kayit_id IS NOT NULL THEN
   SELECT * INTO original FROM public.sheet_stock_moves WHERE id=NEW.ters_kayit_id FOR UPDATE;
   IF original.stock_id IS DISTINCT FROM NEW.stock_id OR original.degisim <> -NEW.degisim OR original.ters_kayit_id IS NOT NULL OR EXISTS(SELECT 1 FROM public.sheet_stock_moves WHERE ters_kayit_id=original.id) THEN RAISE EXCEPTION 'Geçersiz ters kayıt'; END IF;
  END IF;
  NEW.birim := 'adet';
  NEW.malzeme_snapshot := to_jsonb(s) - 'adet' - 'notlar' - 'created_at' - 'updated_at';
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.stock_material_move_validate() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER aa_stock_material_move_validate BEFORE INSERT ON public.sheet_stock_moves FOR EACH ROW EXECUTE FUNCTION public.stock_material_move_validate();