import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Activity, AlertTriangle, Clock, Gauge, Package, Percent, XCircle } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { plannedMinutes } from "@/lib/planned-time";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/_app/makineler")({
  component: MakinelerPage,
  head: () => ({
    meta: [
      { title: "Makine Performansı (OEE) — GVN Trailer" },
      { name: "description", content: "Her makine için Kullanılabilirlik, Performans, Kalite ve OEE değerleri, üretim, hurda, çalışma ve duruş süreleri." },
      { property: "og:title", content: "Makine Performansı (OEE) — GVN Trailer" },
      { property: "og:description", content: "Makine bazlı OEE analizi, duruş sebepleri ve verimlilik göstergeleri." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Period = "gun" | "hafta" | "ay" | "ozel";

function isoDay(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function rangeFor(p: Period, from: string, to: string) {
  if (p === "ozel") {
    return { start: new Date(`${from}T00:00:00`), end: new Date(`${to}T23:59:59`) };
  }
  const end = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (p === "hafta") start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  if (p === "ay") start.setDate(1);
  return { start, end };
}

function MakinelerPage() {
  const t = useT();
  const [period, setPeriod] = useState<Period>("gun");
  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 6 * 86400000)));
  const [to, setTo] = useState(isoDay(new Date()));
  const [machineId, setMachineId] = useState<string>("all");
  const { isSuperAdmin, allowedDepartmentIds } = useAuth();

  const { start, end } = rangeFor(period, from, to);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const { data: allMachines } = useQuery({
    queryKey: ["machines-all"],
    queryFn: async () =>
      (await supabase.from("machines").select("id,kod,ad,department_id").order("kod")).data ?? [],
  });
  // Departman kapsamı tanımlı kullanıcılar yalnızca kendi hatlarının makinelerini görür
  const machines = useMemo(() => {
    const list = allMachines ?? [];
    if (isSuperAdmin || !allowedDepartmentIds) return list;
    return list.filter((m) => !m.department_id || allowedDepartmentIds.includes(m.department_id));
  }, [allMachines, allowedDepartmentIds, isSuperAdmin]);

  const { data: products } = useQuery({
    queryKey: ["products-all"],
    queryFn: async () => (await supabase.from("products").select("id,kod,ad,ideal_cevrim_saniye")).data ?? [],
  });

  const { data: sessions } = useQuery({
    queryKey: ["oee-sessions", startIso, endIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_sessions")
        .select("id,machine_id,product_id,miktar,hurda,sure_dakika,toplam_durus_dakika,levha_adedi,baslangic,bitis")
        .gte("baslangic", startIso)
        .lte("baslangic", endIso);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: downtimes } = useQuery({
    queryKey: ["oee-downtimes", startIso, endIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("downtime_logs")
        .select("id,machine_id,sure_dakika,created_at,downtime_categories(ad)")
        .gte("created_at", startIso)
        .lte("created_at", endIso);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: schedules } = useQuery({ queryKey: ["work-schedules"], queryFn: async () => {
    const { data, error } = await supabase.from("work_schedules").select("id,gun,tatil,baslangic,bitis");
    if (error) throw error;
    return data ?? [];
  }, refetchInterval: 15000 });
  const { data: breaks } = useQuery({ queryKey: ["work-breaks"], queryFn: async () => {
    const { data, error } = await supabase.from("work_breaks").select("schedule_id,baslangic,bitis");
    if (error) throw error;
    return data ?? [];
  }, refetchInterval: 15000 });
  const planned = schedules && breaks ? plannedMinutes(period === "ozel" ? from : isoDay(start), period === "ozel" ? to : isoDay(end), schedules, breaks) : 0;

  const idealOf = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const p of products ?? []) m.set(p.id, p.ideal_cevrim_saniye ?? null);
    return m;
  }, [products]);

  const stats = useMemo(() => {
    const list = (machines ?? []).filter((m) => machineId === "all" || m.id === machineId);
    return list.map((m) => {
      const rows = (sessions ?? []).filter((s) => s.machine_id === m.id);
      const dts = (downtimes ?? []).filter((d) => d.machine_id === m.id);

      const calisma = rows.reduce((s, r) => s + Number(r.sure_dakika ?? 0), 0);
      const durusSes = rows.reduce((s, r) => s + Number(r.toplam_durus_dakika ?? 0), 0);
      const durusLog = dts.reduce((s, d) => s + Number(d.sure_dakika ?? 0), 0);
      const durus = durusSes + durusLog;
      const uretim = rows.reduce((s, r) => s + (r.miktar ?? 0), 0);
      const hurda = rows.reduce((s, r) => s + (r.hurda ?? 0), 0);
      const levha = rows.reduce((s, r) => s + Number(r.levha_adedi ?? 0), 0);

      const planli = planned;
      const availability = planli > 0 ? Math.min(100, (calisma / planli) * 100) : 0;

      let idealDk = 0;
      let idealVar = false;
      for (const r of rows) {
        const ideal = r.product_id ? idealOf.get(r.product_id) ?? null : null;
        if (ideal && r.miktar) {
          idealDk += (ideal * r.miktar) / 60;
          idealVar = true;
        }
      }
      const performance = idealVar && calisma > 0 ? Math.min((idealDk / calisma) * 100, 100) : null;
      const quality = uretim > 0 ? ((uretim - hurda) / uretim) * 100 : null;

      const oee =
        (availability / 100) *
        ((performance ?? 100) / 100) *
        ((quality ?? 100) / 100) *
        100;

      const sebepMap = new Map<string, { dk: number; adet: number }>();
      for (const d of dts) {
        const ad = (d as { downtime_categories?: { ad?: string } }).downtime_categories?.ad ?? t("mak.other");
        const e = sebepMap.get(ad) ?? { dk: 0, adet: 0 };
        e.dk += Number(d.sure_dakika ?? 0);
        e.adet += 1;
        sebepMap.set(ad, e);
      }
      const sebepler = [...sebepMap.entries()].sort((a, b) => b[1].dk - a[1].dk).slice(0, 5);

      return {
        machine: m, calisma, durus, uretim, hurda, levha,
        availability, performance, quality, oee, sebepler, planli,
        kayit: rows.length,
      };
    });
  }, [machines, machineId, sessions, downtimes, idealOf, planned]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl tracking-tight">{t("mak.heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("mak.subheading")}
        </p>
      </div>

      <section className="grid gap-3 rounded-xl border bg-card p-5 shadow-industrial sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("mak.period")}</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="tap-target"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gun">{t("mak.period.today")}</SelectItem>
              <SelectItem value="hafta">{t("mak.period.thisWeek")}</SelectItem>
              <SelectItem value="ay">{t("mak.period.thisMonth")}</SelectItem>
              <SelectItem value="ozel">{t("mak.period.custom")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("mak.machine")}</Label>
          <Select value={machineId} onValueChange={setMachineId}>
            <SelectTrigger className="tap-target"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("mak.machine.all")}</SelectItem>
              {machines?.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.kod} — {m.ad}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {period === "ozel" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("mak.start")}</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="tap-target" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("mak.end")}</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="tap-target" />
            </div>
          </>
        )}
      </section>

      {stats.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("mak.noMachines")}</p>
      )}

      {stats.map((s) => (
        <section key={s.machine.id} className="space-y-5 rounded-xl border bg-card p-5 shadow-industrial">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl">{s.machine.ad}</h2>
              <p className="font-mono text-xs text-muted-foreground">{s.machine.kod} · {s.kayit} {t("mak.records")}</p>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">OEE</div>
              <div className="font-display text-4xl text-primary">{s.oee.toFixed(1)}%</div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Metric label={t("mak.availability")} value={s.availability} tone="info" />
            <Metric label={t("mak.performance")} value={s.performance} tone="success" hint={s.performance === null ? t("mak.performance.hint") : undefined} />
            <Metric label={t("mak.quality")} value={s.quality} tone="warning" hint={s.quality === null ? t("mak.quality.hint") : undefined} />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Kpi icon={Clock} label={t("profil.planned")} value={(s.planli / 60).toFixed(1)} unit={t("mak.unit.hour")} tone="text-foreground" />
            <Kpi icon={Package} label={t("mak.kpi.produced")} value={String(s.uretim)} unit={t("mak.unit.piece")} tone="text-primary" />
            <Kpi icon={XCircle} label={t("mak.kpi.scrap")} value={String(s.hurda)} unit={t("mak.unit.piece")} tone="text-destructive" />
            <Kpi icon={Activity} label={t("mak.kpi.cutSheet")} value={s.levha.toFixed(2)} unit={t("mak.unit.sheet")} tone="text-foreground" />
            <Kpi icon={Clock} label={t("mak.kpi.running")} value={(s.calisma / 60).toFixed(1)} unit={t("mak.unit.hour")} tone="text-success" />
            <Kpi icon={AlertTriangle} label={t("mak.kpi.downtime")} value={(s.durus / 60).toFixed(1)} unit={t("mak.unit.hour")} tone="text-warning" />
            <Kpi icon={Gauge} label={t("mak.kpi.downtimeRatio")} value={(100 - s.availability).toFixed(1)} unit="%" tone="text-muted-foreground" />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">{t("mak.topDowntimeReasons")}</h3>
            {s.sebepler.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("mak.noDowntime")}</p>
            ) : (
              <ul className="space-y-2">
                {s.sebepler.map(([ad, v]) => (
                  <li key={ad}>
                    <div className="flex justify-between text-sm">
                      <span>{ad}</span>
                      <span className="text-muted-foreground">{`${(v.dk / 60).toFixed(1)} ${t("mak.hoursTimes").replace("{n}", String(v.adet))}`}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-warning"
                        style={{ width: `${(v.dk / (s.sebepler[0][1].dk || 1)) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function Metric({
  label, value, tone, hint,
}: {
  label: string;
  value: number | null;
  tone: "info" | "success" | "warning";
  hint?: string;
}) {
  const cls = { info: "[&>div]:bg-info", success: "[&>div]:bg-success", warning: "[&>div]:bg-warning" }[tone];
  const txt = { info: "text-info", success: "text-success", warning: "text-warning" }[tone];
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-muted-foreground">
        <span>{label}</span>
        <Percent className="h-3.5 w-3.5" />
      </div>
      <div className={`mt-2 font-display text-2xl ${txt}`}>{value === null ? "—" : `${value.toFixed(1)}%`}</div>
      <Progress value={value ?? 0} className={`mt-2 ${cls}`} />
      {hint && <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, unit, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unit: string;
  tone: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] uppercase tracking-widest">{label}</span>
      </div>
      <div className={`mt-1 font-display text-xl ${tone}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{unit}</div>
    </div>
  );
}
