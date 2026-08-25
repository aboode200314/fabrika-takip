import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Filter, UserSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";

function isoDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

const dtFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});

interface Sess {
  id: string;
  operator_id: string;
  machine_id: string;
  product_id: string | null;
  vardiya: string;
  baslangic: string;
  bitis: string | null;
  sure_dakika: number | null;
  miktar: number | null;
  hurda: number;
  durum: string;
  toplam_durus_dakika: number;
  durus_sayisi: number;
}

export function KullaniciRaporu() {
  const t = useT();
  const today = isoDay(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [operator, setOperator] = useState("all");

  const { data: profiles } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,ad_soyad,personel_id,unvan").order("ad_soyad");
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
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,kod,ad").order("kod");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: sessions } = useQuery({
    queryKey: ["kullanici-raporu", from, to, operator],
    queryFn: async () => {
      let q = supabase
        .from("production_sessions")
        .select("id,operator_id,machine_id,product_id,vardiya,baslangic,bitis,sure_dakika,miktar,hurda,durum,toplam_durus_dakika,durus_sayisi")
        .gte("baslangic", new Date(`${from}T00:00:00`).toISOString())
        .lte("baslangic", new Date(`${to}T23:59:59`).toISOString())
        .order("baslangic", { ascending: false });
      if (operator !== "all") q = q.eq("operator_id", operator);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Sess[];
    },
  });

  const ids = (sessions ?? []).map((s) => s.id);
  const { data: pauses } = useQuery({
    queryKey: ["kullanici-raporu-pauses", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_pauses")
        .select("id,session_id,neden,baslangic,bitis,sure_dakika")
        .in("session_id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });

  const nameOf = (id: string) => {
    const p = profiles?.find((x) => x.id === id);
    return p?.ad_soyad ?? p?.personel_id ?? "—";
  };
  const machineOf = (id: string) => machines?.find((m) => m.id === id)?.kod ?? "—";
  const productOf = (id: string | null) => {
    if (!id) return "—";
    const p = products?.find((x) => x.id === id);
    return p ? `${p.kod} — ${p.ad}` : "—";
  };
  const pausesOf = (sid: string) => (pauses ?? []).filter((p) => p.session_id === sid);
  const pauseMinutes = (sid: string) =>
    pausesOf(sid).reduce((s, p) => s + Number(p.sure_dakika ?? 0), 0);

  const totals = useMemo(() => {
    const list = sessions ?? [];
    return {
      oturum: list.length,
      miktar: list.reduce((s, r) => s + (r.miktar ?? 0), 0),
      calisma: list.reduce((s, r) => s + Number(r.sure_dakika ?? 0), 0),
      durus: list.reduce((s, r) => s + pauseMinutes(r.id), 0),
      // eslint-disable-next-line react-hooks/exhaustive-deps
    };
  }, [sessions, pauses]);

  function exportCsv() {
    const head = [
      t("rap.kullanici.csvTarih"), t("rap.kullanici.csvPersonel"), t("rap.kullanici.csvMakine"),
      t("rap.kullanici.csvUrun"), t("rap.kullanici.csvVardiya"), t("rap.kullanici.csvBaslangic"),
      t("rap.kullanici.csvBitis"), t("rap.kullanici.csvCalisma"), t("rap.kullanici.csvDurus"),
      t("rap.kullanici.csvDurusSayisi"), t("rap.kullanici.csvDurusSebepleri"), t("rap.kullanici.csvMiktar"),
      t("rap.kullanici.csvHurda"),
    ];
    const lines = (sessions ?? []).map((s) =>
      [
        s.baslangic.slice(0, 10),
        nameOf(s.operator_id),
        machineOf(s.machine_id),
        productOf(s.product_id),
        s.vardiya,
        dtFmt.format(new Date(s.baslangic)),
        s.bitis ? dtFmt.format(new Date(s.bitis)) : t("rap.kullanici.devamEdiyor"),
        Number(s.sure_dakika ?? 0).toFixed(1),
        pauseMinutes(s.id).toFixed(1),
        pausesOf(s.id).length,
        pausesOf(s.id).map((p) => p.neden).join(" / "),
        s.miktar ?? "",
        s.hurda ?? 0,
      ].join(";"),
    );
    const csv = "\uFEFF" + [head.join(";"), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `kullanici-raporu-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const seciliProfil = profiles?.find((p) => p.id === operator);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-card p-5 shadow-industrial">
        <div className="mb-3 flex items-center gap-2 text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span className="text-[11px] uppercase tracking-widest">{t("rap.filtreler")}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("rap.baslangicTarihi")}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="tap-target" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("rap.bitisTarihi")}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="tap-target" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("rap.kullanici")}</Label>
            <Select value={operator} onValueChange={setOperator}>
              <SelectTrigger className="tap-target"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("rap.tumu")}</SelectItem>
                {profiles?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.ad_soyad ?? p.personel_id}{p.unvan ? ` — ${p.unvan}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {seciliProfil && (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <UserSearch className="h-4 w-4" />
            {seciliProfil.ad_soyad} · {seciliProfil.unvan ?? t("rap.kullanici.unvanYok")} · {t("rap.kullanici.personelId").replace("{id}", seciliProfil.personel_id ?? "")}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t("rap.kullanici.kpi.oturum")} value={String(totals.oturum)} suffix={t("rap.kullanici.kpi.oturum.suffix")} />
        <Kpi label={t("rap.kullanici.kpi.uretim")} value={String(totals.miktar)} suffix={t("rap.kullanici.kpi.uretim.suffix")} />
        <Kpi label={t("rap.kullanici.kpi.calisma")} value={(totals.calisma / 60).toFixed(1)} suffix={t("rap.kullanici.kpi.calisma.suffix")} />
        <Kpi label={t("rap.kullanici.kpi.durus")} value={(totals.durus / 60).toFixed(1)} suffix={t("rap.kullanici.kpi.durus.suffix")} />
      </div>

      <section className="rounded-2xl border bg-card p-5 shadow-industrial">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg tracking-wide">{t("rap.kullanici.title")}</h2>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv} disabled={(sessions ?? []).length === 0}>
            <Download className="h-4 w-4" /> CSV
          </Button>
        </div>
        {(sessions ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("rap.kullanici.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-start text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2">{t("rap.kullanici.personel")}</th>
                  <th className="py-2">{t("rap.makine")}</th>
                  <th className="py-2">{t("rap.urun")}</th>
                  <th className="py-2">{t("rap.kullanici.vardiya")}</th>
                  <th className="py-2">{t("rap.baslangic")}</th>
                  <th className="py-2">{t("rap.bitis")}</th>
                  <th className="py-2">{t("rap.kullanici.calismaDk")}</th>
                  <th className="py-2">{t("rap.kullanici.durusDk")}</th>
                  <th className="py-2">{t("rap.kullanici.durusSebepleri")}</th>
                  <th className="py-2">{t("rap.oturum.miktar")}</th>
                </tr>
              </thead>
              <tbody>
                {(sessions ?? []).map((s) => (
                  <tr key={s.id} className="border-t border-border/60 align-top">
                    <td className="py-2 font-medium">{nameOf(s.operator_id)}</td>
                    <td className="py-2">{machineOf(s.machine_id)}</td>
                    <td className="py-2 text-muted-foreground">{productOf(s.product_id)}</td>
                    <td className="py-2">{s.vardiya}</td>
                    <td className="py-2 whitespace-nowrap">{dtFmt.format(new Date(s.baslangic))}</td>
                    <td className="py-2 whitespace-nowrap">
                      {s.bitis ? dtFmt.format(new Date(s.bitis)) : <span className="text-success">{t("rap.kullanici.devamEdiyor")}</span>}
                    </td>
                    <td className="py-2">{Number(s.sure_dakika ?? 0).toFixed(0)}</td>
                    <td className="py-2 text-warning">{pauseMinutes(s.id).toFixed(0)}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {pausesOf(s.id).length === 0
                        ? "—"
                        : pausesOf(s.id).map((p) => `${p.neden} (${t("rap.kullanici.dkKisaltma").replace("{n}", Number(p.sure_dakika ?? 0).toFixed(0))})`).join(", ")}
                    </td>
                    <td className="py-2 font-display">{s.miktar ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-industrial">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-2xl">{value}</div>
      <div className="text-xs text-muted-foreground">{suffix}</div>
    </div>
  );
}
