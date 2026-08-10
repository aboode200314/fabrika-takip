import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Activity, Clock, Layers, TrendingUp, Trash2, Plus, Loader2, Save, Users, KeyRound } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  createWorkerAccount, deleteWorkerAccount, listWorkers, setWorkerRole,
  resetWorkerPassword, changeOwnPassword, setWorkerTitle,
} from "@/lib/workers.functions";

import { YetkilerTab } from "@/components/yetkiler-tab";
import { StokTab } from "@/components/stok-tab";
import { UrunAsamalari } from "@/components/urun-asamalari";
import { StokHareketleri } from "@/components/stok-hareketleri";
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

export const Route = createFileRoute("/_app/yonetim")({
  component: YonetimGate,
  head: () => ({
    meta: [
      { title: "Yönetim — Makine, Ürün, Sac Stok ve Kullanıcılar" },
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
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Süpervizör</p>
        <h1 className="mt-1 text-3xl tracking-tight">Yönetim Paneli</h1>
      </div>

      <Tabs defaultValue="ozet" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 lg:grid-cols-10">
          <TabsTrigger value="ozet">Özet</TabsTrigger>
          <TabsTrigger value="master">Makine & Ürün</TabsTrigger>
          <TabsTrigger value="asamalar">Aşamalar</TabsTrigger>
          <TabsTrigger value="stok">Sac Stok</TabsTrigger>
          <TabsTrigger value="hareketler">Hareketler</TabsTrigger>
          <TabsTrigger value="vardiya">Vardiya</TabsTrigger>
          <TabsTrigger value="kullanicilar">Kullanıcılar</TabsTrigger>
          <TabsTrigger value="roller">Roller</TabsTrigger>
          <TabsTrigger value="yetkiler">Yetkiler</TabsTrigger>
          <TabsTrigger value="denetim">Denetim</TabsTrigger>
        </TabsList>

        <TabsContent value="ozet"><OzetTab /></TabsContent>
        <TabsContent value="master"><MasterTab /></TabsContent>
        <TabsContent value="asamalar"><UrunAsamalari /></TabsContent>
        <TabsContent value="stok"><StokTab /></TabsContent>
        <TabsContent value="hareketler"><StokHareketleri /></TabsContent>
        <TabsContent value="vardiya"><VardiyaAyarlari /></TabsContent>
        <TabsContent value="kullanicilar"><KullanicilarTab /></TabsContent>
        <TabsContent value="roller"><RollerTab /></TabsContent>
        <TabsContent value="yetkiler"><YetkilerTab /></TabsContent>
        <TabsContent value="denetim"><DenetimKaydi /></TabsContent>
      </Tabs>

    </div>
  );
}

/* -------------------- ÖZET (canlı oturum verisinden) -------------------- */
function OzetTab() {
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
        <KPI icon={TrendingUp} label="Üretim (bugün)" value={data?.toplamUretim ?? 0} unit="adet" tone="primary" />
        <KPI icon={Clock} label="Duruş (bugün)" value={Math.round(data?.toplamDurus ?? 0)} unit="dk" tone="warning" />
        <KPI icon={Activity} label="Çalışma (bugün)" value={Math.round((data?.calisma ?? 0) / 60)} unit="saat" tone="success" />
        <KPI icon={Layers} label="Sac Stoğu" value={data?.stokLevha ?? 0} unit={`levha · ${(data?.stokTon ?? 0).toFixed(1)} ton`} tone="primary" />
      </div>

      {!!data?.kritik.length && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <strong className="text-destructive">Kritik stok:</strong>{" "}
          {data.kritik.map((r) => `${r.sac_tipi} ${r.kalinlik_mm}mm (${r.adet})`).join(", ")}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Vardiya Bazlı Üretim (bugün)">
          {(["Sabah", "Akşam", "Gece"] as const).map((s) => (
            <Row key={s} label={s} value={`${data?.uretimVardiya[s] ?? 0} adet`} pct={pct(data?.uretimVardiya[s] ?? 0, data?.toplamUretim ?? 0)} />
          ))}
        </Card>
        <Card title="Vardiya Bazlı Duruş (bugün)">
          {(["Sabah", "Akşam", "Gece"] as const).map((s) => (
            <Row key={s} label={s} value={`${Math.round(data?.durusVardiya[s] ?? 0)} dk`} pct={pct(data?.durusVardiya[s] ?? 0, data?.toplamDurus ?? 0)} tone="warning" />
          ))}
        </Card>
      </div>

      <Card title="Makine Durumu">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kod</TableHead>
              <TableHead>Ad</TableHead>
              <TableHead>Tanım</TableHead>
              <TableHead>Canlı</TableHead>
              <TableHead className="text-right">Bugün Duruş</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.machines.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono">{m.kod}</TableCell>
                <TableCell>{m.ad}</TableCell>
                <TableCell className="text-xs">{m.aktif ? "Aktif" : "Pasif"}</TableCell>
                <TableCell>
                  <span className={`inline-flex h-2.5 w-2.5 rounded-full ${m.canli === "running" ? "bg-success" : m.canli === "paused" ? "bg-warning" : "bg-muted-foreground/40"}`} />
                  <span className="ml-2 text-xs">{m.canli === "running" ? "Çalışıyor" : m.canli === "paused" ? "Duraklatıldı" : "Boşta"}</span>
                </TableCell>
                <TableCell className="text-right">{m.durus} dk</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
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
  return (
    <Tabs defaultValue="makineler" className="space-y-4">
      <TabsList>
        <TabsTrigger value="makineler">Makineler</TabsTrigger>
        <TabsTrigger value="urunler">Ürünler</TabsTrigger>
      </TabsList>
      <TabsContent value="makineler"><MakinelerCrud /></TabsContent>
      <TabsContent value="urunler"><UrunlerCrud /></TabsContent>
    </Tabs>
  );
}

function MakinelerCrud() {
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
          if (!kod || !ad) return toast.error("Kod ve ad gerekli");
          const { error } = await supabase.from("machines").insert({ kod, ad });
          if (error) return toast.error(error.message);
          setKod(""); setAd(""); toast.success("Makine eklendi");
          qc.invalidateQueries({ queryKey: ["machines-all"] });
          qc.invalidateQueries({ queryKey: ["machines-active"] });
        }}
      >
        <Input placeholder="Kod" value={kod} onChange={(e) => setKod(e.target.value)} className="w-32" />
        <Input placeholder="Ad" value={ad} onChange={(e) => setAd(e.target.value)} className="flex-1 min-w-[200px]" />
        <Button type="submit" className="gap-1"><Plus className="h-4 w-4" />Ekle</Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Makine adında "CNC Plazma" geçen makineler Panel'de otomatik olarak sac stok alanlarını açar.
      </p>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Kod</TableHead><TableHead>Ad</TableHead><TableHead>Aktif</TableHead><TableHead /></TableRow></TableHeader>
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
                    if (!confirm("Silmek istediğinize emin misiniz?")) return;
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

function UrunlerCrud() {
  const qc = useQueryClient();
  const { data: products } = useQuery({
    queryKey: ["products-all"],
    queryFn: async () => (await supabase.from("products").select("*").order("kod")).data ?? [],
  });
  const [kod, setKod] = useState(""); const [ad, setAd] = useState(""); const [cs, setCs] = useState("");

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2 rounded-xl border bg-card p-4" onSubmit={async (e) => {
        e.preventDefault();
        if (!kod || !ad) return toast.error("Kod ve ad gerekli");
        const { error } = await supabase.from("products").insert({ kod, ad, ideal_cevrim_saniye: cs ? Number(cs) : null });
        if (error) return toast.error(error.message);
        setKod(""); setAd(""); setCs(""); toast.success("Ürün eklendi");
        qc.invalidateQueries({ queryKey: ["products-all"] });
        qc.invalidateQueries({ queryKey: ["products"] });
      }}>
        <Input placeholder="Kod" value={kod} onChange={(e) => setKod(e.target.value)} className="w-28" />
        <Input placeholder="Ad" value={ad} onChange={(e) => setAd(e.target.value)} className="flex-1 min-w-[160px]" />
        <Input placeholder="Çevrim (sn)" type="number" value={cs} onChange={(e) => setCs(e.target.value)} className="w-32" />
        <Button type="submit" className="gap-1"><Plus className="h-4 w-4" />Ekle</Button>
      </form>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Kod</TableHead><TableHead>Ad</TableHead><TableHead>Çevrim</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {products?.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono">{p.kod}</TableCell>
                <TableCell>{p.ad}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{p.ideal_cevrim_saniye ?? "—"} sn</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={async () => {
                    if (!confirm("Silmek istediğinize emin misiniz?")) return;
                    const { error } = await supabase.from("products").delete().eq("id", p.id);
                    if (error) return toast.error(error.message);
                    qc.invalidateQueries({ queryKey: ["products-all"] });
                    qc.invalidateQueries({ queryKey: ["products"] });
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
      return toast.error("Personel ID, Ad Soyad ve en az 6 karakterli şifre gerekli");
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
      toast.success("Hesap oluşturuldu");
      setPersonelId(""); setAdSoyad(""); setDepartman(""); setUnvan(""); setPassword(""); setMakeSup(false);
      qc.invalidateQueries({ queryKey: ["workers"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Hata oluştu");
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
            <h3 className="text-lg">Yeni Çalışan Hesabı</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Oluşturduğunuz hesabı çalışana verirsiniz. Giriş ekranında Personel ID ve şifre ile giriş yapar.
          </p>
          <div className="space-y-1.5">
            <Label className="text-sm">Personel ID</Label>
            <Input value={personelId} onChange={(e) => setPersonelId(e.target.value)} placeholder="örn: 1042" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Ad Soyad</Label>
            <Input value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)} placeholder="Ahmet Yılmaz" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Departman <span className="text-muted-foreground">(opsiyonel)</span></Label>
            <Input value={departman} onChange={(e) => setDepartman(e.target.value)} placeholder="Üretim" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Ünvan / Görev <span className="text-muted-foreground">(opsiyonel)</span></Label>
            <Input value={unvan} onChange={(e) => setUnvan(e.target.value)} placeholder="Örn: Üretim Sorumlusu, Operatör" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Şifre</Label>
            <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="en az 6 karakter" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={makeSup} onCheckedChange={setMakeSup} />
            Süpervizör yetkisi ver
          </label>
          <Button type="submit" disabled={submitting} className="w-full gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Hesap Oluştur
          </Button>
        </form>
      </div>

      <div className="rounded-2xl border bg-card overflow-x-auto">
        <div className="border-b p-4">
          <h3 className="text-lg">Çalışanlar ({workers?.length ?? 0})</h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Personel ID</TableHead>
                <TableHead>Ad Soyad</TableHead>
                <TableHead>Ünvan</TableHead>
                <TableHead>Departman</TableHead>
                <TableHead>Süpervizör</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers?.map((w) => {
                const isSup = w.roles.includes("supervisor");
                return (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs">{w.personel_id}</TableCell>
                    <TableCell>{w.ad_soyad}</TableCell>
                    <TableCell className="text-sm">
                      <button
                        className="underline decoration-dotted underline-offset-4"
                        onClick={async () => {
                          const yeni = prompt(`${w.ad_soyad} ünvanı:`, w.unvan ?? "");
                          if (yeni === null) return;
                          try {
                            await titleFn({ data: { user_id: w.id, unvan: yeni } });
                            toast.success("Ünvan güncellendi");
                            qc.invalidateQueries({ queryKey: ["workers"] });
                          } catch (err: any) {
                            toast.error(err?.message ?? "Hata");
                          }
                        }}
                      >
                        {w.unvan ?? "— ekle"}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{w.departman ?? "—"}</TableCell>
                    <TableCell>
                      <Switch
                        checked={isSup}
                        onCheckedChange={async (v) => {
                          try {
                            await roleFn({ data: { user_id: w.id, supervisor: v } });
                            qc.invalidateQueries({ queryKey: ["workers"] });
                          } catch (err: any) {
                            toast.error(err?.message ?? "Hata");
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Şifreyi değiştir"
                        onClick={async () => {
                          const yeni = prompt(`${w.ad_soyad} için yeni şifre (en az 6 karakter):`);
                          if (!yeni) return;
                          if (yeni.length < 6) return toast.error("Şifre en az 6 karakter olmalı");
                          try {
                            await pwFn({ data: { user_id: w.id, password: yeni } });
                            toast.success("Şifre güncellendi");
                          } catch (err: any) {
                            toast.error(err?.message ?? "Hata");
                          }
                        }}
                      >
                        <KeyRound className="h-4 w-4 text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          if (!confirm(`${w.ad_soyad} hesabını silmek istediğinize emin misiniz?`)) return;
                          try {
                            await deleteFn({ data: { user_id: w.id } });
                            toast.success("Hesap silindi");
                            qc.invalidateQueries({ queryKey: ["workers"] });
                          } catch (err: any) {
                            toast.error(err?.message ?? "Hata");
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
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    Henüz çalışan yok.
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
  const [yeni, setYeni] = useState("");
  const [tekrar, setTekrar] = useState("");
  const [busy, setBusy] = useState(false);
  const changePw = useServerFn(changeOwnPassword);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (yeni.length < 6) return toast.error("Şifre en az 6 karakter olmalı");
    if (yeni !== tekrar) return toast.error("Şifreler eşleşmiyor");
    setBusy(true);
    try {
      await changePw({ data: { password: yeni } });
      toast.success("Şifreniz güncellendi");
      setYeni(""); setTekrar("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Şifre değiştirilemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-primary" />
        <h3 className="text-lg">Kendi Şifremi Değiştir</h3>
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm">Yeni şifre</Label>
        <Input type="password" value={yeni} onChange={(e) => setYeni(e.target.value)} placeholder="en az 6 karakter" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm">Yeni şifre (tekrar)</Label>
        <Input type="password" value={tekrar} onChange={(e) => setTekrar(e.target.value)} />
      </div>
      <Button type="submit" disabled={busy} className="w-full gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Şifreyi Güncelle
      </Button>
    </form>
  );
}
