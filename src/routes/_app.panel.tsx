import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Play, Square, Pause, Loader2, Radio, Timer, User as UserIcon, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SAC_TIPLERI, isPlasmaMachine } from "@/lib/sac";

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

  const { data: profiles } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,ad_soyad,personel_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: running, isLoading } = useQuery({
    queryKey: ["running-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("production_sessions")
        .select(
          "id,operator_id,machine_id,product_id,vardiya,baslangic,durum,sac_tipi,uzunluk_mm,genislik_mm,kalinlik_mm,levha_adedi,yogunluk",
        )
        .is("bitis", null)
        .order("baslangic");
      if (error) throw error;
      return (data ?? []) as SessionRow[];
    },
    refetchInterval: 15000,
  });

  const sessionIds = (running ?? []).map((s) => s.id);

  const { data: pauses } = useQuery({
    queryKey: ["running-pauses", sessionIds.join(",")],
    enabled: sessionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_pauses")
        .select("id,session_id,neden,baslangic,bitis,sure_dakika")
        .in("session_id", sessionIds);
      if (error) throw error;
      return (data ?? []) as PauseRow[];
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
  const [shift, setShift] = useState<Shift>(autoShift());
  const [busy, setBusy] = useState(false);

  // CNC Plazma alanları
  const [sacTipi, setSacTipi] = useState(SAC_TIPLERI[0].ad);
  const [uzunluk, setUzunluk] = useState("6000");
  const [genislik, setGenislik] = useState("1500");
  const [kalinlik, setKalinlik] = useState("");
  const [levha, setLevha] = useState("1");

  const selectedMachine = (machines ?? []).find((m) => m.id === machine) ?? null;
  const isPlasma = isPlasmaMachine(selectedMachine);

  async function start() {
    if (!machine) return toast.error("Makine seçiniz");
    if (byMachine.has(machine)) return toast.error("Bu makine şu anda çalışıyor");

    let plasma: Record<string, unknown> = {};
    if (isPlasma) {
      const u = Number(uzunluk), g = Number(genislik), k = Number(kalinlik), a = Number(levha);
      if (!(u > 0)) return toast.error("Sac uzunluğu giriniz");
      if (!(g > 0)) return toast.error("Sac genişliği giriniz");
      if (!(k > 0)) return toast.error("Sac kalınlığı giriniz");
      if (!(a > 0)) return toast.error("Kesilecek sac adedi giriniz");
      plasma = {
        sac_tipi: sacTipi,
        uzunluk_mm: u,
        genislik_mm: g,
        kalinlik_mm: k,
        levha_adedi: Math.round(a),
        yogunluk: SAC_TIPLERI.find((s) => s.ad === sacTipi)?.yogunluk ?? 7.85,
      };
    }

    setBusy(true);
    const { error } = await supabase.from("production_sessions").insert({
      operator_id: user!.id,
      machine_id: machine,
      product_id: product || null,
      vardiya: shift,
      baslangic: new Date().toISOString(),
      durum: "running",
      ...plasma,
    });
    setBusy(false);
    if (error) return toast.error("Başlatılamadı: " + error.message);
    toast.success("İş başlatıldı");
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


  const nameOf = (id: string) => {
    const p = profiles?.find((x) => x.id === id);
    return p?.ad_soyad ?? p?.personel_id ?? "—";
  };
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
                <Select value={product} onValueChange={setProduct}>
                  <SelectTrigger className="tap-target"><SelectValue placeholder="Ürün seçiniz" /></SelectTrigger>
                  <SelectContent>
                    {visibleProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.kod} — {p.ad}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
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
                    <UserIcon className="h-4 w-4" /> {nameOf(s.operator_id)}
                  </div>
                  <div className="text-muted-foreground">{productOf(s.product_id)}</div>
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
