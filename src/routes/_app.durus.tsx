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

export const Route = createFileRoute("/_app/durus")({
  component: DurusPage,
});

const SHIFTS = ["Sabah", "Akşam", "Gece"] as const;

const schema = z.object({
  machine_id: z.string().uuid({ message: "Makine seçiniz" }),
  category_id: z.string().uuid({ message: "Duruş kategorisi seçiniz" }),
  vardiya: z.enum(SHIFTS),
  sure_dakika: z.coerce.number().int().positive("Süre > 0 olmalı").max(1440),
  notlar: z.string().max(500).optional(),
});

function DurusPage() {
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
  const { data: categories } = useQuery({
    queryKey: ["downtime-cats"],
    queryFn: async () => {
      const { data } = await supabase.from("downtime_categories").select("id,ad").order("ad");
      return data ?? [];
    },
  });

  const [machine, setMachine] = useState("");
  const [cat, setCat] = useState("");
  const [shift, setShift] = useState<(typeof SHIFTS)[number] | "">("");
  const [sure, setSure] = useState("");
  const [notlar, setNotlar] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = schema.safeParse({
      machine_id: machine,
      category_id: cat,
      vardiya: shift,
      sure_dakika: sure,
      notlar: notlar || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);

    const { error } = await supabase.from("downtime_logs").insert({
      operator_id: user!.id,
      machine_id: parsed.data.machine_id,
      category_id: parsed.data.category_id,
      vardiya: parsed.data.vardiya,
      sure_dakika: parsed.data.sure_dakika,
      notlar: parsed.data.notlar ?? null,
    });
    if (error) {
      setBusy(false);
      toast.error("Kayıt başarısız: " + error.message);
      return;
    }

    const { data: ws } = await supabase
      .from("webhook_settings")
      .select("durus_url")
      .eq("id", 1)
      .maybeSingle();
    if (ws?.durus_url) {
      const mach = machines?.find((m) => m.id === machine);
      const c = categories?.find((x) => x.id === cat);
      await forwardToWebhook({
        data: {
          url: ws.durus_url,
          payload: {
            operator: profile?.personel_id,
            machine: mach?.kod,
            category: c?.ad,
            shift: parsed.data.vardiya,
            duration_min: parsed.data.sure_dakika,
            notes: parsed.data.notlar,
            timestamp: new Date().toISOString(),
          },
        },
      }).catch(() => undefined);
    }

    setBusy(false);
    toast.success("Duruş bildirildi");
    qc.invalidateQueries({ queryKey: ["operator-today-counts"] });
    navigate({ to: "/panel" });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl tracking-tight">Duruş Bildirimi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Makinede yaşanan duruşu kategorisi ve süresi ile bildirin.
        </p>
      </div>

      <form onSubmit={onSubmit} className="hatched-bg space-y-5 rounded-2xl border border-warning/40 bg-card p-6 shadow-industrial">
        <FieldSelect label="Makine" value={machine} onChange={setMachine} placeholder="Makine seçiniz">
          {machines?.map((m) => (
            <SelectItem key={m.id} value={m.id} className="text-base">
              {m.kod} — {m.ad}
            </SelectItem>
          ))}
        </FieldSelect>

        <FieldSelect label="Duruş Kategorisi" value={cat} onChange={setCat} placeholder="Kategori seçiniz">
          {categories?.map((c) => (
            <SelectItem key={c.id} value={c.id} className="text-base">
              {c.ad}
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
                    ? "border-warning bg-warning/15 text-warning"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sure" className="text-sm font-medium">Duruş Süresi (dakika)</Label>
          <Input
            id="sure"
            type="number"
            min={1}
            inputMode="numeric"
            value={sure}
            onChange={(e) => setSure(e.target.value)}
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
            placeholder="Detay açıklama..."
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
