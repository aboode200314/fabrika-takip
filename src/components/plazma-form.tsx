import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Send, Flame } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const SHIFTS = ["Sabah", "Akşam", "Gece"] as const;

export const SAC_TIPLERI = [
  { ad: "S235 / St37 (Siyah Sac)", yogunluk: 7.85 },
  { ad: "S355 (Yüksek Mukavemetli)", yogunluk: 7.85 },
  { ad: "Paslanmaz 304", yogunluk: 7.9 },
  { ad: "Paslanmaz 316", yogunluk: 8.0 },
  { ad: "Alüminyum", yogunluk: 2.7 },
  { ad: "Galvaniz", yogunluk: 7.85 },
  { ad: "Diğer", yogunluk: 7.85 },
];

const schema = z.object({
  machine_id: z.string().uuid({ message: "Makine seçiniz" }),
  vardiya: z.enum(SHIFTS, { message: "Vardiya seçiniz" }),
  uzunluk_mm: z.coerce.number().positive("Uzunluk > 0 olmalı"),
  genislik_mm: z.coerce.number().positive("Genişlik > 0 olmalı"),
  kalinlik_mm: z.coerce.number().positive("Kalınlık > 0 olmalı"),
  levha_adedi: z.coerce.number().int().positive("Levha adedi > 0 olmalı"),
  baslangic: z.string().min(1, "Kesim başlangıç saati giriniz"),
  bitis: z.string().min(1, "Kesim bitiş saati giriniz"),
});

function nowLocal(offsetMin = 0) {
  const d = new Date(Date.now() + offsetMin * 60000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PlazmaForm() {
  const { user } = useAuth();
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

  const [machine, setMachine] = useState("");
  const [shift, setShift] = useState<(typeof SHIFTS)[number] | "">("");
  const [sacTipi, setSacTipi] = useState(SAC_TIPLERI[0].ad);
  const [uzunluk, setUzunluk] = useState("6000");
  const [genislik, setGenislik] = useState("1500");
  const [kalinlik, setKalinlik] = useState("");
  const [adet, setAdet] = useState("1");
  const [baslangic, setBaslangic] = useState(nowLocal(-30));
  const [bitis, setBitis] = useState(nowLocal());
  const [notlar, setNotlar] = useState("");
  const [busy, setBusy] = useState(false);

  const yogunluk = SAC_TIPLERI.find((s) => s.ad === sacTipi)?.yogunluk ?? 7.85;

  const hesap = useMemo(() => {
    const u = Number(uzunluk), g = Number(genislik), k = Number(kalinlik), a = Number(adet);
    const birim = (u * g * k * yogunluk) / 1_000_000; // kg
    const toplam = birim * (a || 0);
    const dk =
      baslangic && bitis
        ? (new Date(bitis).getTime() - new Date(baslangic).getTime()) / 60000
        : 0;
    return {
      birim: Number.isFinite(birim) ? birim : 0,
      toplam: Number.isFinite(toplam) ? toplam : 0,
      dk: Number.isFinite(dk) ? dk : 0,
      ortalama: a > 0 && dk > 0 ? dk / a : 0,
      tonSaat: dk > 0 ? toplam / 1000 / (dk / 60) : 0,
    };
  }, [uzunluk, genislik, kalinlik, adet, yogunluk, baslangic, bitis]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = schema.safeParse({
      machine_id: machine,
      vardiya: shift,
      uzunluk_mm: uzunluk,
      genislik_mm: genislik,
      kalinlik_mm: kalinlik,
      levha_adedi: adet,
      baslangic,
      bitis,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (new Date(bitis) <= new Date(baslangic)) {
      toast.error("Bitiş saati başlangıçtan sonra olmalı");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("plasma_cuts").insert({
      operator_id: user!.id,
      machine_id: parsed.data.machine_id,
      vardiya: parsed.data.vardiya,
      sac_tipi: sacTipi,
      uzunluk_mm: parsed.data.uzunluk_mm,
      genislik_mm: parsed.data.genislik_mm,
      kalinlik_mm: parsed.data.kalinlik_mm,
      yogunluk,
      levha_adedi: parsed.data.levha_adedi,
      baslangic: new Date(baslangic).toISOString(),
      bitis: new Date(bitis).toISOString(),
      notlar: notlar || null,
    });
    setBusy(false);
    if (error) {
      toast.error("Kayıt başarısız: " + error.message);
      return;
    }
    toast.success("Plazma kesim kaydı eklendi");
    setKalinlik("");
    setAdet("1");
    setNotlar("");
    setBaslangic(nowLocal(-30));
    setBitis(nowLocal());
    qc.invalidateQueries({ queryKey: ["plasma-cuts"] });
    qc.invalidateQueries({ queryKey: ["operator-today-counts"] });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border bg-card p-6 shadow-industrial">
      <div className="flex items-center gap-2 text-primary">
        <Flame className="h-5 w-5" />
        <span className="font-display text-lg tracking-wide">CNC PLAZMA KESİM</span>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Makine</Label>
        <Select value={machine} onValueChange={setMachine}>
          <SelectTrigger className="tap-target text-base">
            <SelectValue placeholder="Makine seçiniz" />
          </SelectTrigger>
          <SelectContent>
            {machines?.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-base">
                {m.kod} — {m.ad}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Sac Tipi</Label>
        <Select value={sacTipi} onValueChange={setSacTipi}>
          <SelectTrigger className="tap-target text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SAC_TIPLERI.map((s) => (
              <SelectItem key={s.ad} value={s.ad} className="text-base">
                {s.ad} ({s.yogunluk} g/cm³)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <NumField label="Uzunluk (mm)" value={uzunluk} onChange={setUzunluk} />
        <NumField label="Genişlik (mm)" value={genislik} onChange={setGenislik} />
        <NumField label="Kalınlık (mm)" value={kalinlik} onChange={setKalinlik} step="0.1" />
      </div>

      <NumField label="Kesilen Levha Adedi" value={adet} onChange={setAdet} big />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Kesim Başlangıç</Label>
          <Input type="datetime-local" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} className="tap-target text-base" />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Kesim Bitiş</Label>
          <Input type="datetime-local" value={bitis} onChange={(e) => setBitis(e.target.value)} className="tap-target text-base" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:grid-cols-4">
        <Stat label="Levha Ağırlığı" value={`${hesap.birim.toFixed(1)} kg`} />
        <Stat label="Toplam" value={`${(hesap.toplam / 1000).toFixed(3)} ton`} />
        <Stat label="Kesim Süresi" value={`${hesap.dk.toFixed(0)} dk`} />
        <Stat label="Verimlilik" value={`${hesap.tonSaat.toFixed(2)} t/s`} />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Notlar (ops.)</Label>
        <Textarea value={notlar} onChange={(e) => setNotlar(e.target.value)} rows={2} maxLength={500} placeholder="İş emri no, açıklama..." />
      </div>

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

      <Button type="submit" disabled={busy} className="tap-target w-full gap-2 text-base">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        Kaydet
      </Button>
    </form>
  );
}

function NumField({
  label, value, onChange, step, big,
}: {
  label: string; value: string; onChange: (v: string) => void; step?: string; big?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <Input
        type="number"
        min={0}
        step={step ?? "1"}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`tap-target font-display ${big ? "text-2xl" : "text-base"}`}
        placeholder="0"
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-lg">{value}</div>
    </div>
  );
}
