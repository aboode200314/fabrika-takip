import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { forwardToWebhook } from "@/lib/webhook.functions";

export const Route = createFileRoute("/_app/kalite")({
  component: KalitePage,
});

const SHIFTS = ["Sabah", "Akşam", "Gece"] as const;

const schema = z.object({
  machine_id: z.string().uuid({ message: "Makine seçiniz" }),
  product_id: z.string().uuid({ message: "Ürün seçiniz" }),
  vardiya: z.enum(SHIFTS),
  red_miktari: z.coerce.number().int().positive("Red miktarı > 0 olmalı").max(100000),
  notlar: z.string().max(500).optional(),
});

function KalitePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: machines } = useQuery({
    queryKey: ["machines-active"],
    queryFn: async () => {
      const { data } = await supabase.from("machines").select("id,kod,ad").eq("aktif", true).order("kod");
      return data ?? [];
    },
  });
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id,kod,ad").order("kod");
      return data ?? [];
    },
  });

  const [machine, setMachine] = useState("");
  const [product, setProduct] = useState("");
  const [shift, setShift] = useState<(typeof SHIFTS)[number] | "">("");
  const [red, setRed] = useState("");
  const [notlar, setNotlar] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = schema.safeParse({
      machine_id: machine,
      product_id: product,
      vardiya: shift,
      red_miktari: red,
      notlar: notlar || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);

    const { error } = await supabase.from("quality_logs").insert({
      operator_id: user!.id,
      machine_id: parsed.data.machine_id,
      product_id: parsed.data.product_id,
      vardiya: parsed.data.vardiya,
      red_miktari: parsed.data.red_miktari,
      notlar: parsed.data.notlar ?? null,
    });
    if (error) {
      setBusy(false);
      toast.error("Kayıt başarısız: " + error.message);
      return;
    }

    const { data: ws } = await supabase
      .from("webhook_settings")
      .select("kalite_url")
      .eq("id", 1)
      .maybeSingle();
    if (ws?.kalite_url) {
      const mach = machines?.find((m) => m.id === machine);
      const prod = products?.find((p) => p.id === product);
      await forwardToWebhook({
        data: {
          url: ws.kalite_url,
          payload: {
            operator: profile?.personel_id,
            machine: mach?.kod,
            product: prod?.ad,
            shift: parsed.data.vardiya,
            reject_qty: parsed.data.red_miktari,
            notes: parsed.data.notlar,
            timestamp: new Date().toISOString(),
          },
        },
      }).catch(() => undefined);
    }

    setBusy(false);
    toast.success("Kalite kaydı eklendi");
    qc.invalidateQueries({ queryKey: ["operator-today-counts"] });
    navigate({ to: "/panel" });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl tracking-tight">Kalite Raporu</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hatalı / red edilen ürün miktarını kaydedin.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-destructive/40 bg-card p-6 shadow-industrial">
        <FieldSelect label="Makine" value={machine} onChange={setMachine} placeholder="Makine seçiniz">
          {machines?.map((m) => (
            <SelectItem key={m.id} value={m.id} className="text-base">
              {m.kod} — {m.ad}
            </SelectItem>
          ))}
        </FieldSelect>

        <FieldSelect label="Ürün" value={product} onChange={setProduct} placeholder="Ürün seçiniz">
          {products?.map((p) => (
            <SelectItem key={p.id} value={p.id} className="text-base">
              {p.kod} — {p.ad}
            </SelectItem>
          ))}
        </FieldSelect>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Vardiya</Label>
          <div className="grid grid-cols-3 gap-2">
            {SHIFTS.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setShift(s)}
                className={`tap-target rounded-lg border-2 px-3 py-3 text-base font-semibold transition-colors ${
                  shift === s
                    ? "border-destructive bg-destructive/15 text-destructive"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="red" className="text-sm font-medium">Red Miktarı (adet)</Label>
          <Input
            id="red"
            type="number"
            min={1}
            inputMode="numeric"
            value={red}
            onChange={(e) => setRed(e.target.value)}
            className="tap-target text-2xl font-display"
            placeholder="0"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notlar" className="text-sm font-medium">Notlar (ops.)</Label>
          <Textarea
            id="notlar"
            value={notlar}
            onChange={(e) => setNotlar(e.target.value)}
            placeholder="Hata türü, detay..."
            maxLength={500}
            rows={3}
          />
        </div>

        <Button type="submit" disabled={busy} className="tap-target w-full gap-2 text-base">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          Gönder
        </Button>
      </form>
    </div>
  );
}

function FieldSelect({
  label, value, onChange, placeholder, children,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="tap-target text-base">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}
