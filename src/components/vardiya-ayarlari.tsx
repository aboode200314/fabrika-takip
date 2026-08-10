import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Coffee, Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { WEEKDAYS } from "@/lib/permissions";

interface Schedule {
  id: string;
  gun: number;
  tatil: boolean;
  baslangic: string | null;
  bitis: string | null;
}
interface Break {
  id: string;
  schedule_id: string | null;
  ad: string;
  baslangic: string;
  bitis: string;
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");
const dakika = (a: string | null, b: string | null) => {
  if (!a || !b) return 0;
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return Math.max(0, (bh * 60 + bm) - (ah * 60 + am));
};

export function VardiyaAyarlari() {
  const qc = useQueryClient();

  const { data: schedules, isLoading } = useQuery({
    queryKey: ["work-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_schedules").select("id,gun,tatil,baslangic,bitis");
      if (error) throw error;
      return (data ?? []) as Schedule[];
    },
  });

  const { data: breaks } = useQuery({
    queryKey: ["work-breaks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_breaks").select("id,schedule_id,ad,baslangic,bitis").order("baslangic");
      if (error) throw error;
      return (data ?? []) as Break[];
    },
  });

  async function updateSchedule(id: string, patch: Partial<Schedule>) {
    const { error } = await supabase.from("work_schedules").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["work-schedules"] });
  }

  const haftalikNet = (schedules ?? []).reduce((s, sc) => {
    if (sc.tatil) return s;
    const molalar = (breaks ?? []).filter((b) => b.schedule_id === sc.id)
      .reduce((t, b) => t + dakika(b.baslangic, b.bitis), 0);
    return s + Math.max(0, dakika(sc.baslangic, sc.bitis) - molalar);
  }, 0);

  if (isLoading) {
    return <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Haftalık Net Çalışma</div>
          <div className="mt-1 font-display text-3xl">
            {(haftalikNet / 60).toFixed(1)}<span className="ml-1 text-sm text-muted-foreground">saat</span>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Çalışma Günü</div>
          <div className="mt-1 font-display text-3xl">
            {(schedules ?? []).filter((s) => !s.tatil).length}<span className="ml-1 text-sm text-muted-foreground">gün</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Net çalışma süresi = (bitiş − başlangıç) − molalar. OEE hesabında planlı üretim süresi bu ayarlardan alınır.
      </p>

      <div className="space-y-3">
        {WEEKDAYS.map((d) => {
          const sc = (schedules ?? []).find((s) => s.gun === d.gun);
          if (!sc) return null;
          const gunMolalari = (breaks ?? []).filter((b) => b.schedule_id === sc.id);
          const molaDk = gunMolalari.reduce((t, b) => t + dakika(b.baslangic, b.bitis), 0);
          const net = sc.tatil ? 0 : Math.max(0, dakika(sc.baslangic, sc.bitis) - molaDk);
          return (
            <section key={sc.id} className="rounded-2xl border bg-card p-5">
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[130px]">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-display text-lg tracking-wide">{d.ad}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Net {(net / 60).toFixed(1)} sa · Mola {molaDk} dk
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={sc.tatil} onCheckedChange={(v) => updateSchedule(sc.id, { tatil: v })} />
                  Tatil
                </label>

                <div className="space-y-1.5">
                  <Label className="text-xs">Başlangıç</Label>
                  <Input
                    type="time" className="w-32" disabled={sc.tatil} value={hhmm(sc.baslangic)}
                    onChange={(e) => updateSchedule(sc.id, { baslangic: e.target.value || null })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bitiş</Label>
                  <Input
                    type="time" className="w-32" disabled={sc.tatil} value={hhmm(sc.bitis)}
                    onChange={(e) => updateSchedule(sc.id, { bitis: e.target.value || null })}
                  />
                </div>
              </div>

              {!sc.tatil && <Molalar scheduleId={sc.id} items={gunMolalari} />}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Molalar({ scheduleId, items }: { scheduleId: string; items: Break[] }) {
  const qc = useQueryClient();
  const [ad, setAd] = useState("");
  const [bas, setBas] = useState("");
  const [bit, setBit] = useState("");

  async function ekle(e: React.FormEvent) {
    e.preventDefault();
    if (!ad.trim() || !bas || !bit) return toast.error("Mola adı ve saatleri gerekli");
    const { error } = await supabase.from("work_breaks")
      .insert({ schedule_id: scheduleId, ad: ad.trim(), baslangic: bas, bitis: bit });
    if (error) return toast.error(error.message);
    setAd(""); setBas(""); setBit("");
    qc.invalidateQueries({ queryKey: ["work-breaks"] });
  }

  return (
    <div className="mt-4 space-y-2 border-t pt-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Coffee className="h-4 w-4" /> Molalar
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((b) => (
          <div key={b.id} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
            <span>{b.ad}</span>
            <span className="font-mono text-xs text-muted-foreground">{hhmm(b.baslangic)}–{hhmm(b.bitis)}</span>
            <button
              onClick={async () => {
                const { error } = await supabase.from("work_breaks").delete().eq("id", b.id);
                if (error) return toast.error(error.message);
                qc.invalidateQueries({ queryKey: ["work-breaks"] });
              }}
              aria-label={`${b.ad} molasını sil`}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          </div>
        ))}
        {items.length === 0 && <span className="text-xs text-muted-foreground">Mola tanımlı değil.</span>}
      </div>
      <form onSubmit={ekle} className="flex flex-wrap gap-2 pt-1">
        <Input placeholder="Mola adı" value={ad} onChange={(e) => setAd(e.target.value)} className="w-40" />
        <Input type="time" value={bas} onChange={(e) => setBas(e.target.value)} className="w-32" />
        <Input type="time" value={bit} onChange={(e) => setBit(e.target.value)} className="w-32" />
        <Button type="submit" variant="outline" size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> Mola Ekle
        </Button>
      </form>
    </div>
  );
}
