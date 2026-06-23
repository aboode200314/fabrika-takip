
-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('operator', 'supervisor');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  personel_id TEXT UNIQUE NOT NULL,
  ad_soyad TEXT NOT NULL,
  departman TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_read_self" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile + default operator role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, personel_id, ad_soyad, departman)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'personel_id', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'ad_soyad', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'departman'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operator');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Master data
CREATE TABLE public.machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kod TEXT UNIQUE NOT NULL,
  ad TEXT NOT NULL,
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machines TO authenticated;
GRANT ALL ON public.machines TO service_role;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "machines_read" ON public.machines FOR SELECT TO authenticated USING (true);
CREATE POLICY "machines_write_supervisor" ON public.machines FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor')) WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kod TEXT UNIQUE NOT NULL,
  ad TEXT NOT NULL,
  ideal_cevrim_saniye INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_read" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_write_supervisor" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor')) WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

CREATE TABLE public.product_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sira INTEGER NOT NULL,
  ad TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, sira)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_operations TO authenticated;
GRANT ALL ON public.product_operations TO service_role;
ALTER TABLE public.product_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_operations_read" ON public.product_operations FOR SELECT TO authenticated USING (true);
CREATE POLICY "product_operations_write_supervisor" ON public.product_operations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor')) WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

CREATE TABLE public.downtime_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.downtime_categories TO authenticated;
GRANT ALL ON public.downtime_categories TO service_role;
ALTER TABLE public.downtime_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dc_read" ON public.downtime_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "dc_write_supervisor" ON public.downtime_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor')) WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

-- Transaction tables
CREATE TYPE public.shift_type AS ENUM ('Sabah', 'Akşam', 'Gece');

CREATE TABLE public.production_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  operation_id UUID NOT NULL REFERENCES public.product_operations(id),
  vardiya public.shift_type NOT NULL,
  miktar INTEGER NOT NULL CHECK (miktar > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_logs TO authenticated;
GRANT ALL ON public.production_logs TO service_role;
ALTER TABLE public.production_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pl_insert_self" ON public.production_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = operator_id);
CREATE POLICY "pl_read_self_or_supervisor" ON public.production_logs FOR SELECT TO authenticated
  USING (auth.uid() = operator_id OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "pl_update_supervisor" ON public.production_logs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "pl_delete_supervisor" ON public.production_logs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'));

CREATE TABLE public.downtime_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id),
  category_id UUID NOT NULL REFERENCES public.downtime_categories(id),
  vardiya public.shift_type NOT NULL,
  sure_dakika INTEGER NOT NULL CHECK (sure_dakika > 0),
  notlar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.downtime_logs TO authenticated;
GRANT ALL ON public.downtime_logs TO service_role;
ALTER TABLE public.downtime_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dl_insert_self" ON public.downtime_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = operator_id);
CREATE POLICY "dl_read_self_or_supervisor" ON public.downtime_logs FOR SELECT TO authenticated
  USING (auth.uid() = operator_id OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "dl_update_supervisor" ON public.downtime_logs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "dl_delete_supervisor" ON public.downtime_logs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));

CREATE TABLE public.quality_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  vardiya public.shift_type NOT NULL,
  red_miktari INTEGER NOT NULL CHECK (red_miktari > 0),
  notlar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_logs TO authenticated;
GRANT ALL ON public.quality_logs TO service_role;
ALTER TABLE public.quality_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ql_insert_self" ON public.quality_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = operator_id);
CREATE POLICY "ql_read_self_or_supervisor" ON public.quality_logs FOR SELECT TO authenticated
  USING (auth.uid() = operator_id OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "ql_update_supervisor" ON public.quality_logs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "ql_delete_supervisor" ON public.quality_logs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));

-- Webhook settings (singleton)
CREATE TABLE public.webhook_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  uretim_url TEXT,
  durus_url TEXT,
  kalite_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.webhook_settings TO authenticated;
GRANT ALL ON public.webhook_settings TO service_role;
ALTER TABLE public.webhook_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_read" ON public.webhook_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "ws_write_supervisor" ON public.webhook_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor')) WITH CHECK (public.has_role(auth.uid(), 'supervisor'));
INSERT INTO public.webhook_settings (id) VALUES (1);

-- Seed data
INSERT INTO public.machines (kod, ad) VALUES
  ('M-01', 'CNC Kesim Makinesi 1'),
  ('M-02', 'Kenar Bantlama 1'),
  ('M-03', 'Delik Makinesi'),
  ('M-04', 'Montaj Hattı 1');

INSERT INTO public.downtime_categories (ad) VALUES
  ('Mekanik'), ('Elektrik'), ('Kurulum'), ('Malzeme'),
  ('Kalite'), ('Operatör'), ('Diğer');

WITH p1 AS (INSERT INTO public.products (kod, ad, ideal_cevrim_saniye) VALUES ('P-001', 'Mutfak Dolabı', 600) RETURNING id),
     p2 AS (INSERT INTO public.products (kod, ad, ideal_cevrim_saniye) VALUES ('P-002', 'Masa', 300) RETURNING id)
INSERT INTO public.product_operations (product_id, sira, ad)
SELECT id, sira, ad FROM p1, (VALUES (1,'Kesim'),(2,'Kenar Bantlama'),(3,'Delme'),(4,'Montaj'),(5,'Kapak Montajı'),(6,'Final Kontrol'),(7,'Paketleme')) AS o(sira, ad)
UNION ALL
SELECT id, sira, ad FROM p2, (VALUES (1,'Kesim'),(2,'Delme'),(3,'Montaj'),(4,'Paketleme')) AS o(sira, ad);
