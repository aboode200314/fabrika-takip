import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

function isoDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function SacKesimRaporu() {
  const today = isoDay(new Date());
  const weekAgo = isoDay(new Date(Date.now() - 6 * 86400000));
  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(today);
  const [operator, setOperator] = useState("all");
  const [machine, setMachine] = useState("all");

  const { data: profiles } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,ad_soyad,personel_id").order("ad_soyad");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: machines } = useQuery({
    queryKey: ["machines-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("machines").select("id,kod,ad").order("kod");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rows } = useQuery({
    queryKey: ["sac-kesim", from, to, operator, machine],
    queryFn: async () => {
      let q = supabase
        .from("plasma_cuts")
        .select("id,operator_id,machine_id,sac_tipi,uzunluk_mm,genislik_mm,kalinlik_mm,levha_adedi,toplam_agirlik_kg,sure_dakika,baslangic")
        .gte("baslangic", new Date(`${from}T00:00:00`).toISOString())
        .lte("baslangic", new Date(`${to}T23:59:59`).toISOString())
        .order("baslangic");
      if (operator !== "all") q = q.eq("operator_id", operator);
      if (machine !== "all") q = q.eq("machine_id", machine);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { gun: string; kalinlik: string; olcu: string; tip: string; kesim: number; levha: number; kg: number; dk: number }
    >();
    for (const r of rows ?? []) {
      const gun = new Date(r.baslangic).toISOString().slice(0, 10);
      const kalinlik = `${Number(r.kalinlik_mm)} mm`;
      const olcu = `${Number(r.uzunluk_mm)}×${Number(r.genislik_mm)}`;
      const tip = r.sac_tipi ?? "—";
      const key = `${gun}|${kalinlik}|${olcu}|${tip}`;
      const e = map.get(key) ?? { gun, kalinlik, olcu, tip, kesim: 0, levha: 0, kg: 0, dk: 0 };
      e.kesim += 1;
      e.levha += r.levha_adedi ?? 0;
      e.kg += Number(r.toplam_agirlik_kg ?? 0);
      e.dk += Number(r.sure_dakika ?? 0);
      map.set(key, e);
    }
    return [...map.values()].sort((a, b) => (a.gun === b.gun ? b.levha - a.levha : b.gun.localeCompare(a.gun)));
  }, [rows]);


  const totals = useMemo(
    () =>
      grouped.reduce(
        (s, g) => ({ kesim: s.kesim + g.kesim, levha: s.levha + g.levha, kg: s.kg + g.kg }),
        { kesim: 0, levha: 0, kg: 0 },
      ),
    [grouped],
  );

  function exportCsv() {
    const head = ["Tarih", "Sac Ölçüsü (mm)", "Sac Tipi", "Kesim Sayısı", "Levha Adedi", "Toplam kg", "Süre (dk)"];
    const lines = grouped.map((g) =>
      [g.gun, g.olcu, g.tip, g.kesim, g.levha, g.kg.toFixed(1), g.dk.toFixed(1)].join(";"),
    );
    const csv = "\uFEFF" + [head.join(";"), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `sac-kesim-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-card p-5 shadow-industrial">
        <div className="mb-3 flex items-center gap-2 text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span className="text-[11px] uppercase tracking-widest">Filtreler</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Başlangıç</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="tap-target" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Bitiş</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="tap-target" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Operatör</Label>
            <Select value={operator} onValueChange={setOperator}>
              <SelectTrigger className="tap-target"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                {profiles?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.ad_soyad ?? p.personel_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Makine</Label>
            <Select value={machine} onValueChange={setMachine}>
              <SelectTrigger className="tap-target"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                {machines?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.kod} — {m.ad}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-industrial">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg tracking-wide">SAC KESİM RAPORU</h2>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv} disabled={grouped.length === 0}>
            <Download className="h-4 w-4" /> CSV
          </Button>
        </div>

        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">Seçilen filtrelerde kayıt bulunamadı.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2">Tarih</th>
                  <th className="py-2">Sac Ölçüsü (mm)</th>
                  <th className="py-2">Tip</th>
                  <th className="py-2">Kesim Sayısı</th>
                  <th className="py-2">Levha Adedi</th>
                  <th className="py-2">Toplam kg</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((g) => (
                  <tr key={`${g.gun}|${g.olcu}|${g.tip}`} className="border-t border-border/60">
                    <td className="py-2 font-medium">{dateFmt.format(new Date(g.gun))}</td>
                    <td className="py-2 font-display">{g.olcu}</td>
                    <td className="py-2 text-muted-foreground">{g.tip}</td>
                    <td className="py-2">{g.kesim}</td>
                    <td className="py-2">{g.levha}</td>
                    <td className="py-2">{g.kg.toFixed(1)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border font-semibold">
                  <td className="py-2" colSpan={3}>TOPLAM</td>
                  <td className="py-2">{totals.kesim}</td>
                  <td className="py-2">{totals.levha}</td>
                  <td className="py-2">{totals.kg.toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
