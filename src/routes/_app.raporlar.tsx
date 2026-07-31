import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BarChart3, Clock, Layers, Package, TrendingUp, AlertTriangle } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SacKesimRaporu } from "@/components/sac-kesim-raporu";
import { OturumRaporu } from "@/components/oturum-raporu";
import { KullaniciRaporu } from "@/components/kullanici-raporu";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/raporlar")({
  component: RaporlarPage,
  head: () => ({
    meta: [
      { title: "Raporlar — CNC Plazma Üretim Takibi" },
      { name: "description", content: "CNC Plazma makinesi için günlük, haftalık ve aylık üretim, tonaj, çalışma ve duruş raporları." },
      { property: "og:title", content: "Raporlar — CNC Plazma Üretim Takibi" },
      { property: "og:description", content: "Günlük, haftalık ve aylık plazma kesim ve duruş raporları." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Period = "gunluk" | "haftalik" | "aylik";

function rangeFor(p: Period) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (p === "haftalik") {
    const day = (start.getDay() + 6) % 7; // pazartesi = 0
    start.setDate(start.getDate() - day);
  } else if (p === "aylik") {
    start.setDate(1);
  }
  return { start, end: now };
}

const dayFmt = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit" });

function RaporlarPage() {
  const [period, setPeriod] = useState<Period>("gunluk");
  const { start } = rangeFor(period);
  const startIso = start.toISOString();

  const { data: cuts } = useQuery({
    queryKey: ["plasma-cuts", startIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plasma_cuts")
        .select("id,levha_adedi,toplam_agirlik_kg,sure_dakika,baslangic,sac_tipi,kalinlik_mm")
        .gte("baslangic", startIso)
        .order("baslangic");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: downtimes } = useQuery({
    queryKey: ["downtime-report", startIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("downtime_logs")
        .select("id,sure_dakika,created_at,downtime_categories(ad)")
        .gte("created_at", startIso)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const ozet = useMemo(() => {
    const levha = (cuts ?? []).reduce((s, c) => s + (c.levha_adedi ?? 0), 0);
    const kg = (cuts ?? []).reduce((s, c) => s + Number(c.toplam_agirlik_kg ?? 0), 0);
    const calismaDk = (cuts ?? []).reduce((s, c) => s + Number(c.sure_dakika ?? 0), 0);
    const durusDk = (downtimes ?? []).reduce((s, d) => s + Number(d.sure_dakika ?? 0), 0);
    const toplam = calismaDk + durusDk;
    return {
      levha,
      ton: kg / 1000,
      calismaSaat: calismaDk / 60,
      durusSaat: durusDk / 60,
      ortalamaDk: levha > 0 ? calismaDk / levha : 0,
      tonSaat: calismaDk > 0 ? kg / 1000 / (calismaDk / 60) : 0,
      kullanim: toplam > 0 ? (calismaDk / toplam) * 100 : 0,
    };
  }, [cuts, downtimes]);

  const gunler = useMemo(() => {
    const map = new Map<string, { levha: number; kg: number; calisma: number; durus: number }>();
    const get = (k: string) => {
      if (!map.has(k)) map.set(k, { levha: 0, kg: 0, calisma: 0, durus: 0 });
      return map.get(k)!;
    };
    for (const c of cuts ?? []) {
      const k = new Date(c.baslangic).toISOString().slice(0, 10);
      const e = get(k);
      e.levha += c.levha_adedi ?? 0;
      e.kg += Number(c.toplam_agirlik_kg ?? 0);
      e.calisma += Number(c.sure_dakika ?? 0);
    }
    for (const d of downtimes ?? []) {
      const k = new Date(d.created_at).toISOString().slice(0, 10);
      get(k).durus += Number(d.sure_dakika ?? 0);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [cuts, downtimes]);

  const durusSebep = useMemo(() => {
    const map = new Map<string, { dk: number; adet: number }>();
    for (const d of downtimes ?? []) {
      const ad = (d as { downtime_categories?: { ad?: string } }).downtime_categories?.ad ?? "Diğer";
      const e = map.get(ad) ?? { dk: 0, adet: 0 };
      e.dk += Number(d.sure_dakika ?? 0);
      e.adet += 1;
      map.set(ad, e);
    }
    return [...map.entries()].sort((a, b) => b[1].dk - a[1].dk);
  }, [downtimes]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl tracking-tight">Raporlar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          CNC Plazma üretim, tonaj ve duruş performans raporları.
        </p>
      </div>

      <Tabs defaultValue="performans">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performans">Performans</TabsTrigger>
          <TabsTrigger value="sac">Sac Kesim</TabsTrigger>
          <TabsTrigger value="oturum">İş Oturumları</TabsTrigger>
          <TabsTrigger value="kullanici">Kullanıcılar</TabsTrigger>
        </TabsList>
        <TabsContent value="sac" className="pt-4"><SacKesimRaporu /></TabsContent>
        <TabsContent value="oturum" className="pt-4"><OturumRaporu /></TabsContent>
        <TabsContent value="kullanici" className="pt-4"><KullaniciRaporu /></TabsContent>

        <TabsContent value="performans" className="pt-4">

      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="gunluk">Günlük</TabsTrigger>
          <TabsTrigger value="haftalik">Haftalık</TabsTrigger>
          <TabsTrigger value="aylik">Aylık</TabsTrigger>
        </TabsList>


        <TabsContent value={period} className="space-y-6 pt-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={Layers} label="Kesilen Levha" value={String(ozet.levha)} suffix="adet" />
            <Kpi icon={Package} label="Toplam Tonaj" value={ozet.ton.toFixed(3)} suffix="ton" />
            <Kpi icon={Clock} label="Çalışma Süresi" value={ozet.calismaSaat.toFixed(1)} suffix="saat" />
            <Kpi icon={AlertTriangle} label="Duruş Süresi" value={ozet.durusSaat.toFixed(1)} suffix="saat" />
            <Kpi icon={TrendingUp} label="Ort. Levha Süresi" value={ozet.ortalamaDk.toFixed(1)} suffix="dk/levha" />
            <Kpi icon={TrendingUp} label="Verimlilik" value={ozet.tonSaat.toFixed(2)} suffix="ton/saat" />
            <Kpi icon={BarChart3} label="Makine Kullanımı" value={ozet.kullanim.toFixed(1)} suffix="%" />
            <Kpi icon={BarChart3} label="Kayıt Sayısı" value={String(cuts?.length ?? 0)} suffix="kesim" />
          </div>

          <section className="rounded-2xl border bg-card p-5 shadow-industrial">
            <h2 className="mb-3 font-display text-lg tracking-wide">GÜN BAZLI KARŞILAŞTIRMA</h2>
            {gunler.length === 0 ? (
              <p className="text-sm text-muted-foreground">Bu dönemde kayıt bulunmuyor.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-2">Gün</th>
                      <th className="py-2">Levha</th>
                      <th className="py-2">Ton</th>
                      <th className="py-2">Çalışma (s)</th>
                      <th className="py-2">Duruş (s)</th>
                      <th className="py-2">Kullanım</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gunler.map(([k, v]) => {
                      const t = v.calisma + v.durus;
                      return (
                        <tr key={k} className="border-t border-border/60">
                          <td className="py-2 font-medium">{dayFmt.format(new Date(k))}</td>
                          <td className="py-2">{v.levha}</td>
                          <td className="py-2">{(v.kg / 1000).toFixed(3)}</td>
                          <td className="py-2">{(v.calisma / 60).toFixed(1)}</td>
                          <td className="py-2">{(v.durus / 60).toFixed(1)}</td>
                          <td className="py-2">{t > 0 ? ((v.calisma / t) * 100).toFixed(0) : "0"}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border bg-card p-5 shadow-industrial">
            <h2 className="mb-3 font-display text-lg tracking-wide">DURUŞ SEBEPLERİ</h2>
            {durusSebep.length === 0 ? (
              <p className="text-sm text-muted-foreground">Bu dönemde duruş kaydı yok.</p>
            ) : (
              <ul className="space-y-2">
                {durusSebep.map(([ad, v]) => {
                  const max = durusSebep[0][1].dk || 1;
                  return (
                    <li key={ad}>
                      <div className="flex justify-between text-sm">
                        <span>{ad}</span>
                        <span className="text-muted-foreground">
                          {(v.dk / 60).toFixed(1)} saat · {v.adet} kez
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-warning" style={{ width: `${(v.dk / max) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </TabsContent>
      </Tabs>
        </TabsContent>
      </Tabs>
    </div>

  );
}

function Kpi({
  icon: Icon, label, value, suffix,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  suffix: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-industrial">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] uppercase tracking-widest">{label}</span>
      </div>
      <div className="mt-2 font-display text-2xl">{value}</div>
      <div className="text-xs text-muted-foreground">{suffix}</div>
    </div>
  );
}
