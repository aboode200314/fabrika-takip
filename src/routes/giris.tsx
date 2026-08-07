import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import gvnLogo from "@/assets/gvn-logo.jpg.asset.json";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { personelIdToEmail, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/giris")({
  component: GirisPage,
});

const loginSchema = z.object({
  personel_id: z.string().trim().min(2, "Personel ID gerekli").max(40),
  sifre: z.string().min(6, "Şifre en az 6 karakter"),
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

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_60%)]" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={gvnLogo.url} alt="GVN Trailer logosu" className="h-16 w-auto" />
          <h1 className="mt-4 text-2xl tracking-tight">ÜRETİM TAKİP SİSTEMİ</h1>
          <p className="mt-1 text-sm text-muted-foreground">OEE · Makine performansı · Sac stok</p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-industrial">
          <h2 className="text-lg font-semibold">Giriş Yap</h2>
          <form onSubmit={onLogin} className="mt-4 space-y-4">
            <Field name="personel_id" label="Personel ID" placeholder="örn. op001" autoFocus />
            <Field name="sifre" label="Şifre" type="password" placeholder="••••••" />
            <Button type="submit" disabled={busy} className="tap-target w-full text-base">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Giriş Yap"}
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">
            Yeni hesaplar yalnızca yönetici tarafından Yönetim → Kullanıcılar bölümünden oluşturulur.
            Hesabınız yoksa yöneticinize başvurun.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          GVN Trailer · Endüstriyel tablet ve telefon için tasarlandı.
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
