import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Play, Square, Pause, Loader2, Radio, Timer, User as UserIcon, PlayCircle, Flame } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { isPlasmaMachine, levhaKg, SAC_TIPLERI, type StockRow } from "@/lib/sac";


export const Route = createFileRoute("/_app/panel")({
  component: PanelPage,
  head: () => ({
    meta: [
      { title: "Ana Panel — Canlı Makine Durumu" },
      { name: "description", content: "Tüm makinelerin anlık durumu: çalışan operatör, ürün, canlı çalışma ve duruş süreleri." },
      { property: "og:title", content: "Ana Panel — Canlı Makine Durumu" },
      { property: "og:description", content: "Fabrika makine durumları anlık olarak izlenir." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SHIFTS = ["Sabah", "Akşam", "Gece"] as const;
type Shift = (typeof SHIFTS)[number];

export const PAUSE_REASONS = [
  "Arıza",
  "Bakım",
  "Ürün Değişimi",
  "Malzeme Bekleme",
  "Mola",
  "Diğer",
] as const;

function autoShift(): Shift {
  const h = new Date().getHours();
  if (h >= 8 && h < 16) return "Sabah";
  if (h >= 16) return "Akşam";
  return "Gece";
}

function fmtDur(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

const timeFmt = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });

interface SessionRow {
  id: string;
  operator_id: string;
  operator_ad: string;
  machine_id: string;
  product_id: string | null;
  vardiya: Shift;
  baslangic: string;
  durum: string;
  sac_tipi: string | null;
  uzunluk_mm: number | null;
  genislik_mm: number | null;
  kalinlik_mm: number | null;
  levha_adedi: number | null;
  yogunluk: number | null;
}



interface PauseRow {
  id: string;
  session_id: string;
  neden: string;
  baslangic: string;
  bitis: string | null;
  sure_dakika: number | null;
}

function PanelPage() {
  const { user, isSuperAdmin, role, allowedMachineIds, allowedProductIds } = useAuth();
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: machines } = useQuery({
    queryKey: ["machines-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("machines").select("id,kod,ad").eq("aktif", true).order("kod");
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

  const { data: running, isLoading } = useQuery({
    queryKey: ["running-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("live_sessions");
      if (error) throw error;
      return (data ?? []) as unknown as SessionRow[];
    },
    refetchInterval: 15000,
  });

  const { data: pauses } = useQuery({
    queryKey: ["running-pauses"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("live_pauses");
      if (error) throw error;
      return (data ?? []) as unknown as PauseRow[];
    },
    refetchInterval: 15000,
  });


  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("live-production")
      .on("postgres_changes", { event: "*", schema: "public", table: "production_sessions" }, () => {
        qc.invalidateQueries({ queryKey: ["running-sessions"] });
        qc.invalidateQueries({ queryKey: ["running-pauses"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "session_pauses" }, () => {
        qc.invalidateQueries({ queryKey: ["running-pauses"] });
        qc.invalidateQueries({ queryKey: ["running-sessions"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const visibleMachines = useMemo(() => {
    const list = machines ?? [];
    if (isSuperAdmin || role === "supervisor" || !allowedMachineIds) return list;
    return list.filter((m) => allowedMachineIds.includes(m.id));
  }, [machines, allowedMachineIds, isSuperAdmin, role]);

  const visibleProducts = useMemo(() => {
    const list = products ?? [];
    if (isSuperAdmin || role === "supervisor" || !allowedProductIds) return list;
    return list.filter((p) => allowedProductIds.includes(p.id));
  }, [products, allowedProductIds, isSuperAdmin, role]);

  const byMachine = useMemo(() => {
    const m = new Map<string, SessionRow>();
    for (const s of running ?? []) m.set(s.machine_id, s);
    return m;
  }, [running]);

  const openPauseOf = (sessionId: string) =>
    (pauses ?? []).find((p) => p.session_id === sessionId && !p.bitis) ?? null;

  const pausedMsOf = (sessionId: string) => {
    let ms = 0;
    for (const p of pauses ?? []) {
      if (p.session_id !== sessionId) continue;
      ms += p.bitis
        ? new Date(p.bitis).getTime() - new Date(p.baslangic).getTime()
        : now - new Date(p.baslangic).getTime();
    }
    return ms;
  };

  const mySession = (running ?? []).find((s) => s.operator_id === user?.id) ?? null;

  // ---- start form
  const [machine, setMachine] = useState("");
  const [product, setProduct] = useState("");
  const [operation, setOperation] = useState("");
  const [shift, setShift] = useState<Shift>(autoShift());
  const [busy, setBusy] = useState(false);

  // CNC Plazma alanları
  const CUSTOM = "__custom__";
  const [stokId, setStokId] = useState("");
  const [levha, setLevha] = useState("1");
  // Özel (stok dışı) sac
  const [cSacTipi, setCSacTipi] = useState(SAC_TIPLERI[0].ad);
  const [cUzunluk, setCUzunluk] = useState("");
  const [cGenislik, setCGenislik] = useState("");
  const [cKalinlik, setCKalinlik] = useState("");

  const { data: stock } = useQuery({
    queryKey: ["sheet-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sheet_stock")
        .select("id,sac_tipi,kalinlik_mm,uzunluk_mm,genislik_mm,adet,kritik_adet,yogunluk,notlar")
        .order("sac_tipi")
        .order("kalinlik_mm");
      if (error) throw error;
      return (data ?? []) as StockRow[];
    },
  });

  const { data: operations } = useQuery({
    queryKey: ["product-operations", product],
    enabled: !!product,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_operations")
        .select("id,sira,ad,machine_id")
        .eq("product_id", product)
        .order("sira");
      if (error) throw error;
      return data ?? [];
    },
  });

  const selectedMachine = (machines ?? []).find((m) => m.id === machine) ?? null;
  const isPlasma = isPlasmaMachine(selectedMachine);
  const isCustomSheet = stokId === CUSTOM;
  const selectedStock = (stock ?? []).find((s) => s.id === stokId) ?? null;

  async function start() {
    if (!machine) return toast.error("Makine seçiniz");
    if (byMachine.has(machine)) return toast.error("Bu makine şu anda çalışıyor");

    let plasma: Record<string, unknown> = {};
    if (isPlasma) {
      const a = Number(levha);
      if (!(a > 0)) return toast.error("Kesilecek sac adedi giriniz (0.25 gibi kesirli olabilir)");

      if (isCustomSheet) {
        const u = Number(cUzunluk), g = Number(cGenislik), k = Number(cKalinlik);
        if (!(u > 0) || !(g > 0) || !(k > 0))
          return toast.error("Özel sac için uzunluk, genişlik ve kalınlık giriniz");
        plasma = {
          stok_id: null,
          sac_tipi: cSacTipi,
          uzunluk_mm: u,
          genislik_mm: g,
          kalinlik_mm: k,
          levha_adedi: a,
          yogunluk: SAC_TIPLERI.find((t) => t.ad === cSacTipi)?.yogunluk ?? 7.85,
        };
      } else {
        if (!selectedStock) return toast.error("Kullanılacak sacı stoktan seçiniz");
        if (a > Number(selectedStock.adet))
          return toast.error(`Stokta yalnızca ${selectedStock.adet} levha var`);
        plasma = {
          stok_id: selectedStock.id,
          sac_tipi: selectedStock.sac_tipi,
          uzunluk_mm: selectedStock.uzunluk_mm,
          genislik_mm: selectedStock.genislik_mm,
          kalinlik_mm: selectedStock.kalinlik_mm,
          levha_adedi: a,
          yogunluk: selectedStock.yogunluk ?? 7.85,
        };
      }
    }


    setBusy(true);
    const { error } = await supabase.from("production_sessions").insert({
      operator_id: user!.id,
      machine_id: machine,
      product_id: product || null,
      operation_id: operation || null,
      vardiya: shift,
      baslangic: new Date().toISOString(),
      durum: "running",
      ...plasma,
    });
    setBusy(false);
    if (error) return toast.error("Başlatılamadı: " + error.message);
    toast.success("İş başlatıldı");
    setStokId(""); setLevha("1");
    qc.invalidateQueries({ queryKey: ["running-sessions"] });
  }



  // ---- pause
  const [pauseFor, setPauseFor] = useState<SessionRow | null>(null);
  const [reason, setReason] = useState<string>(PAUSE_REASONS[0]);
  const [pauseNote, setPauseNote] = useState("");

  async function doPause() {
    if (!pauseFor) return;
    setBusy(true);
    const { error } = await supabase.from("session_pauses").insert({
      session_id: pauseFor.id,
      operator_id: user!.id,
      neden: reason,
      baslangic: new Date().toISOString(),
      notlar: pauseNote.trim() || null,
    });
    if (!error) {
      await supabase.from("production_sessions").update({ durum: "paused" }).eq("id", pauseFor.id);
    }
    setBusy(false);
    if (error) return toast.error("Duraklatılamadı: " + error.message);
    toast.success("Makine duraklatıldı");
    setPauseFor(null);
    setPauseNote("");
    setReason(PAUSE_REASONS[0]);
    qc.invalidateQueries({ queryKey: ["running-pauses"] });
    qc.invalidateQueries({ queryKey: ["running-sessions"] });
  }

  async function resume(s: SessionRow) {
    const open = openPauseOf(s.id);
    setBusy(true);
    if (open) {
      const { error } = await supabase
        .from("session_pauses")
        .update({ bitis: new Date().toISOString() })
        .eq("id", open.id);
      if (error) {
        setBusy(false);
        return toast.error("Devam edilemedi: " + error.message);
      }
    }
    await supabase.from("production_sessions").update({ durum: "running" }).eq("id", s.id);
    setBusy(false);
    toast.success("Çalışmaya devam ediliyor");
    qc.invalidateQueries({ queryKey: ["running-pauses"] });
    qc.invalidateQueries({ queryKey: ["running-sessions"] });
  }

  // ---- finish dialog
  const [finishFor, setFinishFor] = useState<SessionRow | null>(null);
  const [qty, setQty] = useState("");
  const [scrap, setScrap] = useState("");
  const [note, setNote] = useState("");

  async function finish() {
    if (!finishFor) return;
    const n = Number(qty);
    if (!Number.isFinite(n) || n < 0) return toast.error("Geçerli bir miktar giriniz");
    const bitisTs = new Date().toISOString();
    setBusy(true);
    const open = openPauseOf(finishFor.id);
    if (open) {
      await supabase.from("session_pauses").update({ bitis: bitisTs }).eq("id", open.id);
    }
    const { error } = await supabase
      .from("production_sessions")
      .update({
        bitis: bitisTs,
        miktar: Math.round(n),
        hurda: Math.round(Number(scrap) || 0),
        notlar: note.trim() || null,
      })
      .eq("id", finishFor.id);
    if (error) {
      setBusy(false);
      return toast.error("Kaydedilemedi: " + error.message);
    }

    // CNC Plazma işi ise kesim kaydı da oluştur (raporlar için)
    if (finishFor.uzunluk_mm && finishFor.genislik_mm && finishFor.kalinlik_mm && finishFor.levha_adedi) {
      await supabase.from("plasma_cuts").insert({
        operator_id: finishFor.operator_id,
        machine_id: finishFor.machine_id,
        vardiya: finishFor.vardiya,
        sac_tipi: finishFor.sac_tipi,
        uzunluk_mm: finishFor.uzunluk_mm,
        genislik_mm: finishFor.genislik_mm,
        kalinlik_mm: finishFor.kalinlik_mm,
        yogunluk: finishFor.yogunluk ?? 7.85,
        levha_adedi: finishFor.levha_adedi,
        baslangic: finishFor.baslangic,
        bitis: bitisTs,
        notlar: note.trim() || null,
      });
    }

    setBusy(false);
    toast.success("İş tamamlandı ve kaydedildi");
    setFinishFor(null);
    setQty("");
    setScrap("");
    setNote("");
    qc.invalidateQueries({ queryKey: ["running-sessions"] });
    qc.invalidateQueries({ queryKey: ["running-pauses"] });
    qc.invalidateQueries({ queryKey: ["session-history"] });
  }


  const nameOf = (s: SessionRow) => s.operator_ad || "—";

  const productOf = (id: string | null) => {
    if (!id) return "—";
    const p = products?.find((x) => x.id === id);
    return p ? `${p.kod} — ${p.ad}` : "—";
  };

  const runningCount = visibleMachines.filter((m) => byMachine.get(m.id)?.durum === "running").length;
  const pausedCount = visibleMachines.filter((m) => byMachine.get(m.id)?.durum === "paused").length;

  const canControl = (s: SessionRow) =>
    isSuperAdmin || role === "supervisor" || s.operator_id === user?.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl tracking-tight">Ana Panel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Makinelerin anlık durumu — sayfa yenilemeden güncellenir.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className="flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1.5 text-success">
            <Radio className="h-3.5 w-3.5 animate-pulse" /> {runningCount} çalışıyor
          </span>
          <span className="flex items-center gap-2 rounded-full border border-warning/40 bg-warning/10 px-3 py-1.5 text-warning">
            <Pause className="h-3.5 w-3.5" /> {pausedCount} duraklatıldı
          </span>
          <span className="rounded-full border bg-muted px-3 py-1.5 text-muted-foreground">
            {visibleMachines.length} makine
          </span>
        </div>
      </div>

      {/* Kendi işim */}
      <section className="rounded-2xl border bg-card p-5 shadow-industrial">
        {mySession ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Devam eden işin</div>
              <div className="mt-1 font-display text-xl">
                {machines?.find((m) => m.id === mySession.machine_id)?.kod ?? "—"} ·{" "}
                {productOf(mySession.product_id)} · {mySession.vardiya}
              </div>
              {mySession.durum === "paused" ? (
                <div className="mt-1 font-display text-3xl text-warning tabular-nums">
                  {(() => {
                    const op = openPauseOf(mySession.id);
                    return op ? fmtDur(now - new Date(op.baslangic).getTime()) : "00:00:00";
                  })()}
                  <span className="ml-2 text-sm">
                    duraklatıldı · {openPauseOf(mySession.id)?.neden ?? "—"}
                  </span>
                </div>
              ) : (
                <div className="mt-1 font-display text-3xl text-success tabular-nums">
                  {fmtDur(now - new Date(mySession.baslangic).getTime() - pausedMsOf(mySession.id))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {mySession.durum === "paused" ? (
                <Button size="lg" className="tap-target gap-2" onClick={() => resume(mySession)} disabled={busy}>
                  <PlayCircle className="h-5 w-5" /> Devam Et
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="outline"
                  className="tap-target gap-2 border-warning/50 text-warning"
                  onClick={() => setPauseFor(mySession)}
                >
                  <Pause className="h-5 w-5" /> Duraklat
                </Button>
              )}
              <Button size="lg" variant="destructive" className="tap-target gap-2" onClick={() => setFinishFor(mySession)}>
                <Square className="h-5 w-5" /> Bitir
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Yeni iş başlat</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Vardiya</Label>
                <Select value={shift} onValueChange={(v) => setShift(v as Shift)}>
                  <SelectTrigger className="tap-target"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SHIFTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Makine</Label>
                <Select value={machine} onValueChange={setMachine}>
                  <SelectTrigger className="tap-target"><SelectValue placeholder="Makine seçiniz" /></SelectTrigger>
                  <SelectContent>
                    {visibleMachines.map((m) => (
                      <SelectItem key={m.id} value={m.id} disabled={byMachine.has(m.id)}>
                        {m.kod} — {m.ad} {byMachine.has(m.id) ? "(meşgul)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ürün / İş Emri</Label>
                <Select value={product} onValueChange={(v) => { setProduct(v); setOperation(""); }}>
                  <SelectTrigger className="tap-target"><SelectValue placeholder="Ürün seçiniz" /></SelectTrigger>
                  <SelectContent>
                    {visibleProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.kod} — {p.ad}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {product && (operations ?? []).length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Üretim Aşaması</Label>
                <Select value={operation} onValueChange={setOperation}>
                  <SelectTrigger className="tap-target"><SelectValue placeholder="Aşama seçiniz (opsiyonel)" /></SelectTrigger>
                  <SelectContent>
                    {(operations ?? [])
                      .filter((o) => !machine || !o.machine_id || o.machine_id === machine)
                      .map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.sira}. {o.ad}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isPlasma && (
              <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-primary">
                  <Flame className="h-4 w-4" /> CNC Plazma — Sac Bilgileri
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Kullanılacak Sac</Label>
                    <Select value={stokId} onValueChange={setStokId}>
                      <SelectTrigger className="tap-target"><SelectValue placeholder="Sac seçiniz" /></SelectTrigger>
                      <SelectContent>
                        {(stock ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.id} disabled={Number(s.adet) <= 0}>
                            {s.sac_tipi} · {s.kalinlik_mm}mm · {s.uzunluk_mm}×{s.genislik_mm} — stok: {s.adet}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM}>Özel Ölçü Sac (stok dışı / fire parçası)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs" htmlFor="s-adet">Kesilen Sac Adedi (0.25 / 0.5 / 1.5 olabilir)</Label>
                    <Input id="s-adet" type="number" inputMode="decimal" step="0.01" min={0.01}
                      max={isCustomSheet ? undefined : (selectedStock?.adet ?? undefined)} value={levha}
                      onChange={(e) => setLevha(e.target.value)} className="tap-target" />
                  </div>
                </div>

                {isCustomSheet && (
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="space-y-1.5 sm:col-span-4">
                      <Label className="text-xs">Sac Türü</Label>
                      <Select value={cSacTipi} onValueChange={setCSacTipi}>
                        <SelectTrigger className="tap-target"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SAC_TIPLERI.map((t) => <SelectItem key={t.ad} value={t.ad}>{t.ad}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs" htmlFor="c-u">Uzunluk (mm)</Label>
                      <Input id="c-u" type="number" inputMode="decimal" value={cUzunluk}
                        onChange={(e) => setCUzunluk(e.target.value)} className="tap-target" placeholder="örn. 1200" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs" htmlFor="c-g">Genişlik (mm)</Label>
                      <Input id="c-g" type="number" inputMode="decimal" value={cGenislik}
                        onChange={(e) => setCGenislik(e.target.value)} className="tap-target" placeholder="örn. 800" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs" htmlFor="c-k">Kalınlık (mm)</Label>
                      <Input id="c-k" type="number" inputMode="decimal" step="0.1" value={cKalinlik}
                        onChange={(e) => setCKalinlik(e.target.value)} className="tap-target" placeholder="örn. 6" />
                    </div>
                    <p className="text-xs text-muted-foreground sm:col-span-4">
                      Özel ölçü sac stoğa eklenmez ve stok miktarlarını etkilemez; yalnızca bu iş kaydında kullanılır.
                    </p>
                  </div>
                )}

                {!isCustomSheet && stock && stock.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Stokta sac tanımlı değil. Yönetim → Sac Stok bölümünden sac ekleyin veya “Özel Ölçü Sac” seçin.
                  </p>
                )}

                {selectedStock && (
                  <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <div>
                      Ölçü: <strong className="text-foreground">{selectedStock.uzunluk_mm}×{selectedStock.genislik_mm} mm</strong> ·
                      Kalınlık: <strong className="text-foreground">{selectedStock.kalinlik_mm} mm</strong>
                    </div>
                    <div>
                      Tahmini ağırlık:{" "}
                      <strong className="text-foreground">
                        {(levhaKg(selectedStock) * (Number(levha) || 0)).toFixed(1)} kg
                      </strong>{" "}
                      · Kalan stok (iş sonrası):{" "}
                      <strong className="text-foreground">
                        {Math.max(0, Number(selectedStock.adet) - (Number(levha) || 0))}
                      </strong>
                    </div>
                  </div>
                )}

              </div>
            )}


            <Button size="lg" onClick={start} disabled={busy} className="tap-target w-full gap-2 sm:w-auto">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />} Başlat
            </Button>
          </div>
        )}
      </section>

      {/* Makine kartları */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <div className="text-sm text-muted-foreground">Yükleniyor…</div>}
        {visibleMachines.map((m) => {
          const s = byMachine.get(m.id) ?? null;
          const paused = s?.durum === "paused";
          const op = s ? openPauseOf(s.id) : null;
          return (
            <div
              key={m.id}
              className={`rounded-2xl border p-5 shadow-industrial transition-colors ${
                paused ? "border-warning/50 bg-warning/5" : s ? "border-success/50 bg-success/5" : "bg-card"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-xl tracking-wide">{m.kod}</div>
                  <div className="text-xs text-muted-foreground">{m.ad}</div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                    paused
                      ? "bg-warning/20 text-warning"
                      : s
                        ? "bg-success/20 text-success"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {paused ? "Duraklatıldı" : s ? "Çalışıyor" : "Durdu"}
                </span>
              </div>

              {s ? (
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <UserIcon className="h-4 w-4" /> {nameOf(s)}
                  </div>
                  <div className="text-muted-foreground">{productOf(s.product_id)}</div>
                  {s.uzunluk_mm && (
                    <div className="flex items-center gap-2 text-xs text-primary">
                      <Flame className="h-3.5 w-3.5" />
                      {s.sac_tipi} · {s.kalinlik_mm}mm · {s.uzunluk_mm}×{s.genislik_mm} · {s.levha_adedi} levha
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Timer className="h-4 w-4" /> Başlangıç: {timeFmt.format(new Date(s.baslangic))} · {s.vardiya}
                  </div>
                  <div className="font-display text-2xl text-success tabular-nums">
                    {fmtDur(now - new Date(s.baslangic).getTime() - pausedMsOf(s.id))}
                    <span className="ml-1 text-xs font-sans text-muted-foreground">çalışma</span>
                  </div>

                  {paused && op && (
                    <div className="rounded-lg border border-warning/40 bg-warning/10 p-2.5">
                      <div className="text-xs text-warning">
                        Duruş sebebi: <strong>{op.neden}</strong>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Başlangıç: {timeFmt.format(new Date(op.baslangic))}
                      </div>
                      <div className="font-display text-xl text-warning tabular-nums">
                        {fmtDur(now - new Date(op.baslangic).getTime())}
                      </div>
                    </div>
                  )}

                  {canControl(s) && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {paused ? (
                        <Button size="sm" className="gap-2" onClick={() => resume(s)} disabled={busy}>
                          <PlayCircle className="h-4 w-4" /> Devam
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => setPauseFor(s)}>
                          <Pause className="h-4 w-4" /> Duraklat
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="gap-2" onClick={() => setFinishFor(s)}>
                        <Square className="h-4 w-4" /> Bitir
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 text-sm text-muted-foreground">Şu anda çalışan operatör yok.</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Duraklatma diyaloğu */}
      <Dialog open={!!pauseFor} onOpenChange={(o) => !o && setPauseFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Duruş Sebebi</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Sebep</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="tap-target"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAUSE_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-note">Açıklama</Label>
              <Textarea id="p-note" value={pauseNote} onChange={(e) => setPauseNote(e.target.value)} placeholder="İsteğe bağlı" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseFor(null)}>Vazgeç</Button>
            <Button onClick={doPause} disabled={busy} className="gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Duraklat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!finishFor} onOpenChange={(o) => !o && setFinishFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>İşi Bitir</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="f-qty">Üretilen Miktar (adet)</Label>
              <Input id="f-qty" type="number" min={0} inputMode="numeric" value={qty}
                onChange={(e) => setQty(e.target.value)} className="tap-target font-display text-2xl" placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-scrap">Hurda / Fire (adet)</Label>
              <Input id="f-scrap" type="number" min={0} inputMode="numeric" value={scrap}
                onChange={(e) => setScrap(e.target.value)} className="tap-target" placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-note">Notlar</Label>
              <Textarea id="f-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="İsteğe bağlı" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinishFor(null)}>Vazgeç</Button>
            <Button onClick={finish} disabled={busy} className="gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Kaydet ve Bitir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
