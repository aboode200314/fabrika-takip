import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Activity, Clock, AlertCircle, TrendingUp, Trash2, Plus, Loader2, Save, Pencil, Users, KeyRound } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createWorkerAccount, deleteWorkerAccount, listWorkers, setWorkerRole, resetWorkerPassword, changeOwnPassword, setWorkerTitle } from "@/lib/workers.functions";

import { YetkilerTab } from "@/components/yetkiler-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/yonetim")({
  component: YonetimGate,
});

function YonetimGate() {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (role !== "supervisor") return <Navigate to="/panel" replace />;
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-7">
          <TabsTrigger value="ozet">Özet</TabsTrigger>
          <TabsTrigger value="ilerleme">İlerleme</TabsTrigger>
          <TabsTrigger value="master">Master Data</TabsTrigger>
          <TabsTrigger value="kullanicilar">Kullanıcılar</TabsTrigger>
          <TabsTrigger value="yetkiler">Yetkiler</TabsTrigger>
          <TabsTrigger value="webhook">Webhook</TabsTrigger>
          <TabsTrigger value="kayitlar">Kayıtlar</TabsTrigger>
        </TabsList>

        <TabsContent value="ozet"><OzetTab /></TabsContent>
        <TabsContent value="ilerleme"><IlerlemeTab /></TabsContent>
        <TabsContent value="master"><MasterTab /></TabsContent>
        <TabsContent value="kullanicilar"><KullanicilarTab /></TabsContent>
        <TabsContent value="yetkiler"><YetkilerTab /></TabsContent>
        <TabsContent value="webhook"><WebhookTab /></TabsContent>
        <TabsContent value="kayitlar"><KayitlarTab /></TabsContent>

      </Tabs>
    </div>
  );
}

