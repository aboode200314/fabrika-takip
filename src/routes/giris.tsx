import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Factory, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { personelIdToEmail, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/giris")({
  component: GirisPage,
});

const loginSchema = z.object({
  personel_id: z.string().trim().min(2, "Personel ID gerekli").max(40),
  sifre: z.string().min(6, "Şifre en az 6 karakter"),
});

const signupSchema = loginSchema.extend({
  ad_soyad: z.string().trim().min(2, "Ad Soyad gerekli").max(80),
  departman: z.string().trim().max(80).optional(),
});

function GirisPage() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (session) return <Navigate to="/" replace />;
  return <GirisForm />;
}

function GirisForm() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"giris" | "kayit">("giris");

  async function onLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({
      personel_id: fd.get("personel_id"),
      sifre: fd.get("sifre"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: personelIdToEmail(parsed.data.personel_id),
      password: parsed.data.sifre,
    });
    setBusy(false);
    if (error) {
      toast.error("Giriş başarısız: " + error.message);
      return;
    }
    toast.success("Giriş başarılı");
    navigate({ to: "/" });
  }

  async function onSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      personel_id: fd.get("personel_id"),
      sifre: fd.get("sifre"),
      ad_soyad: fd.get("ad_soyad"),
      departman: fd.get("departman") || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: personelIdToEmail(parsed.data.personel_id),
      password: parsed.data.sifre,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: {
          personel_id: parsed.data.personel_id.trim(),
          ad_soyad: parsed.data.ad_soyad,
          departman: parsed.data.departman,
        },
      },
    });
    setBusy(false);
    if (error) {
      toast.error("Kayıt başarısız: " + error.message);
      return;
    }
    toast.success("Hesap oluşturuldu, yönlendiriliyorsunuz...");
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/30">
            <Factory className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl tracking-tight">FABRİKA OEE / MES</h1>
          <p className="mt-1 text-sm text-muted-foreground">Üretim takip ve verimlilik sistemi</p>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-industrial">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "giris" | "kayit")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="giris">Giriş Yap</TabsTrigger>
              <TabsTrigger value="kayit">Yeni Hesap</TabsTrigger>
            </TabsList>

            <TabsContent value="giris">
              <form onSubmit={onLogin} className="mt-4 space-y-4">
                <Field name="personel_id" label="Personel ID" placeholder="örn. op001" autoFocus />
                <Field name="sifre" label="Şifre" type="password" placeholder="••••••" />
                <Button type="submit" disabled={busy} className="tap-target w-full text-base">
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Giriş Yap"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="kayit">
              <form onSubmit={onSignup} className="mt-4 space-y-4">
                <Field name="personel_id" label="Personel ID" placeholder="örn. op001" />
                <Field name="ad_soyad" label="Ad Soyad" placeholder="Ahmet Yılmaz" />
                <Field name="departman" label="Departman (ops.)" placeholder="Üretim" />
                <Field name="sifre" label="Şifre" type="password" placeholder="en az 6 karakter" />
                <Button type="submit" disabled={busy} className="tap-target w-full text-base">
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Hesap Oluştur"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Yeni hesaplar varsayılan olarak <strong>Operatör</strong> yetkisine sahiptir.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Endüstriyel tablet ve telefon için tasarlandı.
        </p>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  placeholder,
  autoFocus,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="text-sm font-medium">
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="tap-target text-base"
        autoComplete={
          name === "sifre" ? (type === "password" ? "current-password" : "off") : "off"
        }
      />
    </div>
  );
}
