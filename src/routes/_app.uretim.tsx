import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { forwardToWebhook } from "@/lib/webhook.functions";

export const Route = createFileRoute("/_app/uretim")({
  component: UretimPage,
});

const SHIFTS = ["Sabah", "Akşam", "Gece"] as const;

const schema = z.object({
  machine_id: z.string().uuid({ message: "Makine seçiniz" }),
  product_id: z.string().uuid({ message: "Ürün seçiniz" }),
  operation_id: z.string().uuid({ message: "Operasyon seçiniz" }),
  vardiya: z.enum(SHIFTS),
  miktar: z.coerce.number().int().positive("Miktar > 0 olmalı").max(100000),
});

function UretimPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: machines } = useQuery({
    queryKey: ["machines-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("id,kod,ad")
        .eq("aktif", true)
        .order("kod");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,kod,ad").order("kod");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [machine, setMachine] = useState("");
  const [product, setProduct] = useState("");
  const [operation, setOperation] = useState("");
  const [shift, setShift] = useState<(typeof SHIFTS)[number] | "">("");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: operations } = useQuery({
    queryKey: ["product-operations", product],
    enabled: !!product,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_operations")
        .select("id,sira,ad")
        .eq("product_id", product)
        .order("sira");
      if (error) throw error;
      return data ?? [];
    },
  });

  // reset operation when product changes
  useEffect(() => { setOperation(""); }, [product]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = schema.safeParse({
      machine_id: machine,
      product_id: product,
      operation_id: operation,
      vardiya: shift,
      miktar: qty,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);

    const { error } = await supabase.from("production_logs").insert({
      operator_id: user!.id,
      machine_id: parsed.data.machine_id,
      product_id: parsed.data.product_id,
      operation_id: parsed.data.operation_id,
      vardiya: parsed.data.vardiya,
      miktar: parsed.data.miktar,
    });

    if (error) {
      setBusy(false);
      toast.error("Kayıt başarısız: " + error.message);
      return;
    }

    // best-effort webhook
    const { data: ws } = await supabase
      .from("webhook_settings")
      .select("uretim_url")
      .eq("id", 1)
      .maybeSingle();
    if (ws?.uretim_url) {
      const mach = machines?.find((m) => m.id === machine);
      const prod = products?.find((p) => p.id === product);
      const op = operations?.find((o) => o.id === operation);
      await forwardToWebhook({
        data: {
          url: ws.uretim_url,
          payload: {
            operator: profile?.personel_id,
            machine: mach?.kod,
            product: prod?.ad,
            operation: op?.ad,
            shift: parsed.data.vardiya,
            quantity: parsed.data.miktar,
            timestamp: new Date().toISOString(),
          },
        },
      }).catch(() => undefined);
    }

    setBusy(false);
    toast.success("Üretim kaydı eklendi");
    qc.invalidateQueries({ queryKey: ["operator-today-counts"] });
    navigate({ to: "/panel" });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl tracking-tight">Üretim Girişi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Makine, ürün ve operasyon seçip ürettiğiniz miktarı girin.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border bg-card p-6 shadow-industrial">
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

        <FieldSelect
          label="Operasyon"
          value={operation}
          onChange={setOperation}
          placeholder={product ? "Operasyon seçiniz" : "Önce ürün seçiniz"}
          disabled={!product}
        >
          {operations?.map((o) => (
            <SelectItem key={o.id} value={o.id} className="text-base">
              {o.sira}. {o.ad}
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
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="miktar" className="text-sm font-medium">Üretim Miktarı (adet)</Label>
          <Input
            id="miktar"
            type="number"
            min={1}
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="tap-target text-2xl font-display"
            placeholder="0"
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
  label,
  value,
  onChange,
  placeholder,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="tap-target text-base">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}
