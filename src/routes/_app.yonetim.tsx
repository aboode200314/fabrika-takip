import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";
import { Activity, Clock, Layers, TrendingUp, Trash2, Plus, Loader2, Save, Users, KeyRound, Cog } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  createWorkerAccount, deleteWorkerAccount, listWorkers, setWorkerRole,
  resetWorkerPassword, changeOwnPassword, setWorkerTitle,
} from "@/lib/workers.functions";

import { YetkilerTab } from "@/components/yetkiler-tab";
import { StokMerkezi } from "@/components/stok-merkezi";
import { DepartmanKapsam } from "@/components/departman-kapsam";
import { UrunAsamalari } from "@/components/urun-asamalari";
import { UretimEmirleri } from "@/components/uretim-emirleri";


import { VardiyaAyarlari } from "@/components/vardiya-ayarlari";
import { RollerTab } from "@/components/roller-tab";
import { DenetimKaydi } from "@/components/denetim-kaydi";
import { UrunYonetimi } from "@/components/urun-yonetimi";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { levhaKg, type StockRow } from "@/lib/sac";
import { useAuth } from "@/lib/auth";
import { LANGUAGES } from "@/lib/i18n";
import { DATA_SCOPES } from "@/lib/permissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/yonetim")({
  component: YonetimGate,
  head: () => ({
    meta: [
      { title: "Yönetim — Makine, Ürün, Sac Stok ve Kullanıcılar" }, // handled dynamically below
      { name: "description", content: "Süpervizör yönetim paneli: makine ve ürün tanımları, sac stok takibi, kullanıcı hesapları ve yetkiler." },
      { property: "og:title", content: "Yönetim — Fabrika OEE" },
      { property: "og:description", content: "Makine, ürün, sac stoğu ve kullanıcı yönetimi tek panelde." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function YonetimGate() {
  const { role, loading, isSuperAdmin } = useAuth();
  if (loading) return null;
  if (role !== "supervisor" && !isSuperAdmin) return <Navigate to="/panel" replace />;
  return <YonetimPanel />;
}

function YonetimPanel() {
  const t = useT();
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-muted-foreground">{t("yon.supervisorLabel")}</p>
        <h1 className="mt-1 text-3xl tracking-tight">{t("yon.panelTitle")}</h1>
      </div>

      <Tabs defaultValue="ozet" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="ozet">{t("yon.tab.ozet")}</TabsTrigger>
          <TabsTrigger value="master">{t("yon.tab.master")}</TabsTrigger>
          <TabsTrigger value="asamalar">{t("yon.tab.asamalar")}</TabsTrigger>
          <TabsTrigger value="emirler">{t("yon.tab.emirler", "Üretim Emirleri")}</TabsTrigger>
          <TabsTrigger value="stok">{t("yon.tab.stok")}</TabsTrigger>
          <TabsTrigger value="vardiya">{t("yon.tab.vardiya")}</TabsTrigger>
          <TabsTrigger value="erisim">{t("yon.tab.erisim")}</TabsTrigger>
          <TabsTrigger value="denetim">{t("yon.tab.denetim")}</TabsTrigger>
        </TabsList>

        <TabsContent value="ozet"><OzetTab /></TabsContent>
        <TabsContent value="master"><MasterTab /></TabsContent>
        <TabsContent value="asamalar"><UrunAsamalari /></TabsContent>
        <TabsContent value="emirler"><UretimEmirleri /></TabsContent>
        <TabsContent value="stok"><StokMerkezi /></TabsContent>
        <TabsContent value="vardiya"><VardiyaAyarlari /></TabsContent>
        <TabsContent value="erisim"><ErisimTab /></TabsContent>
        <TabsContent value="denetim"><DenetimKaydi /></TabsContent>
      </Tabs>

    </div>
  );
}

/* -------------------- ERİŞİM: Kullanıcı → Rol → Yetki → Kapsam -------------------- */
function ErisimTab() {
  const t = useT();
  return (
    <Tabs defaultValue="kullanicilar" className="space-y-4">
      <TabsList>
        <TabsTrigger value="kullanicilar">{t("yon.tab.kullanicilar")}</TabsTrigger>
        <TabsTrigger value="roller">{t("yon.tab.roller")}</TabsTrigger>
        <TabsTrigger value="yetkiler">{t("yon.tab.yetkiler")}</TabsTrigger>
        <TabsTrigger value="kapsam">{t("yon.tab.kapsam")}</TabsTrigger>
      </TabsList>
      <TabsContent value="kullanicilar"><KullanicilarTab /></TabsContent>
      <TabsContent value="roller"><RollerTab /></TabsContent>
      <TabsContent value="yetkiler"><YetkilerTab /></TabsContent>
      <TabsContent value="kapsam"><DepartmanKapsam /></TabsContent>
    </Tabs>
  );
}


/* -------------------- ÖZET (canlı oturum verisinden) -------------------- */
function OzetTab() {
  const t = useT();
  const { data } = useQuery({
    queryKey: ["yonetim-ozet"],
    queryFn: async () => {
      const since = new Date(); since.setHours(0, 0, 0, 0);
      const sinceIso = since.toISOString();
      const [{ data: sessions }, { data: mach }, { data: stock }] = await Promise.all([
        supabase.from("production_sessions")
          .select("id,machine_id,vardiya,miktar,hurda,sure_dakika,toplam_durus_dakika,bitis,durum,levha_adedi")
          .gte("baslangic", sinceIso),
        supabase.from("machines").select("id,kod,ad,aktif").order("kod"),
        supabase.from("sheet_stock").select("id,sac_tipi,kalinlik_mm,uzunluk_mm,genislik_mm,adet,kritik_adet,yogunluk,notlar"),
      ]);
      const rows = sessions ?? [];
      const toplamUretim = rows.reduce((s, r) => s + (r.miktar ?? 0), 0);
      const toplamHurda = rows.reduce((s, r) => s + (r.hurda ?? 0), 0);
      const toplamDurus = rows.reduce((s, r) => s + Number(r.toplam_durus_dakika ?? 0), 0);
      const calisma = rows.reduce((s, r) => s + Number(r.sure_dakika ?? 0), 0);

      const byShift = (key: "miktar" | "toplam_durus_dakika") => {
        const out: Record<string, number> = { Sabah: 0, Akşam: 0, Gece: 0 };
        for (const r of rows) out[r.vardiya] = (out[r.vardiya] ?? 0) + Number((r as never as Record<string, number>)[key] ?? 0);
        return out;
      };

      const durusByMach: Record<string, number> = {};
      const aktifByMach: Record<string, string> = {};
      for (const r of rows) {
        durusByMach[r.machine_id] = (durusByMach[r.machine_id] ?? 0) + Number(r.toplam_durus_dakika ?? 0);
        if (!r.bitis) aktifByMach[r.machine_id] = r.durum;
      }

      const stokRows = (stock ?? []) as StockRow[];
      return {
        toplamUretim, toplamHurda, toplamDurus, calisma,
        uretimVardiya: byShift("miktar"),
        durusVardiya: byShift("toplam_durus_dakika"),
        machines: (mach ?? []).map((m) => ({ ...m, durus: Math.round(durusByMach[m.id] ?? 0), canli: aktifByMach[m.id] ?? null })),
        stokLevha: stokRows.reduce((s, r) => s + r.adet, 0),
        stokTon: stokRows.reduce((s, r) => s + levhaKg(r) * r.adet, 0) / 1000,
        kritik: stokRows.filter((r) => r.adet <= r.kritik_adet),
      };
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI icon={TrendingUp} label={t("yon.ozet.uretimBugun")} value={data?.toplamUretim ?? 0} unit={t("yon.unit.adet")} tone="primary" />
        <KPI icon={Clock} label={t("yon.ozet.durusBugun")} value={Math.round(data?.toplamDurus ?? 0)} unit={t("yon.unit.dk")} tone="warning" />
        <KPI icon={Activity} label={t("yon.ozet.calismaBugun")} value={Math.round((data?.calisma ?? 0) / 60)} unit={t("yon.unit.saat")} tone="success" />
        <KPI icon={Layers} label={t("yon.ozet.sacStogu")} value={data?.stokLevha ?? 0} unit={t("yon.unit.levhaTon").replace("{t}", (data?.stokTon ?? 0).toFixed(1))} tone="primary" />
      </div>

      {!!data?.kritik.length && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <strong className="text-destructive">{t("yon.ozet.kritikStok")}</strong>{" "}
          {data.kritik.map((r) => `${r.sac_tipi} ${r.kalinlik_mm}mm (${r.adet})`).join(", ")}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("yon.ozet.vardiyaUretim")}>
          {(["Sabah", "Akşam", "Gece"] as const).map((s) => (
            <Row key={s} label={shiftLabel(t, s)} value={`${data?.uretimVardiya[s] ?? 0} ${t("yon.unit.adet")}`} pct={pct(data?.uretimVardiya[s] ?? 0, data?.toplamUretim ?? 0)} />
          ))}
        </Card>
        <Card title={t("yon.ozet.vardiyaDurus")}>
          {(["Sabah", "Akşam", "Gece"] as const).map((s) => (
            <Row key={s} label={shiftLabel(t, s)} value={`${Math.round(data?.durusVardiya[s] ?? 0)} ${t("yon.unit.dk")}`} pct={pct(data?.durusVardiya[s] ?? 0, data?.toplamDurus ?? 0)} tone="warning" />
          ))}
        </Card>
      </div>

      <Card title={t("yon.ozet.makineDurumu")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("yon.th.kod")}</TableHead>
              <TableHead>{t("yon.th.ad")}</TableHead>
              <TableHead>{t("yon.th.tanim")}</TableHead>
              <TableHead>{t("yon.th.canli")}</TableHead>
              <TableHead className="text-right">{t("yon.th.bugunDurus")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.machines.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono">{m.kod}</TableCell>
                <TableCell>{m.ad}</TableCell>
                <TableCell className="text-xs">{m.aktif ? t("yon.th.aktif") : t("yon.status.pasif")}</TableCell>
                <TableCell>
                  <span className={`inline-flex h-2.5 w-2.5 rounded-full ${m.canli === "running" ? "bg-success" : m.canli === "paused" ? "bg-warning" : "bg-muted-foreground/40"}`} />
                  <span className="ml-2 text-xs">{m.canli === "running" ? t("yon.status.calisiyor") : m.canli === "paused" ? t("yon.status.duraklatildi") : t("yon.status.bosta")}</span>
                </TableCell>
                <TableCell className="text-right">{m.durus} {t("yon.unit.dk")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function shiftLabel(t: ReturnType<typeof useT>, s: "Sabah" | "Akşam" | "Gece") {
  return s === "Sabah" ? t("yon.shift.sabah") : s === "Akşam" ? t("yon.shift.aksam") : t("yon.shift.gece");
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function KPI({ icon: Icon, label, value, unit, tone }: { icon: any; label: string; value: number; unit: string; tone: "primary" | "warning" | "destructive" | "success" }) {
  const cls = { primary: "text-primary", warning: "text-warning", destructive: "text-destructive", success: "text-success" }[tone];
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <Icon className={`h-5 w-5 ${cls}`} />
      </div>
      <div className={`mt-3 font-display text-4xl ${cls}`}>
        {value}<span className="ml-1 text-sm text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <h3 className="mb-4 text-lg">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value, pct, tone = "primary" }: { label: string; value: string; pct: number; tone?: "primary" | "warning" }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono text-muted-foreground">{value}</span>
      </div>
      <Progress value={pct} className={tone === "warning" ? "[&>div]:bg-warning" : ""} />
    </div>
  );
}

/* -------------------- MAKİNE & ÜRÜN -------------------- */
function MasterTab() {
  const t = useT();
  return (
    <Tabs defaultValue="makineler" className="space-y-4">
      <TabsList>
        <TabsTrigger value="makineler">{t("yon.tab.makineler")}</TabsTrigger>
        <TabsTrigger value="urunler">{t("yon.tab.urunler")}</TabsTrigger>
      </TabsList>
      <TabsContent value="makineler"><MakinelerCrud /></TabsContent>
      <TabsContent value="urunler"><UrunYonetimi /></TabsContent>
    </Tabs>
  );
}

function MakinelerCrud() {
  const t = useT();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["machines-all"],
    queryFn: async () => (await supabase.from("machines").select("*").order("kod")).data ?? [],
  });
  const [kod, setKod] = useState(""); const [ad, setAd] = useState("");

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2 rounded-xl border bg-card p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!kod || !ad) return toast.error(t("yon.mk.kodAdGerekli"));
          const { error } = await supabase.from("machines").insert({ kod, ad });
          if (error) return toast.error(error.message);
          setKod(""); setAd(""); toast.success(t("yon.mk.eklendi"));
          qc.invalidateQueries({ queryKey: ["machines-all"] });
          qc.invalidateQueries({ queryKey: ["machines-active"] });
        }}
      >
        <Input placeholder={t("yon.mk.kodPh")} value={kod} onChange={(e) => setKod(e.target.value)} className="w-32" />
        <Input placeholder={t("yon.mk.adPh")} value={ad} onChange={(e) => setAd(e.target.value)} className="flex-1 min-w-[200px]" />
        <Button type="submit" className="gap-1"><Plus className="h-4 w-4" />{t("yon.mk.ekle")}</Button>
      </form>
      <p className="text-xs text-muted-foreground">
        {t("yon.mk.note")}
      </p>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>{t("yon.th.kod")}</TableHead><TableHead>{t("yon.th.ad")}</TableHead><TableHead>{t("yon.th.aktif")}</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {data?.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono">{m.kod}</TableCell>
                <TableCell>{m.ad}</TableCell>
                <TableCell>
                  <Switch
                    checked={m.aktif}
                    onCheckedChange={async (v) => {
                      await supabase.from("machines").update({ aktif: v }).eq("id", m.id);
                      qc.invalidateQueries({ queryKey: ["machines-all"] });
                      qc.invalidateQueries({ queryKey: ["machines-active"] });
                    }}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={async () => {
                    if (!confirm(t("yon.mk.silConfirm"))) return;
                    const { error } = await supabase.from("machines").delete().eq("id", m.id);
                    if (error) return toast.error(error.message);
                    qc.invalidateQueries({ queryKey: ["machines-all"] });
                    qc.invalidateQueries({ queryKey: ["machines-active"] });
                  }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* -------------------- KULLANICILAR -------------------- */
function KullanicilarTab() {
  const t = useT();
  const qc = useQueryClient();
  const listFn = useServerFn(listWorkers);
  const createFn = useServerFn(createWorkerAccount);
  const deleteFn = useServerFn(deleteWorkerAccount);
  const roleFn = useServerFn(setWorkerRole);
  const pwFn = useServerFn(resetWorkerPassword);
  const titleFn = useServerFn(setWorkerTitle);

  const { data: workers, isLoading } = useQuery({
    queryKey: ["workers"],
    queryFn: () => listFn(),
  });

  const { data: departments } = useQuery({
    queryKey: ["departments-all"],
    queryFn: async () => (await supabase.from("departments").select("id,kod,ad,aktif").order("ad")).data ?? [],
  });

  const { data: roles } = useQuery({
    queryKey: ["roles-all"],
    queryFn: async () => (await supabase.from("roles").select("key,ad,sira").order("sira")).data ?? [],
  });

  const { data: machines } = useQuery({
    queryKey: ["machines-all"],
    queryFn: async () => (await supabase.from("machines").select("id,kod,ad").order("kod")).data ?? [],
  });

  const { data: extra } = useQuery({
    queryKey: ["workers-extra"],
    queryFn: async () => {
      const [{ data: profiles }, { data: assignments }, { data: userMachines }] = await Promise.all([
        supabase.from("profiles").select("id,aktif,department_id,dil,veri_kapsam"),
        supabase.from("user_role_assignments").select("user_id,role_key"),
        supabase.from("user_machines").select("user_id,machine_id"),
      ]);
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      const assignMap = new Map<string, string[]>();
      for (const a of assignments ?? []) {
        const arr = assignMap.get(a.user_id) ?? [];
        arr.push(a.role_key);
        assignMap.set(a.user_id, arr);
      }
      const machMap = new Map<string, string[]>();
      for (const m of userMachines ?? []) {
        const arr = machMap.get(m.user_id) ?? [];
        arr.push(m.machine_id);
        machMap.set(m.user_id, arr);
      }
      return { profileMap, assignMap, machMap };
    },
  });

  function invalidateWorkers() {
    qc.invalidateQueries({ queryKey: ["workers"] });
    qc.invalidateQueries({ queryKey: ["workers-extra"] });
  }

  const [personelId, setPersonelId] = useState("");
  const [adSoyad, setAdSoyad] = useState("");
  const [departman, setDepartman] = useState("");
  const [unvan, setUnvan] = useState("");
  const [password, setPassword] = useState("");
  const [makeSup, setMakeSup] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!personelId || !adSoyad || password.length < 6) {
      return toast.error(t("yon.kul.hataGerekli"));
    }
    setSubmitting(true);
    try {
      await createFn({
        data: {
          personel_id: personelId,
          ad_soyad: adSoyad,
          departman: departman || null,
          unvan: unvan || null,
          password,
          role: makeSup ? "supervisor" : "operator",
        },
      });
      toast.success(t("yon.kul.hesapOlusturuldu"));
      setPersonelId(""); setAdSoyad(""); setDepartman(""); setUnvan(""); setPassword(""); setMakeSup(false);
      invalidateWorkers();
    } catch (err: any) {
      toast.error(err?.message ?? t("yon.kul.hataOlustu"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
      <div className="space-y-4">
        <KendiSifreCard />
        <form onSubmit={handleCreate} className="space-y-3 rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-lg">{t("yon.kul.yeniHesap")}</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("yon.kul.aciklama")}
          </p>
          <div className="space-y-1.5">
            <Label className="text-sm">{t("yon.kul.personelId")}</Label>
            <Input value={personelId} onChange={(e) => setPersonelId(e.target.value)} placeholder={t("yon.kul.personelIdPh")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t("yon.kul.adSoyad")}</Label>
            <Input value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)} placeholder={t("yon.kul.adSoyadPh")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t("yon.kul.departman")} <span className="text-muted-foreground">{t("yon.kul.opsiyonel")}</span></Label>
            <Input value={departman} onChange={(e) => setDepartman(e.target.value)} placeholder={t("yon.kul.departmanPh")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t("yon.kul.unvan")} <span className="text-muted-foreground">{t("yon.kul.opsiyonel")}</span></Label>
            <Input value={unvan} onChange={(e) => setUnvan(e.target.value)} placeholder={t("yon.kul.unvanPh")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t("yon.kul.sifre")}</Label>
            <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("yon.kul.sifrePh")} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={makeSup} onCheckedChange={setMakeSup} />
            {t("yon.kul.supervisorYetki")}
          </label>
          <Button type="submit" disabled={submitting} className="w-full gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t("yon.kul.hesapOlustur")}
          </Button>
        </form>
      </div>

      <div className="rounded-2xl border bg-card overflow-x-auto">
        <div className="border-b p-4">
          <h3 className="text-lg">{t("yon.kul.calisanlar").replace("{n}", String(workers?.length ?? 0))}</h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t("yon.th.personelId")}</TableHead>
                <TableHead>{t("yon.th.adSoyad")}</TableHead>
                <TableHead>{t("yon.th.unvan")}</TableHead>
                <TableHead>{t("yon.th.departman")}</TableHead>
                <TableHead>{t("yon.kul.roller", "Rol(ler)")}</TableHead>
                <TableHead>{t("yon.kul.durum", "Durum")}</TableHead>
                <TableHead>{t("yon.kul.dil", "Dil")}</TableHead>
                <TableHead>{t("yon.kul.veriKapsami", "Veri Kapsamı")}</TableHead>
                <TableHead>{t("yon.kul.makineler", "Makineler")}</TableHead>
                <TableHead>{t("yon.th.supervisor")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers?.map((w) => {
                const isSup = w.roles.includes("supervisor");
                const profile = extra?.profileMap.get(w.id);
                const assignedRoleKeys = extra?.assignMap.get(w.id) ?? [];
                const assignedRoleNames = assignedRoleKeys
                  .map((k) => roles?.find((r) => r.key === k)?.ad ?? k);
                const machineIds = extra?.machMap.get(w.id) ?? [];
                return (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs">{w.personel_id}</TableCell>
                    <TableCell>{w.ad_soyad}</TableCell>
                    <TableCell className="text-sm">
                      <button
                        className="underline decoration-dotted underline-offset-4"
                        onClick={async () => {
                          const yeni = prompt(t("yon.kul.unvanPrompt").replace("{ad}", w.ad_soyad), w.unvan ?? "");
                          if (yeni === null) return;
                          try {
                            await titleFn({ data: { user_id: w.id, unvan: yeni } });
                            toast.success(t("yon.kul.unvanGuncellendi"));
                            invalidateWorkers();
                          } catch (err: any) {
                            toast.error(err?.message ?? t("yon.kul.hata"));
                          }
                        }}
                      >
                        {w.unvan ?? t("yon.kul.ekle")}
                      </button>
                    </TableCell>
                    <TableCell className="min-w-[160px]">
                      <Select
                        value={profile?.department_id ?? "none"}
                        onValueChange={async (v) => {
                          const { error } = await supabase
                            .from("profiles")
                            .update({ department_id: v === "none" ? null : v })
                            .eq("id", w.id);
                          if (error) return toast.error(error.message);
                          invalidateWorkers();
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {departments?.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.ad}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="min-w-[160px] text-xs">
                      {assignedRoleNames.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {assignedRoleNames.map((n, i) => (
                            <Badge key={i} variant="secondary" className="font-normal">{n}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={profile?.aktif ?? true}
                        onCheckedChange={async (v) => {
                          const { error } = await supabase.from("profiles").update({ aktif: v }).eq("id", w.id);
                          if (error) return toast.error(error.message);
                          invalidateWorkers();
                        }}
                      />
                    </TableCell>
                    <TableCell className="min-w-[110px]">
                      <Select
                        value={profile?.dil ?? "tr"}
                        onValueChange={async (v) => {
                          const { error } = await supabase.from("profiles").update({ dil: v }).eq("id", w.id);
                          if (error) return toast.error(error.message);
                          invalidateWorkers();
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LANGUAGES.map((l) => (
                            <SelectItem key={l.code} value={l.code}>{l.flag} {l.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="min-w-[180px]">
                      <Select
                        value={profile?.veri_kapsam ?? "own"}
                        onValueChange={async (v) => {
                          const { error } = await supabase.from("profiles").update({ veri_kapsam: v }).eq("id", w.id);
                          if (error) return toast.error(error.message);
                          invalidateWorkers();
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DATA_SCOPES.map((s) => (
                            <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                            <Cog className="h-3.5 w-3.5" />
                            {machineIds.length}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 max-h-72 overflow-y-auto space-y-1">
                          <p className="mb-2 text-xs font-medium text-muted-foreground">
                            {t("yon.kul.atanmisMakineler", "Atanmış Makineler")}
                          </p>
                          {machines?.length ? machines.map((m) => {
                            const checked = machineIds.includes(m.id);
                            return (
                              <label key={m.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={async (v) => {
                                    if (v) {
                                      const { error } = await supabase.from("user_machines").insert({ user_id: w.id, machine_id: m.id });
                                      if (error) return toast.error(error.message);
                                    } else {
                                      const { error } = await supabase.from("user_machines").delete().eq("user_id", w.id).eq("machine_id", m.id);
                                      if (error) return toast.error(error.message);
                                    }
                                    qc.invalidateQueries({ queryKey: ["workers-extra"] });
                                  }}
                                />
                                <span className="font-mono text-xs">{m.kod}</span>
                                <span className="text-muted-foreground truncate">{m.ad}</span>
                              </label>
                            );
                          }) : (
                            <p className="text-xs text-muted-foreground">{t("yon.kul.makineYok", "Makine tanımlı değil")}</p>
                          )}
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={isSup}
                        onCheckedChange={async (v) => {
                          try {
                            await roleFn({ data: { user_id: w.id, supervisor: v } });
                            invalidateWorkers();
                          } catch (err: any) {
                            toast.error(err?.message ?? t("yon.kul.hata"));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t("yon.kul.sifreDegistirTitle")}
                        onClick={async () => {
                          const yeni = prompt(t("yon.kul.sifrePrompt").replace("{ad}", w.ad_soyad));
                          if (!yeni) return;
                          if (yeni.length < 6) return toast.error(t("yon.kul.sifreMin"));
                          try {
                            await pwFn({ data: { user_id: w.id, password: yeni } });
                            toast.success(t("yon.kul.sifreGuncellendi"));
                          } catch (err: any) {
                            toast.error(err?.message ?? t("yon.kul.hata"));
                          }
                        }}
                      >
                        <KeyRound className="h-4 w-4 text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!confirm(t("yon.kul.silConfirm").replace("{ad}", w.ad_soyad))) return;
                          try {
                            await deleteFn({ data: { user_id: w.id } });
                            toast.success(t("yon.kul.hesapSilindi"));
                            invalidateWorkers();
                          } catch (err: any) {
                            toast.error(err?.message ?? t("yon.kul.hata"));
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {workers?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-8">
                    {t("yon.kul.henuzYok")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

/* -------------------- KENDİ ŞİFREM -------------------- */
function KendiSifreCard() {
  const t = useT();
  const [yeni, setYeni] = useState("");
  const [tekrar, setTekrar] = useState("");
  const [busy, setBusy] = useState(false);
  const changePw = useServerFn(changeOwnPassword);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (yeni.length < 6) return toast.error(t("yon.pw.sifreMin"));
    if (yeni !== tekrar) return toast.error(t("yon.pw.sifreEslesmiyor"));
    setBusy(true);
    try {
      await changePw({ data: { password: yeni } });
      toast.success(t("yon.pw.guncellendi"));
      setYeni(""); setTekrar("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("yon.pw.hata"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-primary" />
        <h3 className="text-lg">{t("yon.pw.title")}</h3>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm">{t("yon.pw.yeni")}</Label>
        <Input type="password" value={yeni} onChange={(e) => setYeni(e.target.value)} placeholder={t("yon.kul.sifrePh")} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm">{t("yon.pw.yeniTekrar")}</Label>
        <Input type="password" value={tekrar} onChange={(e) => setTekrar(e.target.value)} />
      </div>
      <Button type="submit" disabled={busy} className="w-full gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {t("yon.pw.guncelle")}
      </Button>
    </form>
  );
}