/* -------------------- ÖZET -------------------- */
function OzetTab() {
  const { data } = useQuery({
    queryKey: ["yonetim-ozet"],
    queryFn: async () => {
      const since = new Date(); since.setHours(0, 0, 0, 0);
      const sinceIso = since.toISOString();
      const [{ data: prod }, { data: dur }, { data: kal }, { data: mach }] = await Promise.all([
        supabase.from("production_logs").select("miktar,vardiya,operator_id,created_at").gte("created_at", sinceIso),
        supabase.from("downtime_logs").select("sure_dakika,vardiya,machine_id,created_at").gte("created_at", sinceIso),
        supabase.from("quality_logs").select("red_miktari,created_at").gte("created_at", sinceIso),
        supabase.from("machines").select("id,kod,ad,aktif"),
      ]);
      const toplamUretim = (prod ?? []).reduce((s, r) => s + (r.miktar ?? 0), 0);
      const toplamDurus = (dur ?? []).reduce((s, r) => s + (r.sure_dakika ?? 0), 0);
      const toplamRed = (kal ?? []).reduce((s, r) => s + (r.red_miktari ?? 0), 0);

      const byShift = (rows: { vardiya: string; miktar?: number; sure_dakika?: number }[], key: "miktar" | "sure_dakika") => {
        const out: Record<string, number> = { Sabah: 0, Akşam: 0, Gece: 0 };
        for (const r of rows) out[r.vardiya] = (out[r.vardiya] ?? 0) + ((r as any)[key] ?? 0);
        return out;
      };
      const uretimVardiya = byShift(prod ?? [], "miktar");
      const durusVardiya = byShift(dur ?? [], "sure_dakika");

      const downByMach: Record<string, number> = {};
      for (const d of dur ?? []) downByMach[d.machine_id] = (downByMach[d.machine_id] ?? 0) + d.sure_dakika;

      return {
        toplamUretim, toplamDurus, toplamRed,
        uretimVardiya, durusVardiya,
        machines: (mach ?? []).map((m) => ({ ...m, durus: downByMach[m.id] ?? 0 })),
      };
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI icon={TrendingUp} label="Toplam Üretim (bugün)" value={data?.toplamUretim ?? 0} unit="adet" tone="primary" />
        <KPI icon={Clock} label="Toplam Duruş (bugün)" value={data?.toplamDurus ?? 0} unit="dk" tone="warning" />
        <KPI icon={AlertCircle} label="Toplam Fire (bugün)" value={data?.toplamRed ?? 0} unit="adet" tone="destructive" />
        <KPI icon={Activity} label="Aktif Makine" value={data?.machines.filter((m) => m.aktif).length ?? 0} unit="" tone="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Vardiya Bazlı Üretim (bugün)">
          {(["Sabah", "Akşam", "Gece"] as const).map((s) => (
            <Row key={s} label={s} value={`${data?.uretimVardiya[s] ?? 0} adet`} pct={pct(data?.uretimVardiya[s] ?? 0, data?.toplamUretim ?? 0)} />
          ))}
        </Card>
        <Card title="Vardiya Bazlı Duruş (bugün)">
          {(["Sabah", "Akşam", "Gece"] as const).map((s) => (
            <Row key={s} label={s} value={`${data?.durusVardiya[s] ?? 0} dk`} pct={pct(data?.durusVardiya[s] ?? 0, data?.toplamDurus ?? 0)} tone="warning" />
          ))}
        </Card>
      </div>

      <Card title="Makine Durumu">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kod</TableHead>
              <TableHead>Ad</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="text-right">Bugün Duruş</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.machines.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono">{m.kod}</TableCell>
                <TableCell>{m.ad}</TableCell>
                <TableCell>
                  <span className={`inline-flex h-2.5 w-2.5 rounded-full ${m.aktif ? "bg-success" : "bg-muted-foreground/40"}`} />
                  <span className="ml-2 text-xs">{m.aktif ? "Aktif" : "Pasif"}</span>
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

/* -------------------- İLERLEME -------------------- */
function IlerlemeTab() {
  const { data: products } = useQuery({
    queryKey: ["products-with-ops"],
    queryFn: async () => {
      const { data: ps } = await supabase.from("products").select("id,kod,ad").order("kod");
      const { data: ops } = await supabase.from("product_operations").select("id,product_id,sira,ad").order("sira");
      const { data: logs } = await supabase.from("production_logs").select("operation_id,miktar");
      const totals: Record<string, number> = {};
      for (const l of logs ?? []) totals[l.operation_id] = (totals[l.operation_id] ?? 0) + l.miktar;
      return (ps ?? []).map((p) => ({
        ...p,
        ops: (ops ?? []).filter((o) => o.product_id === p.id).map((o) => ({ ...o, miktar: totals[o.id] ?? 0 })),
      }));
    },
  });

  if (!products) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {products.map((p) => {
        const max = Math.max(1, ...p.ops.map((o) => o.miktar));
        return (
          <div key={p.id} className="rounded-2xl border bg-card p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="text-lg">{p.ad}</h3>
              <span className="font-mono text-xs text-muted-foreground">{p.kod}</span>
            </div>
            <div className="space-y-3">
              {p.ops.map((o) => (
                <div key={o.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>{o.sira}. {o.ad}</span>
                    <span className="font-mono text-muted-foreground">{o.miktar} adet</span>
                  </div>
                  <Progress value={(o.miktar / max) * 100} />
                </div>
              ))}
              {p.ops.length === 0 && <p className="text-sm text-muted-foreground">Operasyon tanımlı değil.</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------- MASTER DATA -------------------- */
function MasterTab() {
  return (
    <Tabs defaultValue="makineler" className="space-y-4">
      <TabsList>
        <TabsTrigger value="makineler">Makineler</TabsTrigger>
        <TabsTrigger value="urunler">Ürünler</TabsTrigger>
        <TabsTrigger value="kategoriler">Duruş Kategorileri</TabsTrigger>
      </TabsList>
      <TabsContent value="makineler"><MakinelerCrud /></TabsContent>
      <TabsContent value="urunler"><UrunlerCrud /></TabsContent>
      <TabsContent value="kategoriler"><KategorilerCrud /></TabsContent>
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
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Kod</TableHead><TableHead>Ad</TableHead><TableHead>Aktif</TableHead><TableHead></TableHead></TableRow></TableHeader>
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
  const [selected, setSelected] = useState<string | null>(null);

  const { data: ops } = useQuery({
    queryKey: ["product-ops-edit", selected],
    enabled: !!selected,
    queryFn: async () => (await supabase.from("product_operations").select("*").eq("product_id", selected!).order("sira")).data ?? [],
  });
  const [opAd, setOpAd] = useState("");

  return (
    <div className="grid gap-4 lg:grid-cols-2">
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
          <Input placeholder="Çevrim (sn)" type="number" value={cs} onChange={(e) => setCs(e.target.value)} className="w-28" />
          <Button type="submit" className="gap-1"><Plus className="h-4 w-4" />Ekle</Button>
        </form>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Kod</TableHead><TableHead>Ad</TableHead><TableHead>Çevrim</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {products?.map((p) => (
                <TableRow key={p.id} className={selected === p.id ? "bg-accent/40" : "cursor-pointer"} onClick={() => setSelected(p.id)}>
                  <TableCell className="font-mono">{p.kod}</TableCell>
                  <TableCell>{p.ad}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.ideal_cevrim_saniye ?? "—"} sn</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm("Silmek istediğinize emin misiniz?")) return;
                      const { error } = await supabase.from("products").delete().eq("id", p.id);
                      if (error) return toast.error(error.message);
                      if (selected === p.id) setSelected(null);
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

      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 text-lg">Operasyon Rotası</h3>
          {!selected && <p className="text-sm text-muted-foreground">Soldan bir ürün seçin.</p>}
          {selected && (
            <>
              <ol className="mb-3 space-y-1">
                {ops?.map((o) => (
                  <li key={o.id} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
                    <span><span className="font-mono mr-2">{o.sira}.</span>{o.ad}</span>
                    <Button variant="ghost" size="icon" onClick={async () => {
                      const { error } = await supabase.from("product_operations").delete().eq("id", o.id);
                      if (error) return toast.error(error.message);
                      qc.invalidateQueries({ queryKey: ["product-ops-edit", selected] });
                      qc.invalidateQueries({ queryKey: ["product-operations", selected] });
                    }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
                {ops?.length === 0 && <li className="text-sm text-muted-foreground">Henüz operasyon yok.</li>}
              </ol>
              <form className="flex gap-2" onSubmit={async (e) => {
                e.preventDefault();
                if (!opAd) return;
                const next = (ops?.[ops.length - 1]?.sira ?? 0) + 1;
                const { error } = await supabase.from("product_operations").insert({ product_id: selected, sira: next, ad: opAd });
                if (error) return toast.error(error.message);
                setOpAd("");
                qc.invalidateQueries({ queryKey: ["product-ops-edit", selected] });
                qc.invalidateQueries({ queryKey: ["product-operations", selected] });
              }}>
                <Input placeholder="Yeni operasyon adı" value={opAd} onChange={(e) => setOpAd(e.target.value)} />
                <Button type="submit" className="gap-1"><Plus className="h-4 w-4" />Ekle</Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function KategorilerCrud() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["dc-all"],
    queryFn: async () => (await supabase.from("downtime_categories").select("*").order("ad")).data ?? [],
  });
  const [ad, setAd] = useState("");
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2 rounded-xl border bg-card p-4" onSubmit={async (e) => {
        e.preventDefault();
        if (!ad) return;
        const { error } = await supabase.from("downtime_categories").insert({ ad });
        if (error) return toast.error(error.message);
        setAd(""); qc.invalidateQueries({ queryKey: ["dc-all"] }); qc.invalidateQueries({ queryKey: ["downtime-cats"] });
      }}>
        <Input placeholder="Kategori adı" value={ad} onChange={(e) => setAd(e.target.value)} className="flex-1 min-w-[200px]" />
        <Button type="submit" className="gap-1"><Plus className="h-4 w-4" />Ekle</Button>
      </form>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Ad</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {data?.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.ad}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={async () => {
                    const { error } = await supabase.from("downtime_categories").delete().eq("id", c.id);
                    if (error) return toast.error(error.message);
                    qc.invalidateQueries({ queryKey: ["dc-all"] }); qc.invalidateQueries({ queryKey: ["downtime-cats"] });
                  }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* -------------------- WEBHOOK -------------------- */
function WebhookTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["webhook-settings"],
    queryFn: async () => (await supabase.from("webhook_settings").select("*").eq("id", 1).maybeSingle()).data,
  });
  const [uretim, setUretim] = useState(""); const [durus, setDurus] = useState(""); const [kalite, setKalite] = useState("");
  const [loaded, setLoaded] = useState(false);
  if (data && !loaded) {
    setUretim(data.uretim_url ?? ""); setDurus(data.durus_url ?? ""); setKalite(data.kalite_url ?? "");
    setLoaded(true);
  }

  return (
    <div className="max-w-2xl space-y-4 rounded-2xl border bg-card p-6">
      <p className="text-sm text-muted-foreground">
        Tüm formlar buradaki n8n webhook URL'lerine JSON gönderir. Boş bırakılan webhook devre dışı kalır.
      </p>
      {[
        { label: "Üretim Webhook URL", val: uretim, set: setUretim },
        { label: "Duruş Webhook URL", val: durus, set: setDurus },
        { label: "Kalite Webhook URL", val: kalite, set: setKalite },
      ].map((f) => (
        <div key={f.label} className="space-y-1.5">
          <Label className="text-sm">{f.label}</Label>
          <Input placeholder="https://n8n.example.com/webhook/..." value={f.val} onChange={(e) => f.set(e.target.value)} className="font-mono text-xs" />
        </div>
      ))}
      <Button className="gap-2" onClick={async () => {
        const { error } = await supabase.from("webhook_settings").upsert({
          id: 1, uretim_url: uretim || null, durus_url: durus || null, kalite_url: kalite || null, updated_at: new Date().toISOString(),
        });
        if (error) return toast.error(error.message);
        toast.success("Webhook ayarları kaydedildi");
        qc.invalidateQueries({ queryKey: ["webhook-settings"] });
      }}>
        <Save className="h-4 w-4" />Kaydet
      </Button>
    </div>
  );
}

/* -------------------- KAYITLAR -------------------- */
function KayitlarTab() {
  const qc = useQueryClient();
  const { data: prod } = useQuery({
    queryKey: ["all-prod-logs"],
    queryFn: async () => (await supabase
      .from("production_logs")
      .select("id,created_at,vardiya,miktar,machines(kod),products(ad),product_operations(ad),profiles(personel_id)")
      .order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const { data: dur } = useQuery({
    queryKey: ["all-dur-logs"],
    queryFn: async () => (await supabase
      .from("downtime_logs")
      .select("id,created_at,vardiya,sure_dakika,notlar,machines(kod),downtime_categories(ad),profiles(personel_id)")
      .order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const { data: kal } = useQuery({
    queryKey: ["all-kal-logs"],
    queryFn: async () => (await supabase
      .from("quality_logs")
      .select("id,created_at,vardiya,red_miktari,notlar,machines(kod),products(ad),profiles(personel_id)")
      .order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  const [editing, setEditing] = useState<{ table: string; id: string; field: string; value: string } | null>(null);

  async function saveEdit() {
    if (!editing) return;
    const num = Number(editing.value);
    if (!Number.isFinite(num) || num < 0) return toast.error("Geçersiz değer");
    const { error } = await supabase.from(editing.table as any).update({ [editing.field]: num }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Güncellendi");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["all-prod-logs"] });
    qc.invalidateQueries({ queryKey: ["all-dur-logs"] });
    qc.invalidateQueries({ queryKey: ["all-kal-logs"] });
    qc.invalidateQueries({ queryKey: ["yonetim-ozet"] });
    qc.invalidateQueries({ queryKey: ["products-with-ops"] });
  }

  async function deleteRow(table: string, id: string) {
    if (!confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Kayıt silindi");
    qc.invalidateQueries({ queryKey: ["all-prod-logs"] });
    qc.invalidateQueries({ queryKey: ["all-dur-logs"] });
    qc.invalidateQueries({ queryKey: ["all-kal-logs"] });
    qc.invalidateQueries({ queryKey: ["yonetim-ozet"] });
    qc.invalidateQueries({ queryKey: ["products-with-ops"] });
  }

  async function resetAll(which: "uretim" | "durus" | "kalite" | "hepsi") {
    const labels = { uretim: "TÜM Üretim", durus: "TÜM Duruş", kalite: "TÜM Kalite", hepsi: "TÜM Üretim, Duruş ve Kalite" };
    if (!confirm(`${labels[which]} kayıtları kalıcı olarak silinecek. Devam edilsin mi?`)) return;
    if (!confirm("Bu işlem geri alınamaz. Onaylıyor musunuz?")) return;
    const tables =
      which === "hepsi" ? ["production_logs", "downtime_logs", "quality_logs"]
      : which === "uretim" ? ["production_logs"]
      : which === "durus" ? ["downtime_logs"]
      : ["quality_logs"];
    for (const t of tables) {
      const { error } = await supabase.from(t as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) { toast.error(`${t}: ${error.message}`); return; }
    }
    toast.success("Sıfırlama tamamlandı");
    qc.invalidateQueries();
  }

  const editCell = (table: string, id: string, field: string, value: number, suffix?: string) => {
    const isEditing = editing?.table === table && editing?.id === id && editing?.field === field;
    if (isEditing) {
      return (
        <div className="flex items-center justify-end gap-1">
          <Input
            type="number"
            value={editing!.value}
            onChange={(e) => setEditing({ ...editing!, value: e.target.value })}
            className="h-8 w-20 text-right"
            autoFocus
          />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}><Save className="h-3.5 w-3.5 text-success" /></Button>
        </div>
      );
    }
    return (
      <button
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border/60 px-2 py-1 font-display hover:border-primary hover:bg-primary/5 hover:text-primary transition-colors"
        onClick={() => setEditing({ table, id, field, value: String(value) })}
        title="Düzenlemek için tıklayın"
      >
        {value}{suffix ? <span className="text-xs text-muted-foreground">{suffix}</span> : null}
        <Pencil className="h-3 w-3 opacity-60" />
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground flex items-center gap-2">
        <Pencil className="h-3.5 w-3.5" />
        Bir kaydı düzeltmek için <span className="font-medium text-foreground">Miktar / Süre / Red</span> hücresine tıklayın. Silmek için satır sonundaki kırmızı çöp kutusunu kullanın.
      </div>
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-destructive">Tehlikeli Bölge — Sıfırlama</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Tüm geçmiş kayıtları silerek sıfırdan başlayabilirsiniz. Bu işlem geri alınamaz.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => resetAll("uretim")}>Üretimi Sıfırla</Button>
            <Button variant="outline" size="sm" onClick={() => resetAll("durus")}>Duruşu Sıfırla</Button>
            <Button variant="outline" size="sm" onClick={() => resetAll("kalite")}>Kaliteyi Sıfırla</Button>
            <Button variant="destructive" size="sm" className="gap-1" onClick={() => resetAll("hepsi")}>
              <Trash2 className="h-4 w-4" />Hepsini Sıfırla
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="uretim" className="space-y-4">
        <TabsList>
          <TabsTrigger value="uretim">Üretim</TabsTrigger>
          <TabsTrigger value="durus">Duruş</TabsTrigger>
          <TabsTrigger value="kalite">Kalite</TabsTrigger>
        </TabsList>

        <TabsContent value="uretim">
          <div className="rounded-xl border bg-card overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Zaman</TableHead><TableHead>Operatör</TableHead><TableHead>Makine</TableHead>
                <TableHead>Ürün</TableHead><TableHead>Operasyon</TableHead><TableHead>Vardiya</TableHead>
                <TableHead className="text-right">Miktar</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {prod?.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("tr-TR")}</TableCell>
                    <TableCell className="font-mono text-xs">{r.profiles?.personel_id}</TableCell>
                    <TableCell className="font-mono text-xs">{r.machines?.kod}</TableCell>
                    <TableCell>{r.products?.ad}</TableCell>
                    <TableCell>{r.product_operations?.ad}</TableCell>
                    <TableCell>{r.vardiya}</TableCell>
                    <TableCell className="text-right">{editCell("production_logs", r.id, "miktar", r.miktar)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => deleteRow("production_logs", r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="durus">
          <div className="rounded-xl border bg-card overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Zaman</TableHead><TableHead>Operatör</TableHead><TableHead>Makine</TableHead>
                <TableHead>Kategori</TableHead><TableHead>Vardiya</TableHead>
                <TableHead className="text-right">Süre</TableHead><TableHead>Not</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {dur?.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("tr-TR")}</TableCell>
                    <TableCell className="font-mono text-xs">{r.profiles?.personel_id}</TableCell>
                    <TableCell className="font-mono text-xs">{r.machines?.kod}</TableCell>
                    <TableCell>{r.downtime_categories?.ad}</TableCell>
                    <TableCell>{r.vardiya}</TableCell>
                    <TableCell className="text-right">{editCell("downtime_logs", r.id, "sure_dakika", r.sure_dakika, "dk")}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{r.notlar}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => deleteRow("downtime_logs", r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="kalite">
          <div className="rounded-xl border bg-card overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Zaman</TableHead><TableHead>Operatör</TableHead><TableHead>Makine</TableHead>
                <TableHead>Ürün</TableHead><TableHead>Vardiya</TableHead>
                <TableHead className="text-right">Red</TableHead><TableHead>Not</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {kal?.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("tr-TR")}</TableCell>
                    <TableCell className="font-mono text-xs">{r.profiles?.personel_id}</TableCell>
                    <TableCell className="font-mono text-xs">{r.machines?.kod}</TableCell>
                    <TableCell>{r.products?.ad}</TableCell>
                    <TableCell>{r.vardiya}</TableCell>
                    <TableCell className="text-right text-destructive">{editCell("quality_logs", r.id, "red_miktari", r.red_miktari)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{r.notlar}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => deleteRow("quality_logs", r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
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
          <Input value={unvan} onChange={(e) => setUnvan(e.target.value)} placeholder="Örn: Üretim Sorumlusu, Muhasebeci, Operatör" />
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
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers?.map((w) => {
                const isSup = w.roles.includes("supervisor");
                return (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs">{w.personel_id}</TableCell>
                    <TableCell>{w.ad_soyad}</TableCell>
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
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
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
