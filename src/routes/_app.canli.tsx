import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Play, Square, Loader2, Radio, Timer, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/canli")({
  component: CanliPage,
  head: () => ({
    meta: [
      { title: "Canlı Takip — Fabrika Üretim İzleme" },
      { name: "description", content: "Makinelerin anlık durumu, çalışan operatör, ürün ve canlı çalışma süresi takibi." },
      { property: "og:title", content: "Canlı Takip — Fabrika Üretim İzleme" },
      { property: "og:description", content: "Makine durumları ve üretim oturumları anlık olarak izlenir." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SHIFTS = ["Sabah", "Akşam", "Gece"] as const;
type Shift = (typeof SHIFTS)[number];

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
}

function CanliPage() {
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
        .select("id,operator_id,machine_id,product_id,vardiya,baslangic")
        .is("bitis", null)
        .order("baslangic");
      if (error) throw error;
      return (data ?? []) as SessionRow[];
    },
    refetchInterval: 15000,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("live-production")
      .on("postgres_changes", { event: "*", schema: "public", table: "production_sessions" }, () => {
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

  const mySession = (running ?? []).find((s) => s.operator_id === user?.id) ?? null;

  // ---- start form
  const [machine, setMachine] = useState("");
  const [product, setProduct] = useState("");
  const [shift, setShift] = useState<Shift>(autoShift());
  const [busy, setBusy] = useState(false);

  async function start() {
    if (!machine) return toast.error("Makine seçiniz");
    if (byMachine.has(machine)) return toast.error("Bu makine şu anda çalışıyor");
    setBusy(true);
    const { error } = await supabase.from("production_sessions").insert({
      operator_id: user!.id,
      machine_id: machine,
      product_id: product || null,
      vardiya: shift,
      baslangic: new Date().toISOString(),
    });
    setBusy(false);
    if (error) return toast.error("Başlatılamadı: " + error.message);
    toast.success("İş başlatıldı");
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
    setBusy(true);
    const { error } = await supabase
      .from("production_sessions")
      .update({
        bitis: new Date().toISOString(),
        miktar: Math.round(n),
        hurda: Math.round(Number(scrap) || 0),
        notlar: note.trim() || null,
      })
      .eq("id", finishFor.id);
    setBusy(false);
    if (error) return toast.error("Kaydedilemedi: " + error.message);
    toast.success("İş tamamlandı ve kaydedildi");
    setFinishFor(null);
    setQty("");
    setScrap("");
    setNote("");
    qc.invalidateQueries({ queryKey: ["running-sessions"] });
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

  const runningCount = visibleMachines.filter((m) => byMachine.has(m.id)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl tracking-tight">Canlı Takip</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Makinelerin anlık durumu — sayfa yenilemeden güncellenir.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
          <Radio className="h-3.5 w-3.5 animate-pulse" />
          {runningCount} / {visibleMachines.length} makine çalışıyor
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
                {productOf(mySession.product_id)}
              </div>
              <div className="mt-1 font-display text-3xl text-success tabular-nums">
                {fmtDur(now - new Date(mySession.baslangic).getTime())}
              </div>
            </div>
            <Button
              size="lg"
              variant="destructive"
              className="tap-target gap-2"
              onClick={() => setFinishFor(mySession)}
            >
              <Square className="h-5 w-5" /> Bitir
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Yeni iş başlat</div>
            <div className="grid gap-3 sm:grid-cols-3">
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
              <div className="space-y-1.5">
                <Label className="text-xs">Vardiya</Label>
                <Select value={shift} onValueChange={(v) => setShift(v as Shift)}>
                  <SelectTrigger className="tap-target"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SHIFTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
          const s = byMachine.get(m.id);
          const on = !!s;
          return (
            <div
              key={m.id}
              className={`rounded-2xl border p-5 shadow-industrial transition-colors ${
                on ? "border-success/50 bg-success/5" : "bg-card"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-xl tracking-wide">{m.kod}</div>
                  <div className="text-xs text-muted-foreground">{m.ad}</div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                    on ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {on ? "Çalışıyor" : "Boşta"}
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
                    {fmtDur(now - new Date(s.baslangic).getTime())}
                  </div>
                  {(isSuperAdmin || role === "supervisor" || s.operator_id === user?.id) && (
                    <Button size="sm" variant="outline" className="mt-1 gap-2" onClick={() => setFinishFor(s)}>
                      <Square className="h-4 w-4" /> Bitir
                    </Button>
                  )}
                </div>
              ) : (
                <div className="mt-4 text-sm text-muted-foreground">Şu anda çalışan operatör yok.</div>
              )}
            </div>
          );
        })}
      </div>

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
